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
import { TwilioAppService } from './twilio-app.service';
import { CreateTwilioAppDto } from './dto/create-twilio-app.dto';
import { UpdateTwilioAppDto } from './dto/update-twilio-app.dto';
import { TwilioAppQueryDto } from './dto/twilio-app-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('twilio-apps')
export class TwilioAppController {
  constructor(
    private readonly twilioAppService: TwilioAppService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * POST /api/twilio-apps
   * Create a Twilio App linked to a phone number owned by the authenticated tenant.
   * tenantId comes from the JWT — never from the request body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreateTwilioAppDto,
  ) {
    return this.twilioAppService.create(this.getTenantId(req), dto);
  }

  /**
   * GET /api/twilio-apps
   * List Twilio Apps for the authenticated tenant.
   * Optional filters: phoneNumberId, status, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: TwilioAppQueryDto,
  ) {
    return this.twilioAppService.findAll(this.getTenantId(req), query);
  }

  /**
   * GET /api/twilio-apps/:id
   * Get a single Twilio App by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.twilioAppService.findOne(this.getTenantId(req), id);
  }

  /**
   * PATCH /api/twilio-apps/:id
   * Update a Twilio App (tenant-scoped).
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTwilioAppDto,
  ) {
    return this.twilioAppService.update(this.getTenantId(req), id, dto);
  }

  /**
   * DELETE /api/twilio-apps/:id
   * Delete a Twilio App (tenant-scoped).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.twilioAppService.remove(this.getTenantId(req), id);
  }
}
