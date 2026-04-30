import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Env } from '../../config/env.schema';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Health endpoints:
 *   - GET /health        liveness  (proceso vivo, no valida dependencias)
 *   - GET /health/ready  readiness (valida Atlas + core-mock)
 */
@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongooseHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  liveness() {
    return { status: 'ok', service: 'bcs-solicitudes-api', ts: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    const coreMockUrl = this.config.get('CORE_MOCK_URL', { infer: true });
    return this.health.check([
      () => this.mongo.pingCheck('mongo', { timeout: 3000 }),
      () => this.http.pingCheck('core-mock', `${coreMockUrl}/health`, { timeout: 3000 }),
    ]);
  }
}
