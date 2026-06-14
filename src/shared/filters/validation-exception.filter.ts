import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorCode } from '../constants';
import type { ErrorDetail, ErrorResponse } from '../dtos/response.dto';

/**
 * Validation Exception Filter
 * Specifically handles validation errors from class-validator (Section 4.3)
 *
 * HTTP Status: 400 (Section 11.5)
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse();
    const requestId =
      (request.headers['x-request-id'] as string) || `req_${Date.now().toString(36)}`;
    const timestamp = new Date().toISOString();
    const path = request.url;

    let errorResponse: ErrorResponse;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as Record<string, unknown>;

      // Handle class-validator errors
      if (Array.isArray(responseObj.message)) {
        const details = this.parseValidationErrors(responseObj.message as string[]);
        errorResponse = {
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
      } else {
        // Handle custom BadRequestException
        errorResponse = {
          success: false,
          error: {
            code: (responseObj.code as string) || ErrorCode.VALIDATION_ERROR,
            message: (responseObj.message as string) || 'Bad request',
            details: responseObj.details as ErrorDetail[] | undefined,
            timestamp,
            path,
            requestId,
          },
        };
      }
    } else {
      errorResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: typeof exceptionResponse === 'string' ? exceptionResponse : 'Bad request',
          timestamp,
          path,
          requestId,
        },
      };
    }

    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.status(400).json(errorResponse);
  }

  private parseValidationErrors(messages: string[]): ErrorDetail[] {
    return messages.map((msg) => {
      // Try to extract field name from message
      // class-validator typically formats as "property constraint message"
      const parts = msg.split(' ');
      const field = parts[0] || 'unknown';

      return {
        field,
        message: msg,
        code: 'validation',
      };
    });
  }
}
