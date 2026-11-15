import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

import { PERMISSIONS_METADATA_KEY } from './permissions.decorator';
import { hasAnyPermission, isTenantRole, type PermissionName } from './permissions';
import { ROUTE_PERMISSIONS } from './route-permissions';
import type { AuthenticatedUser } from '../auth/types/auth.types';

@Injectable()
export class AuthorizationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const required = this.requiredPermissions(context);
    if (!required.length) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.userId || !user.tenantId) {
      throw new UnauthorizedException('Authentication is required');
    }

    if (!isTenantRole(user.role) || !hasAnyPermission(user.role, required)) {
      throw new ForbiddenException('You do not have permission for this action.');
    }

    return next.handle();
  }

  private requiredPermissions(context: ExecutionContext): PermissionName[] {
    const decorated = this.reflector.getAllAndOverride<PermissionName[] | undefined>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (decorated?.length) {
      return decorated;
    }

    const key = `${context.getClass().name}.${context.getHandler().name}`;
    return [...(ROUTE_PERMISSIONS[key] ?? [])];
  }
}
