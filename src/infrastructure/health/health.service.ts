import { Injectable, Inject, Optional } from '@nestjs/common';
import * as os from 'os';
import {
  type IHealthIndicator,
  type HealthCheckResult,
  HEALTH_INDICATORS,
} from '@core/domain/ports/services';

/**
 * Health Check Status
 */
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

/**
 * Individual Health Check Detail
 */
export interface HealthCheckDetail {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Overall Health Response
 */
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version?: string;
  checks: HealthCheckDetail[];
}

/**
 * Deep Health Response
 */
export interface DeepHealthResponse extends HealthResponse {
  system: {
    platform: string;
    nodeVersion: string;
    processId: number;
    hostname: string;
  };
}

/**
 * Health Service
 *
 * Aggregates health indicators and provides comprehensive health status.
 *
 * Section 12.3: Health Checks
 */
@Injectable()
export class HealthService {
  private readonly startupTime: Date;
  private startupComplete = false;

  constructor(
    @Optional()
    @Inject(HEALTH_INDICATORS)
    private readonly healthIndicators: IHealthIndicator[] = [],
  ) {
    this.startupTime = new Date();
  }

  /**
   * Mark startup as complete
   */
  markStartupComplete(): void {
    this.startupComplete = true;
  }

  /**
   * Check if startup is complete
   */
  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startupTime.getTime()) / 1000);
  }

  /**
   * Simple liveness check
   * Only checks if process is responsive
   */
  checkLiveness(): { status: 'healthy'; timestamp: string; uptime: number } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    };
  }

  /**
   * Startup check
   */
  checkStartup(): { status: 'healthy' | 'unhealthy'; timestamp: string; startupComplete: boolean } {
    return {
      status: this.startupComplete ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      startupComplete: this.startupComplete,
    };
  }

  /**
   * Readiness check
   * Checks all critical health indicators
   */
  async checkReadiness(): Promise<HealthResponse> {
    const checks = await this.runHealthChecks();
    const status = this.determineOverallStatus(checks, true);

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      checks,
    };
  }

  /**
   * Deep health check
   * Checks all health indicators with detailed system info
   */
  async checkDeepHealth(): Promise<DeepHealthResponse> {
    const checks = await this.runHealthChecks();
    const status = this.determineOverallStatus(checks, false);

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.APP_VERSION || process.env.npm_package_version,
      checks,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        processId: process.pid,
        hostname: os.hostname(),
      },
    };
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<HealthCheckDetail[]> {
    if (!this.healthIndicators || this.healthIndicators.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      this.healthIndicators.map(async (indicator) => {
        const result = await indicator.check();
        return this.toHealthCheckDetail(indicator.name, result);
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Handle failed check
      const indicator = this.healthIndicators[index];
      return {
        name: indicator?.name || `indicator-${index}`,
        status: 'unhealthy',
        message: result.reason instanceof Error ? result.reason.message : 'Check failed',
      };
    });
  }

  /**
   * Convert HealthCheckResult to HealthCheckDetail
   */
  private toHealthCheckDetail(name: string, result: HealthCheckResult): HealthCheckDetail {
    return {
      name,
      status: result.status,
      latency: result.latency,
      message: result.message,
      metadata: result.metadata,
    };
  }

  /**
   * Determine overall status from checks
   */
  private determineOverallStatus(checks: HealthCheckDetail[], criticalOnly: boolean): HealthStatus {
    if (checks.length === 0) {
      return 'healthy';
    }

    const relevantChecks = criticalOnly
      ? checks.filter((_, index) => this.healthIndicators[index]?.isCritical)
      : checks;

    const hasUnhealthy = relevantChecks.some((c) => c.status === 'unhealthy');
    const hasDegraded = relevantChecks.some((c) => c.status === 'degraded');

    if (hasUnhealthy) {
      return 'unhealthy';
    }

    if (hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }
}
