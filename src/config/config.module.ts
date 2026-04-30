import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from './env.schema';

/**
 * Global config module. Loads `.env`, validates with Zod, exposes a typed
 * ConfigService<Env, true> across the app.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => validateEnv(raw),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}

/** Typed alias for ConfigService used everywhere. */
export type AppConfigService = ConfigService<Env, true>;
