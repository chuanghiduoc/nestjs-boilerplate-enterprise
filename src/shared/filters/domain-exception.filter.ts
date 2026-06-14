import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '@core/domain/base';
import { ErrorCodeToHttpStatus } from '../constants';
import type { ErrorResponse } from '../dtos/response.dto';

/**
 * Domain Exception Filter
 *
 * Specifically handles DomainException and its subclasses.
 * Converts domain errors to appropriate HTTP responses (Section 4.3).
 *
 * Default HTTP Status: 422 (Unprocessable Entity) for business rule violations
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || this.generateRequestId();
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Get HTTP status from error code mapping, default to 422
    const status = ErrorCodeToHttpStatus[exception.code] || 422;

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details
          ? Object.entries(exception.details).map(([field, value]) => ({
              field,
              message: String(value),
              code: 'domain_error',
            }))
          : undefined,
        timestamp,
        path,
        requestId,
      },
    };

    // Log domain exceptions at warn level (expected business errors)
    this.logger.warn({
      message: `Domain exception: ${exception.message}`,
      requestId,
      path,
      errorCode: exception.code,
      details: exception.details,
    });

    // Set response headers (Section 11.7)
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    response.status(status).json(errorResponse);
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
