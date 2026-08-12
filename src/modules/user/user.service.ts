import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.userRepository.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email already registered.');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.userRepository.create({
      tenantId,
      name: dto.name.trim(),
      email,
      passwordHash,
      isActive: dto.isActive ?? true,
    });
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

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.userRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

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

    return this.userRepository.update(id, tenantId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      email,
      passwordHash,
      isActive: dto.isActive,
    });
  }

  async remove(tenantId: string, actorUserId: string, id: string) {
    const existing = await this.userRepository.findByIdAndTenant(id, tenantId);

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    if (existing.id === actorUserId) {
      throw new BadRequestException(
        'You cannot delete your own user account.',
      );
    }

    await this.userRepository.delete(id, tenantId);

    return {
      message: 'User deleted successfully.',
      id,
    };
  }
}
