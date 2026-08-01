/**
 * Express Request Extension
 *
 * Extends Express Request to include user and tenant context
 * set by authentication guards.
 */
declare global {
  namespace Express {
    interface User {
      id?: string;
      sub?: string;
      tenantId?: string;
      roles?: readonly string[];
      tier?: 'anonymous' | 'authenticated' | 'premium' | 'internal';
    }

    interface Request {
      /**
       * Resolved tenant ID for multi-tenancy
       */
      tenantId?: string;

      /**
       * Request correlation ID for tracing
       */
      correlationId?: string;
    }
  }
}

export {};
