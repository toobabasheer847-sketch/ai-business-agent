import type { AuthenticatedUser } from '../../modules/auth/types/auth.types';

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
    }
  }
}
