import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';

/**
 * Response Time Interceptor
 *
 * Adds X-Response-Time header to all responses (Section 11.7)
 *
 * Order: 3 (Before) in request pipeline (Section 4.1)
 */
@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        if (!response.headersSent) {
          response.setHeader('X-Response-Time', `${duration}ms`);
        }
      }),
    );
  }
}
