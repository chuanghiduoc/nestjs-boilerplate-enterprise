import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * Sanitize Pipe
 *
 * Removes potentially dangerous characters from input
 * Input sanitization rules (Section 2.1):
 * - Null byte injection: Strip \0 characters
 * - Path traversal: Validate no ../ in paths
 *
 * Note: XSS filtering for rich text should use sanitize-html package
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (this.isPlainObject(value)) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeString(str: string): string {
    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');

    // Remove potential path traversal sequences
    sanitized = sanitized.replace(/\.\.[\\/]/g, '');

    return sanitized;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key as well
      const sanitizedKey = this.sanitizeString(key);

      if (typeof value === 'string') {
        result[sanitizedKey] = this.sanitizeString(value);
      } else {
        result[sanitizedKey] = this.transform(value);
      }
    }

    return result;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
}
