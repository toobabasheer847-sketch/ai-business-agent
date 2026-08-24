import { BadRequestException, INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  AUTHENTICATED_TEST_USER,
  createJwtTestModule,
  initTestApp,
  signTestJwt,
} from '../../http-jwt-test.util';
import { GmailController } from './gmail.controller';
import { GmailOauthStateService } from './gmail-oauth-state.service';
import { GmailRepository } from './gmail.repository';
import { GmailService } from './gmail.service';
import { AppLogger } from '../../../../infrastructure/logging/logger.service';

describe('GmailController OAuth state', () => {
  let app: INestApplication;
  let oauthStateService: {
    create: jest.Mock;
    consume: jest.Mock;
  };
  let gmailService: {
    getAuthorizationUrl: jest.Mock;
    exchangeCode: jest.Mock;
    getAuthenticatedEmail: jest.Mock;
  };
  let gmailRepository: {
    findByTenantAndEmail: jest.Mock;
    create: jest.Mock;
    updateTokens: jest.Mock;
  };

  beforeEach(async () => {
    oauthStateService = {
      create: jest.fn().mockResolvedValue('server-generated-state'),
      consume: jest.fn().mockResolvedValue({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        userId: AUTHENTICATED_TEST_USER.userId,
      }),
    };
    gmailService = {
      getAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=server-generated-state'),
      exchangeCode: jest.fn().mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        expiry_date: Date.now() + 3600_000,
      }),
      getAuthenticatedEmail: jest.fn().mockResolvedValue('user@example.com'),
    };
    gmailRepository = {
      findByTenantAndEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'config-1',
        email: 'user@example.com',
      }),
      updateTokens: jest.fn(),
    };

    app = await initTestApp(
      createJwtTestModule({
        controllers: [GmailController],
        providers: [
          { provide: GmailService, useValue: gmailService },
          { provide: GmailRepository, useValue: gmailRepository },
          { provide: GmailOauthStateService, useValue: oauthStateService },
          {
            provide: AppLogger,
            useValue: { log: jest.fn(), warn: jest.fn() },
          },
        ],
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('issues a server-generated state bound to the JWT tenant/user and ignores client state', async () => {
    const token = signTestJwt(app);

    const response = await request(app.getHttpServer())
      .get('/google/auth')
      .query({ state: 'tenant:attacker:user:attacker' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(oauthStateService.create).toHaveBeenCalledWith(
      AUTHENTICATED_TEST_USER.tenantId,
      AUTHENTICATED_TEST_USER.userId,
    );
    expect(gmailService.getAuthorizationUrl).toHaveBeenCalledWith(
      'server-generated-state',
    );
    expect(response.body.authorizationUrl).toContain('server-generated-state');
  });

  it('rejects a callback with a missing state', async () => {
    oauthStateService.consume.mockRejectedValue(
      new BadRequestException('OAuth state is required'),
    );

    await request(app.getHttpServer())
      .get('/google/auth/callback')
      .query({ code: 'auth-code' })
      .expect(400);

    expect(gmailService.exchangeCode).not.toHaveBeenCalled();
  });

  it('rejects a callback with an invalid state', async () => {
    oauthStateService.consume.mockRejectedValue(
      new BadRequestException('Invalid OAuth state'),
    );

    await request(app.getHttpServer())
      .get('/google/auth/callback')
      .query({ code: 'auth-code', state: 'forged-state' })
      .expect(400);

    expect(gmailService.exchangeCode).not.toHaveBeenCalled();
  });

  it('binds the Gmail config to the stored initiating tenant, not a different context', async () => {
    oauthStateService.consume.mockResolvedValue({
      tenantId: AUTHENTICATED_TEST_USER.tenantId,
      userId: AUTHENTICATED_TEST_USER.userId,
    });

    const response = await request(app.getHttpServer())
      .get('/google/auth/callback')
      .query({ code: 'auth-code', state: 'valid-state' })
      .expect(200);

    expect(gmailRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: AUTHENTICATED_TEST_USER.tenantId,
        email: 'user@example.com',
      }),
    );
    expect(response.body.tenantId).toBe(AUTHENTICATED_TEST_USER.tenantId);
    expect(response.body.userId).toBe(AUTHENTICATED_TEST_USER.userId);
  });
});
