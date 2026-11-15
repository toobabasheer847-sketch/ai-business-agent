import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';

import { AuthorizationInterceptor } from './authorization.interceptor';

function httpContext(className: string, handlerName: string, user?: { userId?: string; tenantId?: string; role?: string }) {
  const handler = function routeHandler() {
    return undefined;
  };
  Object.defineProperty(handler, 'name', { value: handlerName });
  return {
    getType: () => 'http',
    getClass: () => ({ name: className }),
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('AuthorizationInterceptor', () => {
  const interceptor = new AuthorizationInterceptor({ getAllAndOverride: () => undefined } as never);
  const next = { handle: () => of(true) };

  it('returns 401 when a protected route has no authenticated user', () => {
    expect(() => interceptor.intercept(httpContext('TenantController', 'update') as never, next))
      .toThrow(UnauthorizedException);
  });

  it('returns 403 when the authenticated user has no role', () => {
    expect(() => interceptor.intercept(
      httpContext('DashboardController', 'overview', { userId: 'u1', tenantId: 't1' }) as never,
      next,
    )).toThrow(ForbiddenException);
  });

  it('returns 403 when a member calls an owner route', () => {
    expect(() => interceptor.intercept(
      httpContext('TenantController', 'update', { userId: 'u1', tenantId: 't1', role: 'member' }) as never,
      next,
    )).toThrow(ForbiddenException);
  });

  it('allows an owner through an owner route', () => {
    expect(interceptor.intercept(
      httpContext('TenantController', 'update', { userId: 'u1', tenantId: 't1', role: 'owner' }) as never,
      next,
    )).toBeDefined();
  });

  it('allows a member through task routes that include own-record access', () => {
    expect(interceptor.intercept(
      httpContext('TaskController', 'list', { userId: 'u1', tenantId: 't1', role: 'member' }) as never,
      next,
    )).toBeDefined();
  });
});
