import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate, type ValidationError as ClassValidatorError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ErrorCode } from '../constants';
import type { ErrorDetail } from '../dtos/response.dto';

/**
 * Custom Validation Pipe
 *
 * Enhanced validation pipe with better error formatting (Section 4.3, 11.4)
 *
 * Features:
 * - Whitelist: strips non-decorated properties
 * - ForbidNonWhitelisted: rejects unknown properties
 * - Transform: auto-transforms to DTO class instances
 * - Detailed error messages with field paths
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const { metatype } = metadata;

    // Skip validation for native types or undefined metatype
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value as object, {
      enableImplicitConversion: false, // Explicit typing only (security!)
    }) as object;

    // Validate the object
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);

      this.logger.debug({
        message: 'Validation failed',
        errors: formattedErrors,
      });

      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: formattedErrors,
      });
    }

    return object;
  }

  /**
   * Check if type should be validated
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private toValidate(metatype: Function): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Format validation errors to ErrorDetail array
   * Handles nested objects with dot notation (e.g., "profile.age")
   */
  private formatErrors(errors: ClassValidatorError[], parentPath = ''): ErrorDetail[] {
    const details: ErrorDetail[] = [];

    for (const error of errors) {
      const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        details.push(...this.formatErrors(error.children, fieldPath));
      }

      // Handle constraints on current field
      if (error.constraints) {
        for (const [code, message] of Object.entries(error.constraints)) {
          details.push({
            field: fieldPath,
            message,
            code,
            value: this.sanitizeValue(error.value),
          });
        }
      }
    }

    return details;
  }

  /**
   * Sanitize sensitive values before including in error response
   */
  private sanitizeValue(value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    // Mask password fields
    if (typeof value === 'string' && value.length > 0) {
      return '***';
    }

    // For other types, return the type name
    if (typeof value === 'object') {
      return `[${Array.isArray(value) ? 'Array' : 'Object'}]`;
    }

    return value;
  }
}
