import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../domain/users';

export const ROLES_KEY = 'roles';

/** Marks a route as requiring at least one of the listed roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
