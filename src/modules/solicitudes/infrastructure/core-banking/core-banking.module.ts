import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CORE_BANKING_PORT } from '../../domain/ports/core-banking.port';
import { MulesoftAdapter } from './mulesoft.adapter';
import type { Env } from '../../../../config/env.schema';

/**
 * Provides MulesoftAdapter as the implementation of CoreBankingPort.
 * Configuration comes from validated env vars.
 */
@Module({
  providers: [
    {
      provide: CORE_BANKING_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new MulesoftAdapter({
          baseUrl: config.get('CORE_MOCK_URL', { infer: true }),
          timeoutMs: config.get('CORE_BANKING_TIMEOUT_MS', { infer: true }),
          maxRetries: config.get('CORE_BANKING_MAX_RETRIES', { infer: true }),
          // Allowlist for SSRF mitigation. Update for production hosts.
          allowedHosts: ['localhost:4001', 'api.mulesoft.bcs.co'],
        }),
    },
  ],
  exports: [CORE_BANKING_PORT],
})
export class CoreBankingModule {}
