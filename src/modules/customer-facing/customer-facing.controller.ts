import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { CustomerChatRateLimitGuard } from './customer-facing.rate-limit';
import { CustomerFacingService } from './customer-facing.service';

class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

class DetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requirements?: string;
}

class AssignDto {
  @IsUUID()
  userId!: string;
}

class NoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

class SettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  leadCaptureEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  handoffNotificationsEnabled?: boolean;

  @IsOptional()
  @IsUUID()
  knowledgeBaseId?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsBoolean()
  collectName?: boolean;

  @IsOptional()
  @IsBoolean()
  collectEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  collectPhone?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accent?: string;
}

function sessionToken(request: { header: (name: string) => string | undefined }) {
  return request.header('x-customer-session') ?? '';
}

@Controller('public/customer-chat')
@UseGuards(CustomerChatRateLimitGuard)
export class PublicCustomerChatController {
  constructor(private readonly customer: CustomerFacingService) {}

  @Get(':publicKey')
  @Header('Cache-Control', 'private, no-store')
  bootstrap(@Param('publicKey') publicKey: string) {
    return this.customer.bootstrap(publicKey);
  }

  @Post(':publicKey/sessions')
  @Header('Cache-Control', 'private, no-store')
  start(@Param('publicKey') publicKey: string) {
    return this.customer.start(publicKey);
  }

  @Get(':publicKey/messages')
  @Header('Cache-Control', 'private, no-store')
  history(@Param('publicKey') _publicKey: string, @Req() request: { header: (name: string) => string | undefined }) {
    return this.customer.history(_publicKey, sessionToken(request));
  }

  @Post(':publicKey/messages')
  @Header('Cache-Control', 'private, no-store')
  send(
    @Param('publicKey') _publicKey: string,
    @Req() request: { header: (name: string) => string | undefined },
    @Body() body: MessageDto,
  ) {
    return this.customer.send(_publicKey, sessionToken(request), body.content);
  }

  @Post(':publicKey/details')
  @Header('Cache-Control', 'private, no-store')
  details(
    @Param('publicKey') _publicKey: string,
    @Req() request: { header: (name: string) => string | undefined },
    @Body() body: DetailsDto,
  ) {
    return this.customer.details(_publicKey, sessionToken(request), body);
  }

  @Post(':publicKey/handoff')
  @Header('Cache-Control', 'private, no-store')
  handoff(@Param('publicKey') _publicKey: string, @Req() request: { header: (name: string) => string | undefined }) {
    return this.customer.requestHuman(_publicKey, sessionToken(request));
  }

  @Post(':publicKey/end')
  @Header('Cache-Control', 'private, no-store')
  end(@Param('publicKey') _publicKey: string, @Req() request: { header: (name: string) => string | undefined }) {
    return this.customer.end(_publicKey, sessionToken(request));
  }
}

@Controller('customer-ai')
@UseGuards(JwtAuthGuard)
export class CustomerAiController {
  constructor(private readonly customer: CustomerFacingService) {}

  @Get('conversations')
  conversations(@Req() request: AuthenticatedRequest, @Query('status') status?: string) {
    return this.customer.list(this.actor(request), status);
  }

  @Get('conversations/:id')
  conversation(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.customer.detail(this.actor(request), id);
  }

  @Post('conversations/:id/assign')
  assign(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: AssignDto) {
    return this.customer.assign(this.actor(request), id, body.userId);
  }

  @Post('conversations/:id/resolve')
  resolve(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.customer.resolve(this.actor(request), id);
  }

  @Post('conversations/:id/reopen')
  reopen(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.customer.reopen(this.actor(request), id);
  }

  @Post('conversations/:id/notes')
  note(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: NoteDto) {
    return this.customer.note(this.actor(request), id, body.content);
  }

  @Get('settings')
  settings(@Req() request: AuthenticatedRequest) {
    return this.customer.getSettings(this.actor(request));
  }

  @Patch('settings')
  updateSettings(@Req() request: AuthenticatedRequest, @Body() body: SettingsDto) {
    return this.customer.updateSettings(this.actor(request), body);
  }

  private actor(request: AuthenticatedRequest) {
    return { tenantId: request.user.tenantId, userId: request.user.userId, role: request.user.role };
  }
}
