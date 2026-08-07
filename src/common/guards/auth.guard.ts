import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { JwtPayload } from '../../modules/auth/types/auth.types';
import type { AuthenticatedUser } from '../../modules/auth/types/auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'development-secret'),
      });

      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
        name: (payload as any).name ?? '',
      } as AuthenticatedUser;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
