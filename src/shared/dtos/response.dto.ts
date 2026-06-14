import { ApiProperty } from '@nestjs/swagger';
import { Field, ObjectType } from '@nestjs/graphql';
import type { PaginationMeta } from '../utils/pagination.util';

/**
 * Standard API response contract (Section 11).
 *
 * This file is the single source of truth for the response/error envelope
 * shapes. The TransformResponseInterceptor and the exception filters import
 * these types instead of redefining them.
 */

/**
 * A single field-level error detail (e.g. from validation).
 */
export interface ErrorDetail {
  field: string;
  message: string;
  messageKey?: string;
  code: string;
  value?: unknown;
  constraints?: Record<string, unknown>;
}

/**
 * Error payload returned inside an error response envelope.
 */
export interface ApiError {
  code: string;
  message: string;
  messageKey?: string;
  details?: ErrorDetail[];
  timestamp: string;
  path: string;
  requestId: string;
}

/**
 * Error response envelope.
 */
export interface ErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Metadata attached to a successful response (e.g. pagination).
 */
export interface ResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/**
 * Successful response envelope.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: ResponseMeta;
}

/**
 * Delete Response DTO
 */
@ObjectType('DeleteResponse')
export class DeleteResponseDto {
  @ApiProperty({ description: 'Whether deletion was successful' })
  @Field()
  deleted!: boolean;

  @ApiProperty({ description: 'ID of deleted resource', format: 'uuid' })
  @Field()
  id!: string;

  @ApiProperty({ description: 'Timestamp when resource was deleted' })
  @Field()
  deletedAt!: string;
}

/**
 * Success Message Response DTO
 */
@ObjectType('MessageResponse')
export class MessageResponseDto {
  @ApiProperty({ description: 'Success message' })
  @Field()
  message!: string;
}
