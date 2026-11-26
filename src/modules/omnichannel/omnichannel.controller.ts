import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CHANNELS, PURPOSES, type Channel, type Purpose } from './communication-rules';
import { OmnichannelService } from './omnichannel.service';

class OutboundDto {
  @IsIn(CHANNELS)
  channel!: Channel;

  @IsIn(PURPOSES)
  purpose!: Purpose;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  to!: string;

  @IsString()
  @MaxLength(4096)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(160)
  idempotencyKey!: string;

  @IsOptional()
  @IsUUID()
  fromPhoneNumberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromEmail?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsIn(['human', 'ai'])
  authorKind?: 'human' | 'ai';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTemplateRef?: string;
}

class PreferenceDto {
  @IsIn(['lead', 'prospect', 'company'])
  subjectType!: 'lead' | 'prospect' | 'company';

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsIn(['email', 'sms', 'whatsapp'])
  preferredChannel?: 'email' | 'sms' | 'whatsapp';

  @IsIn(['unknown', 'allowed', 'opted_out'])
  emailStatus!: 'unknown' | 'allowed' | 'opted_out';

  @IsIn(['unknown', 'allowed', 'opted_out'])
  smsStatus!: 'unknown' | 'allowed' | 'opted_out';

  @IsIn(['unknown', 'allowed', 'opted_out'])
  whatsappStatus!: 'unknown' | 'allowed' | 'opted_out';

  @IsIn(['unknown', 'granted', 'denied', 'withdrawn'])
  marketingConsent!: 'unknown' | 'granted' | 'denied' | 'withdrawn';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  marketingConsentSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  marketingEvidence?: string;

  @IsOptional()
  @IsBoolean()
  customerRequested?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  restrictions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsapp?: string;
}

class TemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(CHANNELS)
  channel!: Channel;

  @IsIn(PURPOSES)
  purpose!: Purpose;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTemplateRef?: string;
}

class CampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsIn(CHANNELS)
  channel!: Channel;

  @IsIn(PURPOSES)
  purpose!: Purpose;

  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  leadStatus?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

class DraftDto {
  @IsIn(CHANNELS)
  channel!: Channel;

  @IsIn(PURPOSES)
  purpose!: Purpose;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  excerpt?: string;
}

class AssignDto {
  @IsUUID()
  assignedUserId!: string;
}

class WhatsAppDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  phoneNumberId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  businessAccountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  accessToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  appSecret?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  verifyToken?: string;
}

class PolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietStartHour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietEndHour?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxAutomatedFollowUps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  followUpDelayMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  optOutConfirmationEnabled?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('communication-hub/engagement')
export class OmnichannelController {
  constructor(private readonly omnichannel: OmnichannelService) {}

  private actor(req: Request) {
    const user = req.user as AuthenticatedUser;
    return { tenantId: user.tenantId, userId: user.userId, role: user.role };
  }

  @Post('messages')
  send(@Req() req: Request, @Body() dto: OutboundDto) {
    return this.omnichannel.requestOutbound(this.actor(req), dto);
  }

  @Post('messages/:id/retry')
  retry(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.retry(this.actor(req), id);
  }

  @Post('messages/:id/cancel')
  cancel(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.cancel(this.actor(req), id);
  }

  @Get('preferences')
  preference(
    @Req() req: Request,
    @Query('subjectType') subjectType: string,
    @Query('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return this.omnichannel.getPreference(this.actor(req).tenantId, subjectType, subjectId);
  }

  @Put('preferences')
  savePreference(@Req() req: Request, @Body() dto: PreferenceDto) {
    return this.omnichannel.savePreference(this.actor(req), dto);
  }

  @Get('templates')
  templates(@Req() req: Request) {
    return this.omnichannel.listTemplates(this.actor(req).tenantId);
  }

  @Post('templates')
  saveTemplate(@Req() req: Request, @Body() dto: TemplateDto) {
    return this.omnichannel.saveTemplate(this.actor(req), dto);
  }

  @Get('campaigns')
  campaigns(@Req() req: Request) {
    return this.omnichannel.listCampaigns(this.actor(req).tenantId);
  }

  @Post('campaigns')
  createCampaign(@Req() req: Request, @Body() dto: CampaignDto) {
    return this.omnichannel.createCampaign(this.actor(req), dto);
  }

  @Post('campaigns/:id/start')
  startCampaign(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.startCampaign(this.actor(req), id);
  }

  @Post('campaigns/:id/pause')
  pauseCampaign(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.changeCampaign(this.actor(req), id, 'paused');
  }

  @Post('campaigns/:id/cancel')
  cancelCampaign(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.changeCampaign(this.actor(req), id, 'cancelled');
  }

  @Post('conversations/:id/assign')
  assign(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.omnichannel.assignConversation(this.actor(req), id, dto.assignedUserId);
  }

  @Post('conversations/:id/resolve')
  resolve(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.setConversationStatus(this.actor(req), id, 'resolved');
  }

  @Post('conversations/:id/reopen')
  reopen(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.omnichannel.setConversationStatus(this.actor(req), id, 'active');
  }

  @Post('drafts')
  draft(@Req() req: Request, @Body() dto: DraftDto) {
    return this.omnichannel.draft(this.actor(req), dto);
  }

  @Get('analytics')
  analytics(@Req() req: Request) {
    return this.omnichannel.analytics(this.actor(req).tenantId);
  }

  @Get('whatsapp')
  whatsapp(@Req() req: Request) {
    return this.omnichannel.whatsAppStatus(this.actor(req).tenantId);
  }

  @Put('whatsapp')
  saveWhatsapp(@Req() req: Request, @Body() dto: WhatsAppDto) {
    return this.omnichannel.saveWhatsApp(this.actor(req).tenantId, dto);
  }

  @Get('policy')
  policy(@Req() req: Request) {
    return this.omnichannel.policy(this.actor(req).tenantId);
  }

  @Put('policy')
  savePolicy(@Req() req: Request, @Body() dto: PolicyDto) {
    return this.omnichannel.savePolicy(this.actor(req), dto);
  }
}
