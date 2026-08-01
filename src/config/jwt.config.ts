import { registerAs } from '@nestjs/config';

/**
 * Parse duration string (e.g., '15m', '7d', '1h') to seconds
 */
function parseDuration(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    return parseInt(duration, 10) || 900; // Default 15 minutes
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return value;
  }
}

/**
 * JWT Configuration
 *
 * Following Section 12.5 - JWT Security Best Practices
 */
export const jwtConfig = registerAs('jwt', () => ({
  // Never allow the documented development fallback to reach production.
  // Fail fast so a deployment cannot accidentally start with a forgeable key.
  ...validateProductionConfiguration(),
  // Algorithm (Section 12.5 recommends RS256 or ES256 for production)
  algorithm: (process.env.JWT_ALGORITHM as 'RS256' | 'HS256' | 'ES256') || 'HS256',

  // Keys
  // For RS256/ES256 (asymmetric)
  privateKey: process.env.JWT_PRIVATE_KEY,
  publicKey: process.env.JWT_PUBLIC_KEY,

  // For HS256 (symmetric - not recommended for multi-service)
  secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',

  // Token expiration (in seconds)
  accessTokenExpiresIn: parseDuration(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m'),
  refreshTokenExpiresIn: parseDuration(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d'),

  // Token claims
  issuer: process.env.JWT_ISSUER || 'auth.example.com',
  audience: process.env.JWT_AUDIENCE || 'api.example.com',

  // Blacklist (using Redis)
  blacklistEnabled: process.env.JWT_BLACKLIST_ENABLED !== 'false',
}));

function validateProductionConfiguration(): Record<string, never> {
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

  const algorithm = process.env.JWT_ALGORITHM || 'HS256';
  const secret = process.env.JWT_SECRET;
  if (algorithm === 'HS256' && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (algorithm !== 'HS256' && (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY)) {
    throw new Error(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required for asymmetric JWT algorithms',
    );
  }

  return {};
}

export type JwtConfig = ReturnType<typeof jwtConfig>;
