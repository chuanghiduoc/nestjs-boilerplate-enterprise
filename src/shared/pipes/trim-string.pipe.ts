import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * Trim String Pipe
 *
 * Trims whitespace from string values
 * Input sanitization rule (Section 2.1)
 */
@Injectable()
export class TrimStringPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (this.isPlainObject(value)) {
      return this.trimObject(value);
    }

    return value;
  }

  private trimObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = value.trim();
      } else {
        result[key] = this.transform(value);
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
