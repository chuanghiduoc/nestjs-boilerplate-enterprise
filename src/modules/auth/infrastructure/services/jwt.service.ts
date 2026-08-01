import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  sign,
  verify,
  type SignOptions,
  type VerifyOptions,
  type Algorithm,
  type JwtPayload as BaseJwtPayload,
  type Secret,
} from 'jsonwebtoken';
import { type ILogger, LOGGER } from '@core/domain/ports/services';
import { generateUUID, generateToken } from '@shared/utils';
import type { JwtConfig } from '@config/jwt.config';

/**
 * JWT Payload Interface
 *
 * Section 12.5: Access Token Structure
 */
export interface JwtPayload extends BaseJwtPayload {
  sub: string; // User ID
  jti: string; // Unique token ID (for blacklist)
  iat: number; // Issued at
  exp: number; // Expiration
  aud: string; // Audience
  iss: string; // Issuer

  // Custom claims
  tenantId?: string;
  roles: readonly string[];
  permissions: readonly string[];
  tier?: 'anonymous' | 'authenticated' | 'premium' | 'internal';
}

/**
 * Token Pair Response
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Generate Token Options
 */
export interface GenerateTokenOptions {
  userId: string;
  tenantId?: string;
  roles: readonly string[];
  permissions: readonly string[];
}

/**
 * JWT Service
 *
 * Handles JWT token generation and validation.
 *
 * Section 12.5: JWT Security Best Practices
 * - Short-lived access tokens (15-30 min)
 * - Refresh token rotation
 * - JTI for blacklisting
 * - RS256/ES256 for production (asymmetric)
 * - HS256 for development (symmetric)
 */
@Injectable()
export class JwtService {
  private readonly jwtConfig: JwtConfig;
  private readonly signingKey: Secret;
  private readonly verifyKey: Secret;
  private readonly algorithm: Algorithm;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    const config = this.configService.get<JwtConfig>('jwt');
    if (!config) {
      throw new Error('JWT configuration not found');
    }
    this.jwtConfig = config;
    this.algorithm = config.algorithm;

    // Determine signing and verification keys based on algorithm
    if (this.isAsymmetricAlgorithm(config.algorithm)) {
      // RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512
      if (!config.privateKey || !config.publicKey) {
        throw new Error(
          `${config.algorithm} algorithm requires JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables`,
        );
      }
      // Handle escaped newlines in environment variables
      this.signingKey = config.privateKey.replace(/\\n/g, '\n');
      this.verifyKey = config.publicKey.replace(/\\n/g, '\n');
      this.logger.log(`JWT configured with ${config.algorithm} (asymmetric)`, 'JwtService');
    } else {
      // HS256, HS384, HS512 (symmetric)
      if (!config.secret || config.secret.length < 32) {
        this.logger.warn('JWT_SECRET should be at least 32 characters for security', 'JwtService');
      }
      this.signingKey = config.secret;
      this.verifyKey = config.secret;
      this.logger.log(`JWT configured with ${config.algorithm} (symmetric)`, 'JwtService');
    }
  }

  /**
   * Check if algorithm is asymmetric (requires public/private key pair)
   */
  private isAsymmetricAlgorithm(algorithm: string): boolean {
    return [
      'RS256',
      'RS384',
      'RS512',
      'ES256',
      'ES384',
      'ES512',
      'PS256',
      'PS384',
      'PS512',
    ].includes(algorithm);
  }

  /**
   * Generate access token
   */
  generateAccessToken(options: GenerateTokenOptions): string {
    const jti = generateUUID();

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: options.userId,
      jti,
      aud: this.jwtConfig.audience,
      iss: this.jwtConfig.issuer,
      tenantId: options.tenantId,
      roles: options.roles,
      permissions: options.permissions,
    };

    const signOptions: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.jwtConfig.accessTokenExpiresIn,
      notBefore: 0,
    };

    return sign(payload, this.signingKey, signOptions);
  }

  /**
   * Generate refresh token (opaque token, not JWT)
   */
  generateRefreshToken(): string {
    return generateToken(64);
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(options: GenerateTokenOptions): TokenPair {
    const accessToken = this.generateAccessToken(options);
    const refreshToken = this.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtConfig.accessTokenExpiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const verifyOptions: VerifyOptions = {
        algorithms: [this.algorithm],
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience,
      };

      const decoded = verify(token, this.verifyKey, verifyOptions) as JwtPayload;

      return decoded;
    } catch (error) {
      this.logger.warn(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JwtService',
      );
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging/extracting claims)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
      return JSON.parse(payload) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiration time in seconds
   */
  getAccessTokenExpiresIn(): number {
    return this.jwtConfig.accessTokenExpiresIn;
  }

  /**
   * Get refresh token expiration time in seconds
   */
  getRefreshTokenExpiresIn(): number {
    return this.jwtConfig.refreshTokenExpiresIn;
  }

  /**
   * Calculate refresh token expiry date
   */
  getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + this.jwtConfig.refreshTokenExpiresIn * 1000);
  }

  /**
   * Check if blacklist is enabled
   */
  isBlacklistEnabled(): boolean {
    return this.jwtConfig.blacklistEnabled;
  }

  /**
   * Get the current algorithm
   */
  getAlgorithm(): Algorithm {
    return this.algorithm;
  }
}
