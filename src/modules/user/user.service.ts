import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async create(tenantId: string, dto: CreateUserDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const role = this.authorization.assertCreatableRole(actor, dto.role);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await this.userRepository.create({
      tenantId,
      name: dto.name.trim(),
      email,
      passwordHash,
      isActive: dto.isActive ?? true,
      role,
    });
    await this.authorization.writeAudit({
      tenantId,
      actorUserId: actor.userId,
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      description: `Created ${role} user.`,
    });
    return created;
  }

  async findAll(tenantId: string, query: UserQueryDto) {
    return this.userRepository.findAllByTenant(tenantId, {
      isActive: query.isActive,
      search: query.search,
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const existing = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    await this.authorization.assertRoleAssignment(actor, existing, dto.role, dto.isActive);

    let email: string | undefined;
    if (dto.email !== undefined) {
      email = dto.email.trim().toLowerCase();
      if (email !== existing.email) {
        const duplicate = await this.userRepository.findByEmail(email);
        if (duplicate) {
          throw new ConflictException('Email already registered.');
        }
      }
    }

    let passwordHash: string | undefined;
    if (dto.password !== undefined) {
      passwordHash = await argon2.hash(dto.password);
    }

    const updated = await this.userRepository.update(id, tenantId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      email,
      passwordHash,
      isActive: dto.isActive,
      role: dto.role,
    });

    if (dto.role && dto.role !== existing.role) {
      await this.authorization.writeAudit({
        tenantId,
        actorUserId: actor.userId,
        action: 'user.role_changed',
        entityType: 'user',
        entityId: id,
        description: `Role changed from ${existing.role} to ${dto.role}.`,
      });
    }
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.authorization.writeAudit({
        tenantId,
        actorUserId: actor.userId,
        action: dto.isActive ? 'user.activated' : 'user.deactivated',
        entityType: 'user',
        entityId: id,
        description: dto.isActive ? 'User activated.' : 'User deactivated.',
      });
    }
    return updated;
  }

  async remove(tenantId: string, actor: AuthenticatedUser, id: string) {
    const existing = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!existing) {
      throw new NotFoundException('User not found.');
    }
    if (existing.id === actor.userId) {
      throw new BadRequestException('You cannot delete your own user account.');
    }

    await this.authorization.assertCanRemove(actor, existing);
    await this.userRepository.delete(id, tenantId);
    await this.authorization.writeAudit({
      tenantId,
      actorUserId: actor.userId,
      action: 'user.removed',
      entityType: 'user',
      entityId: id,
      description: 'User removed from the tenant.',
    });
    return { message: 'User deleted successfully.', id };
  }
}
