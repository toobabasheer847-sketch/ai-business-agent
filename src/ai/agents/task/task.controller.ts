import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../../modules/auth/types/auth.types.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto.js';
import { ForbidUnknownDto } from './dto/forbid-unknown.dto.js';
import { ProcessNaturalLanguageDto } from './dto/process-natural-language.dto.js';
import { RescheduleTaskReminderDto } from './dto/reschedule-task-reminder.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TaskAnalyticsQueryDto } from './dto/task-analytics-query.dto.js';
import { TaskAnalyticsTrendsQueryDto } from './dto/task-analytics-trends-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskService } from './task.service.js';

@Controller('ai/task')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.taskService.createTask(dto, context);
  }

  @Get()
  async list(@Query() dto: TaskQueryDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildContext(req);
    return this.taskService.listTasks(dto, context);
  }

  @Get('analytics/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="task-analytics.csv"')
  async exportAnalytics(
    @Query() dto: TaskAnalyticsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.exportAnalyticsCsv(dto, context);
  }

  @Get('analytics/trends')
  async analyticsTrends(
    @Query() dto: TaskAnalyticsTrendsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getAnalyticsTrends(dto, context);
  }

  @Get('analytics')
  async analytics(
    @Query() dto: TaskAnalyticsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getAnalytics(dto, context);
  }

  @Get('report')
  async report(
    @Query() dto: TaskAnalyticsTrendsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getReport(dto, context);
  }

  @Post('natural-language')
  async handleNaturalLanguage(
    @Body() dto: ProcessNaturalLanguageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.processNaturalLanguage(dto.message, context);
  }

  @Get(':taskId/activity')
  async activity(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: PaginationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getTaskActivity(taskId, query, context);
  }

  @Get(':taskId/dependencies')
  async listDependencies(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getTaskDependencies(taskId, context);
  }

  @Post(':taskId/dependencies')
  async createDependency(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskDependencyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.addTaskDependency(
      taskId,
      dto.dependsOnTaskId,
      context,
    );
  }

  @Delete(':taskId/dependencies/:dependsOnTaskId')
  @HttpCode(HttpStatus.OK)
  async removeDependency(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('dependsOnTaskId', ParseUUIDPipe) dependsOnTaskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.removeTaskDependency(
      taskId,
      dependsOnTaskId,
      context,
    );
  }

  @Get(':taskId/reminders')
  async reminders(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() _query: ForbidUnknownDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getTaskReminders(taskId, context);
  }

  @Post(':taskId/reminders/enable')
  async enableReminders(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() _body: ForbidUnknownDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.enableTaskReminders(taskId, context);
  }

  @Post(':taskId/reminders/disable')
  async disableReminders(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() _body: ForbidUnknownDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.disableTaskReminders(taskId, context);
  }

  @Post(':taskId/reminders/reschedule')
  async rescheduleReminders(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: RescheduleTaskReminderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.rescheduleTaskReminder(
      taskId,
      dto.scheduledAt,
      context,
    );
  }

  @Get(':taskId')
  async get(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.getTask(taskId, context);
  }

  @Post(':taskId')
  async update(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.updateTask(taskId, dto, context);
  }

  @Post(':taskId/complete')
  async complete(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.completeTask(taskId, context);
  }

  @Post(':taskId/cancel')
  async cancel(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.cancelTask(taskId, context);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const context = this.buildContext(req);
    return this.taskService.deleteTask(taskId, context);
  }

  private buildContext(req: AuthenticatedRequest) {
    const user = req.user;

    if (!user?.tenantId || !user?.userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
    };
  }
}
