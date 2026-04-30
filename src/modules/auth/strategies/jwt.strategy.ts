import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../../config/env.schema';
import type { AuthUser, JwtPayload } from '../jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /** Returned object becomes `req.user`. */
  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      username: payload.username,
      nombres: payload.nombres,
      roles: payload.roles,
    };
  }
}
