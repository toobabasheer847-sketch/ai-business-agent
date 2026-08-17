import { INestApplication } from '@nestjs/common';
import request from 'supertest';

jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    name = 'communication_agent';
    constructor(public options: any) {}
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
  };
});

import {
  createJwtTestModule,
  initTestApp,
  signTestJwt,
} from '../http-jwt-test.util';
import { CommunicationAgentController } from './communication.controller';
import { CommunicationAgentService } from './communication.service';

describe('CommunicationAgentController', () => {
  let app: INestApplication;
  let communicationAgentService: { getAgent: jest.Mock };

  beforeEach(async () => {
    communicationAgentService = {
      getAgent: jest.fn().mockReturnValue({ name: 'communication_agent' }),
    };

    app = await initTestApp(
      createJwtTestModule({
        controllers: [CommunicationAgentController],
        providers: [
          {
            provide: CommunicationAgentService,
            useValue: communicationAgentService,
          },
        ],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when no JWT is provided', async () => {
    await request(app.getHttpServer())
      .get('/ai/communication/status')
      .expect(401);

    expect(communicationAgentService.getAgent).not.toHaveBeenCalled();
  });

  it('returns status with a valid JWT', async () => {
    const token = signTestJwt(app);

    const response = await request(app.getHttpServer())
      .get('/ai/communication/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      agent: 'communication_agent',
    });
    expect(communicationAgentService.getAgent).toHaveBeenCalledTimes(1);
  });
});
