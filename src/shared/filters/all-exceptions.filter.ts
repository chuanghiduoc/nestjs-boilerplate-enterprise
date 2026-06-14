import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, ErrorCodeToHttpStatus } from '../constants';
import type { ErrorDetail, ErrorResponse } from '../dtos/response.dto';

/**
 * Global Exception Filter
 * Order: 9 in request pipeline (Section 4.1)
 *
 * Handles all exceptions and formats them according to Section 11.3-11.4
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || this.generateRequestId();
    const timestamp = new Date().toISOString();
    const path = request.url;

    let status: number;
    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Handle validation errors from class-validator
        if (Array.isArray(responseObj.message)) {
          errorResponse = this.formatValidationError(
            responseObj.message as string[],
            timestamp,
            path,
            requestId,
          );
        } else {
          errorResponse = this.formatHttpException(responseObj, status, timestamp, path, requestId);
        }
      } else {
        errorResponse = this.formatGenericError(
          exceptionResponse,
          status,
          timestamp,
          path,
          requestId,
        );
      }
    } else {
      // Unhandled exception
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = this.formatInternalError(timestamp, path, requestId);

      // Log the full error for debugging
      this.logger.error(
        {
          message: 'Unhandled exception',
          requestId,
          path,
          error:
            exception instanceof Error
              ? {
                  name: exception.name,
                  message: exception.message,
                  stack: exception.stack,
                }
              : exception,
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Set response headers (Section 11.7)
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    response.status(status).json(errorResponse);
  }

  private formatValidationError(
    messages: string[],
    timestamp: string,
    path: string,
    requestId: string,
  ): ErrorResponse {
    const details: ErrorDetail[] = messages.map((msg) => ({
      field: 'unknown',
      message: msg,
      code: 'validation',
    }));

    return {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details,
        timestamp,
        path,
        requestId,
      },
    };
  }

  private formatHttpException(
    responseObj: Record<string, unknown>,
    status: number,
    timestamp: string,
    path: string,
    requestId: string,
  ): ErrorResponse {
    const code = (responseObj.code as string) || this.getErrorCodeFromStatus(status);
    const message = (responseObj.message as string) || 'An error occurred';

    return {
      success: false,
      error: {
        code,
        message,
        messageKey: responseObj.messageKey as string | undefined,
        details: responseObj.details as ErrorDetail[] | undefined,
        timestamp,
        path,
        requestId,
      },
    };
  }

  private formatGenericError(
    message: string,
    status: number,
    timestamp: string,
    path: string,
    requestId: string,
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.getErrorCodeFromStatus(status),
        message,
        timestamp,
        path,
        requestId,
      },
    };
  }

  private formatInternalError(timestamp: string, path: string, requestId: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        timestamp,
        path,
        requestId,
      },
    };
  }

  private getErrorCodeFromStatus(status: number): string {
    // Find error code that maps to this status
    for (const [code, httpStatus] of Object.entries(ErrorCodeToHttpStatus)) {
      if (httpStatus === status) {
        return code;
      }
    }
    return ErrorCode.INTERNAL_ERROR;
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
