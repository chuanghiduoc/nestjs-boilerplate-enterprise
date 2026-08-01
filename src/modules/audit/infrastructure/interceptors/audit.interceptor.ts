import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditService } from '../../application/services/audit.service';
import { AuditAction } from '../../domain/entities/audit-log.entity';
import { AUDIT_OPTIONS, type AuditOptions } from '../decorators/audit.decorator';

/**
 * Audit Interceptor
 *
 * Automatically logs audit entries for decorated endpoints.
 * Uses the @Audit() decorator to configure what to audit.
 *
 * @example
 * @Post()
 * @Audit({ action: AuditAction.CREATE, entityType: 'User' })
 * async createUser(@Body() dto: CreateUserDto) { ... }
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.get<AuditOptions>(AUDIT_OPTIONS, context.getHandler());

    // Skip if no audit decorator
    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    const auditContext = {
      userId: user?.sub,
      tenantId: user?.tenantId,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Extract entity ID from response or request
          const entityId = this.extractEntityId(auditOptions, request, response);

          if (entityId) {
            this.auditService
              .log(
                {
                  action: auditOptions.action,
                  entityType: auditOptions.entityType,
                  entityId,
                  newValues: auditOptions.includeBody
                    ? (request.body as Record<string, unknown>)
                    : undefined,
                  metadata: auditOptions.metadata,
                },
                auditContext,
              )
              .catch(() => {
                // Silently fail - don't break the request
              });
          }
        },
        error: (error) => {
          // Optionally log failed attempts
          if (auditOptions.logErrors) {
            const entityId = this.extractEntityId(auditOptions, request, null);

            this.auditService
              .log(
                {
                  action: AuditAction.ACCESS_DENIED,
                  entityType: auditOptions.entityType,
                  entityId: entityId || 'unknown',
                  metadata: {
                    originalAction: auditOptions.action,
                    error: error instanceof Error ? error.message : String(error),
                  },
                },
                auditContext,
              )
              .catch(() => {
                // Silently fail
              });
          }
        },
      }),
    );
  }

  private extractEntityId(
    options: AuditOptions,
    request: Request,
    response: unknown,
  ): string | undefined {
    // Custom extractor
    if (options.entityIdExtractor) {
      return options.entityIdExtractor(request, response);
    }

    // From route params
    if (options.entityIdParam && request.params[options.entityIdParam]) {
      const param = request.params[options.entityIdParam];
      return Array.isArray(param) ? param[0] : param;
    }

    // From response (for CREATE operations)
    if (response && typeof response === 'object' && 'id' in response) {
      return (response as { id: string }).id;
    }

    // From request body
    const body = request.body as Record<string, unknown> | undefined;
    if (body?.id && typeof body.id === 'string') {
      return body.id;
    }

    return undefined;
  }

  private getClientIp(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress;
  }
}
