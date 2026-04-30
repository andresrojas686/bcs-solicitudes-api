import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../jwt-payload';
import type { Rol } from '../domain/users';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Usuario no autenticado');

    const has = user.roles.some((r) => required.includes(r));
    if (!has) {
      throw new ForbiddenException(
        `Se requiere uno de los roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
