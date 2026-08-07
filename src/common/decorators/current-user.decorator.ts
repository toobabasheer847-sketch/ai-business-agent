import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserField = 'user' | 'userId' | 'tenantId' | 'email' | 'name';

export const CurrentUser = createParamDecorator(
  (field: CurrentUserField = 'user', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as Record<string, unknown> | undefined;

    if (!user) {
      return null;
    }

    if (field === 'user') {
      return user;
    }

    return user[field];
  },
);
