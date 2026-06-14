import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Response } from 'express';
import { PaginationMeta } from '../utils/pagination.util';

/**
 * API Response interface following Section 11.1
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/**
 * Transform Response Interceptor
 * Order: 8 (After) in request pipeline (Section 4.1)
 *
 * Wraps all successful responses in the standard envelope (Section 11.1)
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Set standard headers (Section 11.7)
        const requestId = response.getHeader('X-Request-Id') as string | undefined;
        if (requestId) {
          response.setHeader('X-Request-Id', requestId);
        }

        // If data is already wrapped, return as-is
        if (this.isAlreadyWrapped(data)) {
          return data as ApiResponse<T>;
        }

        // Controllers return a { data, meta? } envelope. Unwrap it into the
        // standard response so the payload is not double-nested (data.data),
        // carrying pagination meta through when present.
        if (this.hasDataEnvelope(data)) {
          const { data: payload, meta } = data as {
            data: T;
            meta?: ResponseMeta;
          };
          return {
            success: true,
            data: payload,
            ...(meta !== undefined ? { meta } : {}),
          };
        }

        // Wrap a raw response value
        return {
          success: true,
          data,
        };
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      'success' in data &&
      typeof (data as { success: unknown }).success === 'boolean'
    );
  }

  private hasDataEnvelope(data: unknown): boolean {
    return data !== null && typeof data === 'object' && 'data' in data;
  }
}
