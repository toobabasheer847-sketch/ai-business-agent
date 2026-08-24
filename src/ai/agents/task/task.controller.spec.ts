import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';

import {
  AUTHENTICATED_TEST_USER,
  createJwtTestModule,
  signTestJwt,
} from '../http-jwt-test.util';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

const TASK_ID = '11111111-1111-4111-8111-111111111111';

async function initTaskTestApp(
  builder: TestingModuleBuilder,
): Promise<INestApplication> {
  const module = await builder.compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('TaskController', () => {
  let app: INestApplication;
  let taskService: {
    updateTask: jest.Mock;
    processNaturalLanguage: jest.Mock;
    createTask: jest.Mock;
    listTasks: jest.Mock;
    getTask: jest.Mock;
    completeTask: jest.Mock;
    cancelTask: jest.Mock;
    deleteTask: jest.Mock;
    getTaskActivity: jest.Mock;
    getTaskReminders: jest.Mock;
    enableTaskReminders: jest.Mock;
    disableTaskReminders: jest.Mock;
    rescheduleTaskReminder: jest.Mock;
    getAnalytics: jest.Mock;
    getAnalyticsTrends: jest.Mock;
    getReport: jest.Mock;
    exportAnalyticsCsv: jest.Mock;
    addTaskDependency: jest.Mock;
    removeTaskDependency: jest.Mock;
    getTaskDependencies: jest.Mock;
  };

  beforeEach(async () => {
    taskService = {
      updateTask: jest.fn().mockResolvedValue({ id: 'updated' }),
      processNaturalLanguage: jest.fn().mockResolvedValue({
        action: 'create',
        message: 'Task created successfully.',
      }),
      createTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
      listTasks: jest.fn().mockResolvedValue([]),
      getTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
      completeTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
      cancelTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
      deleteTask: jest.fn().mockResolvedValue({
        message: 'Task deleted successfully',
        id: TASK_ID,
      }),
      getTaskActivity: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        activities: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
      getTaskReminders: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        reminders: [],
      }),
      enableTaskReminders: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        reminders: [],
      }),
      disableTaskReminders: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        reminders: [],
      }),
      rescheduleTaskReminder: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        reminders: [],
      }),
      getAnalytics: jest.fn().mockResolvedValue({
        summary: { total: 0 },
        completionRate: 0,
        overdueRate: 0,
      }),
      getAnalyticsTrends: jest.fn().mockResolvedValue({
        groupBy: 'day',
        trends: [],
      }),
      getReport: jest.fn().mockResolvedValue({
        summary: { total: 0 },
        trends: [],
      }),
      exportAnalyticsCsv: jest.fn().mockResolvedValue(
        'Title,Status,Priority,Due date,Completed date,Company,Prospect,Lead,Assignee,Reminder status,Created date\r\n',
      ),
      addTaskDependency: jest.fn().mockResolvedValue({ id: 'dep' }),
      removeTaskDependency: jest.fn().mockResolvedValue({ message: 'ok' }),
      getTaskDependencies: jest.fn().mockResolvedValue({
        taskId: TASK_ID,
        isBlocked: false,
        dependsOn: [],
        dependents: [],
      }),
    };

    app = await initTaskTestApp(
      createJwtTestModule({
        controllers: [TaskController],
        providers: [{ provide: TaskService, useValue: taskService }],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 for natural-language without a JWT', async () => {
    await request(app.getHttpServer())
      .post('/ai/task/natural-language')
      .send({ message: 'Create a task to follow up tomorrow.' })
      .expect(401);

    expect(taskService.processNaturalLanguage).not.toHaveBeenCalled();
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it('routes POST /ai/task/natural-language to the NL handler, not :taskId', async () => {
    const token = signTestJwt(app);
    const message = 'Create a task to follow up with ABC tomorrow.';

    const response = await request(app.getHttpServer())
      .post('/ai/task/natural-language')
      .set('Authorization', `Bearer ${token}`)
      .send({ message })
      .expect(201);

    expect(response.body).toEqual({
      action: 'create',
      message: 'Task created successfully.',
    });

    expect(taskService.processNaturalLanguage).toHaveBeenCalledTimes(1);
    expect(taskService.processNaturalLanguage).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        userId: AUTHENTICATED_TEST_USER.userId,
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        email: AUTHENTICATED_TEST_USER.email,
      }),
    );

    expect(taskService.updateTask).not.toHaveBeenCalled();
    expect(taskService.updateTask).not.toHaveBeenCalledWith(
      'natural-language',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not trust tenantId from the natural-language body', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post('/ai/task/natural-language')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Create a task to follow up tomorrow.',
        tenantId: 'tenant-attacker',
      })
      .expect(400);

    expect(taskService.processNaturalLanguage).not.toHaveBeenCalled();
  });

  it('still routes POST /ai/task/:taskId to updateTask', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' })
      .expect(201);

    expect(taskService.updateTask).toHaveBeenCalledWith(
      TASK_ID,
      expect.objectContaining({ title: 'Updated title' }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
    expect(taskService.processNaturalLanguage).not.toHaveBeenCalled();
  });

  it('rejects body tenantId and createdBy on create', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post('/ai/task')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Call Ahmed',
        tenantId: 'tenant-attacker',
        createdBy: 'user-attacker',
      })
      .expect(400);

    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  it('creates a task using JWT tenant and user', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post('/ai/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Call Ahmed' })
      .expect(201);

    expect(taskService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Call Ahmed' }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('accepts optional CRM ids on create without tenantId or createdBy', async () => {
    const token = signTestJwt(app);
    const companyId = '22222222-2222-4222-8222-222222222222';

    await request(app.getHttpServer())
      .post('/ai/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Follow up with ABC', companyId })
      .expect(201);

    expect(taskService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Follow up with ABC', companyId }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('lists with a companyId filter from the query string', async () => {
    const token = signTestJwt(app);
    const companyId = '22222222-2222-4222-8222-222222222222';

    await request(app.getHttpServer())
      .get('/ai/task')
      .query({ companyId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ companyId }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('lists with overdue and due window filters without accepting tenantId', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task')
      .query({
        overdue: 'true',
        dueFrom: '2026-08-20T00:00:00.000Z',
        dueTo: '2026-08-20T23:59:59.999Z',
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        overdue: true,
        dueFrom: '2026-08-20T00:00:00.000Z',
        dueTo: '2026-08-20T23:59:59.999Z',
      }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('rejects tenantId and createdBy on list query', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task')
      .query({ tenantId: 'tenant-attacker', createdBy: 'user-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(taskService.listTasks).not.toHaveBeenCalled();
  });

  it('returns 401 for list without a JWT', async () => {
    await request(app.getHttpServer()).get('/ai/task').expect(401);
    expect(taskService.listTasks).not.toHaveBeenCalled();
  });

  it('rejects an invalid taskId UUID', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(taskService.getTask).not.toHaveBeenCalled();
  });

  it('rejects invalid priority, status, and dueAt', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post('/ai/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Call Ahmed', priority: 'critical' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/ai/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Call Ahmed', dueAt: 'tomorrow' })
      .expect(400);

    expect(taskService.createTask).not.toHaveBeenCalled();
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it('deletes an authorized task', async () => {
    const token = signTestJwt(app);

    const response = await request(app.getHttpServer())
      .delete(`/ai/task/${TASK_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      message: 'Task deleted successfully',
      id: TASK_ID,
    });
    expect(taskService.deleteTask).toHaveBeenCalledWith(
      TASK_ID,
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('returns 401 for activity without a JWT', async () => {
    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/activity`)
      .expect(401);

    expect(taskService.getTaskActivity).not.toHaveBeenCalled();
  });

  it('loads activity with JWT tenant and user', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/activity`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.getTaskActivity).toHaveBeenCalledWith(
      TASK_ID,
      expect.anything(),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('rejects tenantId, createdBy, and actorUserId query fields on activity', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/activity`)
      .query({ tenantId: 'other-tenant', createdBy: 'other-user', actorUserId: 'spoof' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(taskService.getTaskActivity).not.toHaveBeenCalled();
  });

  it('returns 401 for reminders without a JWT', async () => {
    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/reminders`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/reminders/enable`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/reminders/disable`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/reminders/reschedule`)
      .send({ scheduledAt: '2026-08-22T04:30:00.000Z' })
      .expect(401);

    expect(taskService.getTaskReminders).not.toHaveBeenCalled();
    expect(taskService.enableTaskReminders).not.toHaveBeenCalled();
  });

  it('loads reminders with JWT tenant and user', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/reminders`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.getTaskReminders).toHaveBeenCalledWith(
      TASK_ID,
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('rejects tenantId and createdBy on reminder queries and bodies', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/reminders`)
      .query({ tenantId: 'other-tenant', createdBy: 'other-user' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/reminders/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheduledAt: '2026-08-22T04:30:00.000Z',
        tenantId: 'other-tenant',
        createdBy: 'spoof',
      })
      .expect(400);

    expect(taskService.getTaskReminders).not.toHaveBeenCalled();
    expect(taskService.rescheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('rejects an invalid reminder datetime', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/reminders/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledAt: 'tomorrow' })
      .expect(400);

    expect(taskService.rescheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('returns 401 for analytics without a JWT', async () => {
    await request(app.getHttpServer()).get('/ai/task/analytics').expect(401);
    await request(app.getHttpServer()).get('/ai/task/analytics/trends').expect(401);
    await request(app.getHttpServer()).get('/ai/task/analytics/export').expect(401);
    await request(app.getHttpServer()).get('/ai/task/report').expect(401);
    expect(taskService.getAnalytics).not.toHaveBeenCalled();
    expect(taskService.getAnalyticsTrends).not.toHaveBeenCalled();
    expect(taskService.exportAnalyticsCsv).not.toHaveBeenCalled();
    expect(taskService.getReport).not.toHaveBeenCalled();
  });

  it('routes GET /ai/task/analytics with JWT tenant and user, not query ownership fields', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task/analytics')
      .query({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-22T23:59:59.999Z',
        status: 'pending',
        priority: 'high',
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.getAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-22T23:59:59.999Z',
        status: 'pending',
        priority: 'high',
      }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('rejects tenantId, createdBy, and userId query injection on analytics', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task/analytics')
      .query({ tenantId: 'tenant-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/analytics')
      .query({ createdBy: 'user-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/analytics')
      .query({ userId: 'user-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/analytics/trends')
      .query({ tenantId: 'tenant-attacker', groupBy: 'day' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/analytics/export')
      .query({ tenantId: 'tenant-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/report')
      .query({ createdBy: 'user-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/ai/task/analytics/export')
      .query({ userId: 'user-attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(taskService.getAnalytics).not.toHaveBeenCalled();
    expect(taskService.getAnalyticsTrends).not.toHaveBeenCalled();
    expect(taskService.exportAnalyticsCsv).not.toHaveBeenCalled();
    expect(taskService.getReport).not.toHaveBeenCalled();
  });

  it('routes CSV export and report with JWT tenant and user', async () => {
    const token = signTestJwt(app);

    const exportResponse = await request(app.getHttpServer())
      .get('/ai/task/analytics/export')
      .query({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-22T23:59:59.999Z',
        status: 'pending',
        priority: 'high',
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(exportResponse.headers['content-type']).toMatch(/text\/csv/);
    expect(taskService.exportAnalyticsCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-01T00:00:00.000Z',
        status: 'pending',
        priority: 'high',
      }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );

    await request(app.getHttpServer())
      .get('/ai/task/report')
      .query({ groupBy: 'week' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.getReport).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'week' }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );
  });

  it('rejects invalid trend grouping', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .get('/ai/task/analytics/trends')
      .query({ groupBy: 'year' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(taskService.getAnalyticsTrends).not.toHaveBeenCalled();
  });

  it('routes dependency endpoints with JWT context', async () => {
    const token = signTestJwt(app);
    const dependsOnTaskId = '22222222-2222-4222-8222-222222222222';

    await request(app.getHttpServer())
      .post(`/ai/task/${TASK_ID}/dependencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dependsOnTaskId })
      .expect(201);

    expect(taskService.addTaskDependency).toHaveBeenCalledWith(
      TASK_ID,
      dependsOnTaskId,
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    );

    await request(app.getHttpServer())
      .get(`/ai/task/${TASK_ID}/dependencies`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.getTaskDependencies).toHaveBeenCalledWith(
      TASK_ID,
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/ai/task/${TASK_ID}/dependencies/${dependsOnTaskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(taskService.removeTaskDependency).toHaveBeenCalledWith(
      TASK_ID,
      dependsOnTaskId,
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
      }),
    );
  });
});
