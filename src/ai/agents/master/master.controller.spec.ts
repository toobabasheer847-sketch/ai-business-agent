import { INestApplication } from '@nestjs/common';
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
  createJwtTestModule,
  initTestApp,
  signTestJwt,
} from '../http-jwt-test.util';
import { MasterAgentController } from './master.controller';
import { MasterAgentService } from './master.service';

describe('MasterAgentController', () => {
  let app: INestApplication;
  let masterAgentService: { getAgent: jest.Mock };

  beforeEach(async () => {
    masterAgentService = {
      getAgent: jest.fn().mockReturnValue({ name: 'master_agent' }),
    };

    app = await initTestApp(
      createJwtTestModule({
        controllers: [MasterAgentController],
        providers: [{ provide: MasterAgentService, useValue: masterAgentService }],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

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
