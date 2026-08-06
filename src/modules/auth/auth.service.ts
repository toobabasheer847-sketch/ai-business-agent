import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthenticatedUser,
  JwtPayload,
  RegisterResponse,
} from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = dto.email.trim().toLowerCase();

    const existingUser =
      await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new UnauthorizedException(
        'Email already registered',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const { tenant, user } =
      await this.authRepository.createTenantAndUser({
        tenantName: dto.tenantName.trim(),
        name: dto.name.trim(),
        email,
        passwordHash,
      });

    const accessToken = this.generateToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },

      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user =
      await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'User account is inactive',
      );
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash ?? '',
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const accessToken = this.generateToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },

      accessToken,
    };
  }

  async validateUser(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const user =
      await this.authRepository.findUserById(userId);

    if (!user || !user.isActive) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    };
  }

  private generateToken(
    payload: JwtPayload,
  ): string {
    const secret =
      this.configService.get<string>(
        'JWT_SECRET',
      ) ?? 'development-secret';

    const expiresIn =
      this.configService.get<string>(
        'JWT_EXPIRES_IN',
        '1d',
      );

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: expiresIn as any,
    } as any);
  }
}