import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ThrottleConfig } from '@config/throttle.config';

/**
 * Rate Limit Tier
 */
export type RateLimitTier = 'anonymous' | 'authenticated' | 'premium' | 'internal';

/**
 * Custom metadata key for rate limit tier
 */
export const RATE_LIMIT_TIER = 'rate-limit-tier';

/**
 * Custom Throttler Guard
 *
 * Extends NestJS ThrottlerGuard to support tier-based rate limiting.
 *
 * Section 12.5: Rate Limiting Tiers
 * - Anonymous: 30 req/min
 * - Authenticated: 100 req/min
 * - Premium: 500 req/min
 * - Internal: 1000 req/min
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly throttleConfig: ThrottleConfig | undefined;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.throttleConfig = this.configService.get<ThrottleConfig>('throttle');
  }

  /**
   * Get rate limit based on user tier
   */
  protected getLimit(context: ExecutionContext): Promise<number> {
    const tier = this.getTier(context);
    const tierConfig = this.throttleConfig?.tiers?.[tier];

    if (tierConfig) {
      return Promise.resolve(tierConfig.limit);
    }

    // Fallback to global limit
    return Promise.resolve(this.throttleConfig?.global?.limit ?? 100);
  }

  /**
   * Get TTL based on user tier
   */
  protected getTtl(context: ExecutionContext): Promise<number> {
    const tier = this.getTier(context);
    const tierConfig = this.throttleConfig?.tiers?.[tier];

    if (tierConfig) {
      return Promise.resolve(tierConfig.ttl);
    }

    // Fallback to global TTL
    return Promise.resolve(this.throttleConfig?.global?.ttl ?? 60000);
  }

  /**
   * Get tracker key for rate limiting
   * Uses user ID for authenticated requests, IP for anonymous
   */
  protected override getTracker(req: Request): Promise<string> {
    const user = req.user;

    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }

    // Fall back to IP address
    return Promise.resolve(this.getClientIp(req));
  }

  /**
   * Determine user tier from context
   */
  private getTier(context: ExecutionContext): RateLimitTier {
    // Check for explicit tier decorator
    const tierFromDecorator = this.reflector.getAllAndOverride<RateLimitTier>(RATE_LIMIT_TIER, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (tierFromDecorator) {
      return tierFromDecorator;
    }

    // Check request for user info
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // Check for internal service token
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Service ')) {
      return 'internal';
    }

    // Check user tier from JWT
    if (user?.tier) {
      return user.tier;
    }

    // Check for premium role
    if (user?.roles?.includes('premium')) {
      return 'premium';
    }

    // Authenticated user
    if (user) {
      return 'authenticated';
    }

    // Default to anonymous
    return 'anonymous';
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    // Check X-Forwarded-For header (for proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket address
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Skip throttling for certain conditions
   */
  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Skip for localhost in development
    if (this.throttleConfig?.skipIf?.localhost) {
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  }
}
