import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuditAction } from '../../domain/entities/audit-log.entity';

/**
 * Audit Log Response DTO
 */
export class AuditLogResponseDto {
  @ApiProperty({ description: 'Audit log ID' })
  id!: string;

  @ApiProperty({ description: 'Action performed' })
  action!: AuditAction;

  @ApiProperty({ description: 'Type of entity' })
  entityType!: string;

  @ApiProperty({ description: 'Entity ID' })
  entityId!: string;

  @ApiPropertyOptional({ description: 'User who performed the action' })
  userId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Previous values', type: Object })
  oldValues?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'New values', type: Object })
  newValues?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Fields that changed', type: [String] })
  changedFields?: string[];

  @ApiPropertyOptional({ description: 'IP address' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', type: Object })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'When the action occurred' })
  createdAt!: Date;
}
