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
import { PhoneNumberService } from './phone-number.service';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { UpdatePhoneNumberDto } from './dto/update-phone-number.dto';
import { PhoneNumberQueryDto } from './dto/phone-number-query.dto';
import { AvailablePhoneNumbersQueryDto } from './dto/available-phone-numbers-query.dto';
import { BuyPhoneNumberDto } from './dto/buy-phone-number.dto';

@UseGuards(JwtAuthGuard)
@Controller('phone-numbers')
export class PhoneNumberController {
  constructor(
    private readonly phoneNumberService: PhoneNumberService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as AuthenticatedUser).tenantId;
  }

  /**
   * POST /api/phone-numbers
   * Register a new phone number for the authenticated tenant.
   * tenantId is always taken from the JWT — never from the body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() dto: CreatePhoneNumberDto,
  ) {
    return this.phoneNumberService.create(this.getTenantId(req), dto);
  }

  /**
   * POST /api/phone-numbers/buy
   * Purchase a Twilio number, configure inbound webhooks, then save it for
   * the authenticated tenant. Declared before parameterized routes for clarity.
   */
  @Post('buy')
  @HttpCode(HttpStatus.CREATED)
  async buy(
    @Req() req: Request,
    @Body() dto: BuyPhoneNumberDto,
  ) {
    return this.phoneNumberService.buy(this.getTenantId(req), dto);
  }

  /**
   * GET /api/phone-numbers
   * List all phone numbers for the authenticated tenant.
   * Optional filters: provider, status, search.
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query() query: PhoneNumberQueryDto,
  ) {
    return this.phoneNumberService.findAll(this.getTenantId(req), query);
  }

  /**
   * GET /api/phone-numbers/available
   * Search Twilio inventory for numbers available to buy.
   * MUST be registered before GET :id so "available" is not parsed as a UUID.
   */
  @Get('available')
  async searchAvailable(
    @Req() req: Request,
    @Query() query: AvailablePhoneNumbersQueryDto,
  ) {
    return this.phoneNumberService.searchAvailable(this.getTenantId(req), query);
  }

  /**
   * GET /api/phone-numbers/:id
   * Get a single phone number by UUID (tenant-scoped).
   */
  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.phoneNumberService.findOne(this.getTenantId(req), id);
  }

  /**
   * PATCH /api/phone-numbers/:id
   * Update a phone number (tenant-scoped). All fields optional.
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhoneNumberDto,
  ) {
    return this.phoneNumberService.update(this.getTenantId(req), id, dto);
  }

  /**
   * DELETE /api/phone-numbers/:id
   * Delete a phone number. Cascades to linked Twilio Apps.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.phoneNumberService.remove(this.getTenantId(req), id);
  }
}
