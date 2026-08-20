import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { KnowledgebaseRepository } from './knowledgebase.repository';
import { CreateKnowledgebaseDto } from './dto/create-knowledgebase.dto';
import { UpdateKnowledgebaseDto } from './dto/update-knowledgebase.dto';
import { KnowledgeFileStorage } from './knowledge-file.storage';

@Injectable()
export class KnowledgebaseService {
  constructor(
    private readonly knowledgebaseRepository: KnowledgebaseRepository,
    private readonly knowledgeFileStorage: KnowledgeFileStorage,
  ) {}

  async create(tenantId: string, dto: CreateKnowledgebaseDto) {
    const name = dto.name.trim();

    const existing = await this.knowledgebaseRepository.findByNameAndTenant(
      name,
      tenantId,
    );

    if (existing) {
      throw new ConflictException(
        'A knowledgebase with this name already exists for your tenant.',
      );
    }

    return this.knowledgebaseRepository.create({
      tenantId,
      name,
      description: dto.description?.trim() || undefined,
    });
  }

  async findAll(tenantId: string, search?: string) {
    return this.knowledgebaseRepository.findAllByTenant(tenantId, search);
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.knowledgebaseRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!row) {
      throw new NotFoundException('Knowledgebase not found.');
    }

    return row;
  }

  async update(tenantId: string, id: string, dto: UpdateKnowledgebaseDto) {
    const existing = await this.knowledgebaseRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Knowledgebase not found.');
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (name.length === 0) {
        throw new ConflictException('Knowledgebase name cannot be empty.');
      }

      if (name !== existing.name) {
        const duplicate = await this.knowledgebaseRepository.findByNameAndTenant(
          name,
          tenantId,
        );

        if (duplicate) {
          throw new ConflictException(
            'A knowledgebase with this name already exists for your tenant.',
          );
        }
      }
    }

    return this.knowledgebaseRepository.update(id, tenantId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      description:
        dto.description !== undefined
          ? (dto.description.trim() || null)
          : undefined,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.knowledgebaseRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!existing) {
      throw new NotFoundException('Knowledgebase not found.');
    }

    await this.knowledgebaseRepository.delete(id, tenantId);
    await this.knowledgeFileStorage.removeKnowledgeBaseDir(tenantId, id);

    return {
      message: 'Knowledgebase deleted successfully.',
      id,
    };
  }
}
