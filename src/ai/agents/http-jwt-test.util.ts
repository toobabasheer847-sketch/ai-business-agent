import { INestApplication, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModuleBuilder } from '@nestjs/testing';

import { AuthService } from '../../modules/auth/auth.service';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import type { AuthenticatedUser } from '../../modules/auth/types/auth.types';

export const JWT_TEST_SECRET = 'phase1-test-jwt-secret';

export const AUTHENTICATED_TEST_USER: AuthenticatedUser = {
  userId: 'user-jwt-1',
  tenantId: 'tenant-jwt-1',
  email: 'jwt-user@example.com',
  name: 'JWT Test User',
};

export function signTestJwt(
  app: INestApplication,
  payload: { sub: string; tenantId: string; email: string } = {
    sub: AUTHENTICATED_TEST_USER.userId,
    tenantId: AUTHENTICATED_TEST_USER.tenantId,
    email: AUTHENTICATED_TEST_USER.email,
  },
): string {
  return app.get(JwtService).sign(payload, { secret: JWT_TEST_SECRET });
}

export function createJwtTestModule(options: {
  controllers: Type<unknown>[];
  providers?: Provider[];
}): TestingModuleBuilder {
  return Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: JWT_TEST_SECRET,
        signOptions: { expiresIn: '1h' },
      }),
    ],
    controllers: options.controllers,
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: string) => {
            if (key === 'JWT_SECRET') {
              return JWT_TEST_SECRET;
            }
            return fallback;
          },
        },
      },
      {
        provide: AuthService,
        useValue: {
          validateUser: jest.fn().mockResolvedValue(AUTHENTICATED_TEST_USER),
        },
      },
      JwtStrategy,
      ...(options.providers ?? []),
    ],
  });
}

export async function initTestApp(
  builder: TestingModuleBuilder,
): Promise<INestApplication> {
  const module = await builder.compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}
