import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { findByUsername, verifyPassword } from './domain/users';
import type { JwtPayload } from './jwt-payload';
import type { Env } from '../../config/env.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(username: string, password: string) {
    const user = findByUsername(username);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      nombres: user.nombres,
      roles: user.roles,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      user: {
        id: user.id,
        username: user.username,
        nombres: user.nombres,
        roles: user.roles,
      },
    };
  }
}
