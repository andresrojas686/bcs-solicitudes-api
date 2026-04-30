import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../jwt-payload';

/** @CurrentUser() injects the authenticated user (set by JwtStrategy.validate). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user;
  },
);
