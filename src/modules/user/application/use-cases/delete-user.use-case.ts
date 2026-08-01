import { Inject, Injectable } from '@nestjs/common';
import { BaseUseCase, type UseCaseContext, Result } from '@core/application/base';
import type { IUnitOfWork } from '@core/domain/ports/repositories';
import { type ILogger, LOGGER, UNIT_OF_WORK } from '@core/domain/ports/services';
import { EntityNotFoundException } from '@core/domain/base';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { UserDeletedEvent } from '../../domain/events/user-deleted.event';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

/**
 * Delete User Input
 */
export interface DeleteUserInput {
  id: string;
  hardDelete?: boolean; // If true, permanently delete. Default: soft delete
}

/**
 * Delete User Output
 */
export interface DeleteUserOutput {
  id: string;
  deleted: boolean;
  deletedAt: Date;
}

/**
 * Delete User Use Case
 *
 * Soft deletes or permanently removes a user.
 *
 * Section 2.2: Application Layer - UseCase for delete operation
 */
@Injectable()
export class DeleteUserUseCase extends BaseUseCase<DeleteUserInput, DeleteUserOutput> {
  constructor(
    @Inject(LOGGER) logger: ILogger,
    @Inject(UNIT_OF_WORK) unitOfWork: IUnitOfWork,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super(logger, unitOfWork);
  }

  protected async executeImpl(
    input: DeleteUserInput,
    context?: UseCaseContext,
  ): Promise<Result<DeleteUserOutput>> {
    try {
      const tenantId = context?.tenantId;
      const actorId = context?.userId;

      if (!tenantId) {
        return Result.fail(new Error('Tenant ID is required'));
      }

      // Prevent self-deletion
      if (actorId === input.id) {
        return Result.fail(new Error('Cannot delete your own account'));
      }

      // Find existing user
      const user = await this.userRepository.findById(input.id);
      if (!user) {
        return Result.fail(new EntityNotFoundException('User', input.id));
      }

      // Verify user belongs to tenant
      if (user.tenantId !== tenantId) {
        return Result.fail(new EntityNotFoundException('User', input.id));
      }

      // Check if already deleted
      if (user.status === UserStatus.DELETED) {
        return Result.fail(new Error('User is already deleted'));
      }

      const deletedAt = new Date();

      if (input.hardDelete) {
        // Hard delete - permanently remove from database
        const deleted = await this.userRepository.delete(input.id);
        if (!deleted) {
          return Result.fail(new Error('Failed to delete user'));
        }
      } else {
        // Soft delete - mark as deleted
        user.changeStatus(UserStatus.DELETED);
        await this.userRepository.save(user);

        // Add deletion event
        const event = new UserDeletedEvent(user.id, user.tenantId, false);
        this.unitOfWork.addDomainEvents([event]);
      }

      return Result.ok({
        id: input.id,
        deleted: true,
        deletedAt,
      });
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
