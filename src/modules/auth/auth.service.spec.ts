import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authRepository = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createTenantAndUser: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt-token'),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') {
        return 'test-secret';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '7d';
      }
      return fallback;
    }),
  };

  const service = new AuthService(
    authRepository as any,
    jwtService as any,
    configService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a tenant and user with JWT', async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);
    authRepository.createTenantAndUser.mockResolvedValue({
      tenant: { id: 'tenant-1', name: 'Acme' },
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        name: 'Owner',
        email: 'owner@example.com',
        isActive: true,
      },
    });

    const result = await service.register({
      tenantName: 'Acme',
      name: 'Owner',
      email: 'owner@example.com',
      password: 'StrongPass!123',
    });

    expect(result.accessToken).toBe('signed-jwt-token');
    expect(result.user.tenantId).toBe('tenant-1');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        tenantId: 'tenant-1',
        email: 'owner@example.com',
      }),
      expect.any(Object),
    );
  });

  it('rejects duplicate registration emails', async () => {
    authRepository.findUserByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        tenantName: 'Acme',
        name: 'Owner',
        email: 'owner@example.com',
        password: 'StrongPass!123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await argon2.hash('StrongPass!123');
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      name: 'Owner',
      email: 'owner@example.com',
      passwordHash,
      isActive: true,
    });

    const result = await service.login({
      email: 'owner@example.com',
      password: 'StrongPass!123',
    });

    expect(result.accessToken).toBe('signed-jwt-token');
    expect(result.user.tenantId).toBe('tenant-1');
  });

  it('rejects invalid login credentials', async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'owner@example.com',
        password: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validates active users for JWT-protected routes', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      name: 'Owner',
      isActive: true,
    });

    await expect(service.validateUser('user-1')).resolves.toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      name: 'Owner',
    });
  });
});
