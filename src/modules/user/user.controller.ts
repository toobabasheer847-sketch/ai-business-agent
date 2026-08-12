import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  private getUser(req: Request): AuthenticatedUser {
    return req.user as AuthenticatedUser;
  }

  /**
   * POST /api/users
   * Create a user within the authenticated tenant.
   * tenantId comes from the JWT — never from the request body.
   * Password is hashed; passwordHash is never returned.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateUserDto,
  ) {
    return this.userService.create(this.getUser(req).tenantId, dto);
  }

  /**
   * GET /api/users
   * List users for the authenticated tenant.
   * Optional filters: isActive, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: UserQueryDto,
  ) {
    return this.userService.findAll(this.getUser(req).tenantId, query);
  }

  /**
   * GET /api/users/:id
   * Get a single user by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.userService.findOne(this.getUser(req).tenantId, id);
  }

  /**
   * PATCH /api/users/:id
   * Update a user (tenant-scoped). Password is optional and re-hashed when provided.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(this.getUser(req).tenantId, id, dto);
  }

  /**
   * DELETE /api/users/:id
   * Delete a user (tenant-scoped). Cannot delete your own account.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = this.getUser(req);
    return this.userService.remove(user.tenantId, user.userId, id);
  }
}
