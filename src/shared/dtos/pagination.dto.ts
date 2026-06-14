import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Field, InputType, ObjectType, Int } from '@nestjs/graphql';
import { PAGINATION } from '@shared/constants';

/**
 * Pagination Query DTO
 *
 * Used for paginated list endpoints (REST & GraphQL).
 */
@InputType('PaginationInput')
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
  })
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PAGINATION.DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: PAGINATION.MAX_LIMIT,
    default: PAGINATION.DEFAULT_LIMIT,
  })
  @Field(() => Int, { nullable: true, defaultValue: PAGINATION.DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION.MAX_LIMIT)
  limit?: number = PAGINATION.DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @Field({ nullable: true, defaultValue: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Pagination Meta Response
 */
@ObjectType('PaginationMeta')
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  @Field(() => Int)
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  @Field(() => Int)
  limit!: number;

  @ApiProperty({ description: 'Total number of items' })
  @Field(() => Int)
  totalItems!: number;

  @ApiProperty({ description: 'Total number of pages' })
  @Field(() => Int)
  totalPages!: number;

  @ApiProperty({ description: 'Has next page' })
  @Field()
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Has previous page' })
  @Field()
  hasPrevPage!: boolean;
}
