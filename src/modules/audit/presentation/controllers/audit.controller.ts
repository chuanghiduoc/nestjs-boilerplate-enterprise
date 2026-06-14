import { Controller, Get, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards';
import { Roles, ApiPaginatedResponse } from '@shared/decorators';
import { RolesGuard } from '@shared/guards/roles.guard';
import type { PaginationMetaDto } from '@shared/dtos';
import { AuditService } from '../../application/services/audit.service';
import type { AuditAction, AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditLogResponseDto } from '../dtos/audit-log.dto';

/**
 * Shape of a paginated result returned by the audit service.
 */
interface PaginatedAuditResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standard paginated REST envelope (unwrapped by TransformResponseInterceptor).
 */
interface PaginatedAuditResponse {
  data: AuditLogResponseDto[];
  meta: { pagination: PaginationMetaDto };
}

/**
 * Audit Controller
 *
 * REST endpoints for querying audit logs.
 * Restricted to admin users.
 */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiPaginatedResponse(AuditLogResponseDto, 'Audit logs retrieved')
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PaginatedAuditResponse> {
    const result = await this.auditService.findMany(
      {
        action,
        entityType,
        entityId,
        userId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      { page: page ?? 1, limit: limit ?? 20 },
      { field: 'createdAt', order: 'DESC' },
    );

    return this.toPaginatedResponse(result);
  }

  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit history for an entity' })
  @ApiPaginatedResponse(AuditLogResponseDto, 'Entity audit history')
  async getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedAuditResponse> {
    const result = await this.auditService.getEntityHistory(entityType, entityId, {
      page: page ?? 1,
      limit: limit ?? 20,
    });

    return this.toPaginatedResponse(result);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit history for a user' })
  @ApiPaginatedResponse(AuditLogResponseDto, 'User audit history')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedAuditResponse> {
    const result = await this.auditService.getUserHistory(userId, {
      page: page ?? 1,
      limit: limit ?? 20,
    });

    return this.toPaginatedResponse(result);
  }

  /**
   * Map a paginated service result into the standard { data, meta.pagination }
   * envelope shared by all list endpoints.
   */
  private toPaginatedResponse(result: PaginatedAuditResult): PaginatedAuditResponse {
    return {
      data: result.data.map((log) => this.toDto(log)),
      meta: {
        pagination: {
          page: result.page,
          limit: result.limit,
          totalItems: result.total,
          totalPages: result.limit > 0 ? Math.ceil(result.total / result.limit) : 0,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      },
    };
  }

  private toDto(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      tenantId: log.tenantId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      changedFields: log.getChangedFields(),
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }
}
