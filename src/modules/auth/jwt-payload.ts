import type { Rol } from './domain/users';

/** Shape of the signed JWT payload. */
export interface JwtPayload {
  sub: string; // user id
  username: string;
  nombres: string;
  roles: Rol[];
  iat?: number;
  exp?: number;
}

/** Authenticated user attached to req by JwtStrategy. */
export interface AuthUser {
  id: string;
  username: string;
  nombres: string;
  roles: Rol[];
}
