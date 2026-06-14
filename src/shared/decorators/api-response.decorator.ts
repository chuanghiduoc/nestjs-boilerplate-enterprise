import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';

/**
 * Standard API Error Response Schema for Swagger
 */
export const ApiErrorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ERROR_CODE' },
        message: { type: 'string', example: 'Error description' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
};

/**
 * Success Response wrapper for Swagger
 */
export function ApiSuccessResponse(
  dataType: Type<unknown>,
  description = 'Successful response',
  status: HttpStatus.OK | HttpStatus.CREATED = HttpStatus.OK,
): MethodDecorator & ClassDecorator {
  const decorator = status === HttpStatus.CREATED ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ApiExtraModels(dataType),
    decorator({
      description,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(dataType) },
        },
      },
    }),
  );
}

/**
 * Standard error responses for authenticated endpoints
 */
export function ApiStandardResponses(options?: {
  includeNotFound?: boolean;
}): MethodDecorator & ClassDecorator {
  const decorators = [
    ApiBadRequestResponse({
      description: 'Validation error',
      schema: {
        ...ApiErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [{ field: 'email', message: 'must be a valid email', code: 'isEmail' }],
            timestamp: '2026-01-15T10:30:00.000Z',
            path: '/api/v1/resource',
            requestId: 'req_abc123',
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Authentication required',
      schema: {
        ...ApiErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
            timestamp: '2026-01-15T10:30:00.000Z',
            path: '/api/v1/resource',
            requestId: 'req_abc123',
          },
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'Access denied',
      schema: {
        ...ApiErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource',
            timestamp: '2026-01-15T10:30:00.000Z',
            path: '/api/v1/resource',
            requestId: 'req_abc123',
          },
        },
      },
    }),
    ApiTooManyRequestsResponse({
      description: 'Rate limit exceeded',
      schema: {
        ...ApiErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            timestamp: '2026-01-15T10:30:00.000Z',
            path: '/api/v1/resource',
            requestId: 'req_abc123',
          },
        },
      },
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal server error',
      schema: {
        ...ApiErrorResponseSchema,
        example: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: '2026-01-15T10:30:00.000Z',
            path: '/api/v1/resource',
            requestId: 'req_abc123',
          },
        },
      },
    }),
  ];

  if (options?.includeNotFound) {
    decorators.push(
      ApiNotFoundResponse({
        description: 'Resource not found',
        schema: {
          ...ApiErrorResponseSchema,
          example: {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: 'Resource not found',
              timestamp: '2026-01-15T10:30:00.000Z',
              path: '/api/v1/resource/123',
              requestId: 'req_abc123',
            },
          },
        },
      }),
    );
  }

  return applyDecorators(...decorators);
}

/**
 * Common conflict response
 */
export function ApiConflictErrorResponse(
  description = 'Resource conflict',
): MethodDecorator & ClassDecorator {
  return ApiConflictResponse({
    description,
    schema: {
      ...ApiErrorResponseSchema,
      example: {
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE',
          message: 'Resource already exists',
          timestamp: '2026-01-15T10:30:00.000Z',
          path: '/api/v1/resource',
          requestId: 'req_abc123',
        },
      },
    },
  });
}

/**
 * Unprocessable entity response for business logic errors
 */
export function ApiBusinessErrorResponse(
  description = 'Business rule violation',
): MethodDecorator & ClassDecorator {
  return ApiUnprocessableEntityResponse({
    description,
    schema: {
      ...ApiErrorResponseSchema,
      example: {
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Business rule was violated',
          timestamp: '2026-01-15T10:30:00.000Z',
          path: '/api/v1/resource',
          requestId: 'req_abc123',
        },
      },
    },
  });
}

/**
 * Combine operation summary with standard responses
 */
export function ApiEndpoint(
  summary: string,
  options?: { includeNotFound?: boolean },
): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiOperation({ summary }), ApiStandardResponses(options));
}
