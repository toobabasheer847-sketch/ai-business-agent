import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface RegisterResponse {
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  tenant: {
    id: string;
    name: string;
  };
  accessToken: string;
}
