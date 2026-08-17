import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  AUTHENTICATED_TEST_USER,
  createJwtTestModule,
  initTestApp,
  signTestJwt,
} from '../http-jwt-test.util';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

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
  };

  beforeEach(async () => {
    taskService = {
      updateTask: jest.fn().mockResolvedValue({ id: 'updated' }),
      processNaturalLanguage: jest.fn().mockResolvedValue({
        action: 'create',
        message: 'Task created successfully.',
      }),
      createTask: jest.fn(),
      listTasks: jest.fn(),
      getTask: jest.fn(),
      completeTask: jest.fn(),
      cancelTask: jest.fn(),
    };

    app = await initTestApp(
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

  it('still routes POST /ai/task/:taskId to updateTask', async () => {
    const token = signTestJwt(app);
    const taskId = '11111111-1111-1111-1111-111111111111';

    await request(app.getHttpServer())
      .post(`/ai/task/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' })
      .expect(201);

    expect(taskService.updateTask).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({ title: 'Updated title' }),
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
      }),
    );
    expect(taskService.processNaturalLanguage).not.toHaveBeenCalled();
  });
});
