import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';

jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    constructor(public options: any) {}
  }

  class MockGemini {
    constructor(public options: any) {}
  }

  class MockInMemoryRunner {
    constructor(public options: any) {}

    async *runEphemeral() {
      return undefined;
    }
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
    InMemoryRunner: MockInMemoryRunner,
    RoutedAgent: class MockRoutedAgent {
      name = 'master_agent';
      constructor(public options: any) {}
    },
  };
});

import {
  AUTHENTICATED_TEST_USER,
  createJwtTestModule,
  signTestJwt,
} from '../http-jwt-test.util';
import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';

async function initChatTestApp(
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

describe('MasterAgentController', () => {
  let app: INestApplication;
  let masterAgentService: {
    getAgent: jest.Mock;
    invoke: jest.Mock;
    listAssistantConversations: jest.Mock;
    getAssistantConversationMessages: jest.Mock;
    deleteAssistantConversation: jest.Mock;
  };

  beforeEach(async () => {
    masterAgentService = {
      getAgent: jest.fn().mockReturnValue({ name: 'master_agent' }),
      invoke: jest.fn().mockResolvedValue({
        conversationId: CONVERSATION_ID,
        response: 'Here are your tasks...',
        delegation: 'task',
      }),
      listAssistantConversations: jest.fn().mockResolvedValue([]),
      getAssistantConversationMessages: jest.fn().mockResolvedValue([]),
      deleteAssistantConversation: jest.fn().mockResolvedValue(undefined),
    };

    app = await initChatTestApp(
      createJwtTestModule({
        controllers: [MasterAgentController],
        providers: [{ provide: MasterAgentService, useValue: masterAgentService }],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /ai/master/status', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(app.getHttpServer()).get('/ai/master/status').expect(401);

      expect(masterAgentService.getAgent).not.toHaveBeenCalled();
    });

    it('returns status with a valid JWT', async () => {
      const token = signTestJwt(app);

      const response = await request(app.getHttpServer())
        .get('/ai/master/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        agent: 'master_agent',
      });
      expect(masterAgentService.getAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /ai/chat', () => {
    it('returns 401 when no JWT is provided', async () => {
      await request(app.getHttpServer())
        .post('/ai/chat')
        .send({ message: 'Show me my tasks' })
        .expect(401);

      expect(masterAgentService.invoke).not.toHaveBeenCalled();
    });

    it('returns 400 when message is missing', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(masterAgentService.invoke).not.toHaveBeenCalled();
    });

    it('returns 400 when message is empty', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '   ' })
        .expect(400);

      expect(masterAgentService.invoke).not.toHaveBeenCalled();
    });

    it('invokes the Master Agent without conversationId and uses JWT tenant and user', async () => {
      const token = signTestJwt(app);

      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Show me my tasks' })
        .expect(200);

      expect(response.body).toEqual({
        conversationId: CONVERSATION_ID,
        response: 'Here are your tasks...',
        delegation: 'task',
      });
      expect(masterAgentService.invoke).toHaveBeenCalledTimes(1);
      expect(masterAgentService.invoke).toHaveBeenCalledWith(
        AUTHENTICATED_TEST_USER.tenantId,
        AUTHENTICATED_TEST_USER.userId,
        'Show me my tasks',
        undefined,
      );
    });

    it('accepts an optional conversationId UUID', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Follow up',
          conversationId: CONVERSATION_ID,
        })
        .expect(200);

      expect(masterAgentService.invoke).toHaveBeenCalledWith(
        AUTHENTICATED_TEST_USER.tenantId,
        AUTHENTICATED_TEST_USER.userId,
        'Follow up',
        CONVERSATION_ID,
      );
    });

    it('returns 400 when conversationId is not a UUID', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Follow up',
          conversationId: 'not-a-uuid',
        })
        .expect(400);

      expect(masterAgentService.invoke).not.toHaveBeenCalled();
    });

    it('cannot override the authenticated tenant with a body tenantId', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Show me my tasks',
          tenantId: 'tenant-attacker',
        })
        .expect(400);

      expect(masterAgentService.invoke).not.toHaveBeenCalled();
    });
  });

  describe('GET /ai/conversations', () => {
    it('lists only the authenticated user conversations', async () => {
      const token = signTestJwt(app);

      await request(app.getHttpServer())
        .get('/ai/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        masterAgentService.listAssistantConversations,
      ).toHaveBeenCalledWith(
        AUTHENTICATED_TEST_USER.tenantId,
        AUTHENTICATED_TEST_USER.userId,
      );
    });
  });
});
