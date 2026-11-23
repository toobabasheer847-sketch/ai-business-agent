import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import { ExceptionService } from './exception.service';

class AssignExceptionDto {
  @IsUUID()
  userId!: string;
}

class StatusExceptionDto {
  @IsIn(['acknowledged', 'in_progress'])
  status!: 'acknowledged' | 'in_progress';
}

class ResolveExceptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class DismissExceptionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('exceptions')
export class ExceptionController {
  constructor(private readonly exceptions: ExceptionService) {}

  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    return this.exceptions.summary(req.user.tenantId);
  }

  @Get('attention')
  attention(@Req() req: AuthenticatedRequest) {
    return this.exceptions.attention(req.user.tenantId);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
  ) {
    return this.exceptions.list(req.user.tenantId, {
      page,
      limit,
      search,
      category,
      severity,
      status,
      assignedTo,
      from,
      to,
      sort,
    });
  }

  @Post('detect')
  detect(@Req() req: AuthenticatedRequest) {
    return this.exceptions.detect(req.user.tenantId, 'manual');
  }

  @Get(':id')
  find(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exceptions.detail(req.user.tenantId, id);
  }

  @Patch(':id/acknowledge')
  acknowledge(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exceptions.acknowledge(req.user.tenantId, req.user.userId, id);
  }

  @Patch(':id/assign')
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignExceptionDto,
  ) {
    return this.exceptions.assign(req.user.tenantId, id, dto.userId);
  }

  @Patch(':id/status')
  status(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusExceptionDto,
  ) {
    return this.exceptions.changeStatus(
      req.user.tenantId,
      req.user.userId,
      id,
      dto.status,
    );
  }

  @Patch(':id/resolve')
  resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveExceptionDto,
  ) {
    return this.exceptions.resolve(
      req.user.tenantId,
      req.user.userId,
      id,
      dto.note,
    );
  }

  @Patch(':id/dismiss')
  dismiss(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissExceptionDto,
  ) {
    return this.exceptions.dismiss(
      req.user.tenantId,
      req.user.userId,
      id,
      dto.reason,
    );
  }
}
