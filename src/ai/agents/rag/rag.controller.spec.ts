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
  };
});

import {
  AUTHENTICATED_TEST_USER,
  createJwtTestModule,
  initTestApp,
  signTestJwt,
} from '../http-jwt-test.util';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

describe('RagController', () => {
  let app: INestApplication;
  let ragService: { query: jest.Mock };

  beforeEach(async () => {
    ragService = {
      query: jest.fn().mockResolvedValue({
        answer: 'Acme refunds unused credits within 30 days.',
        sources: [],
        usedKnowledge: true,
      }),
    };

    app = await initTestApp(
      createJwtTestModule({
        controllers: [RagController],
        providers: [{ provide: RagService, useValue: ragService }],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when no JWT is provided', async () => {
    await request(app.getHttpServer())
      .post('/ai/rag/query')
      .send({ query: 'What is our refund policy?' })
      .expect(401);

    expect(ragService.query).not.toHaveBeenCalled();
  });

  it('allows access with a valid JWT', async () => {
    const token = signTestJwt(app);

    await request(app.getHttpServer())
      .post('/ai/rag/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'What is our refund policy?' })
      .expect(201);

    expect(ragService.query).toHaveBeenCalledTimes(1);
  });

  it('cannot override the authenticated tenant with dto.tenantId', async () => {
    const token = signTestJwt(app);
    const attackerTenantId = 'tenant-attacker';

    await request(app.getHttpServer())
      .post('/ai/rag/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: 'What is our refund policy?',
        tenantId: attackerTenantId,
      })
      .expect(201);

    expect(ragService.query).toHaveBeenCalledTimes(1);
    expect(ragService.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'What is our refund policy?',
        tenantId: attackerTenantId,
      }),
      AUTHENTICATED_TEST_USER.tenantId,
    );

    const [, tenantFromAuth] = ragService.query.mock.calls[0];
    expect(tenantFromAuth).toBe(AUTHENTICATED_TEST_USER.tenantId);
    expect(tenantFromAuth).not.toBe(attackerTenantId);
  });
});
