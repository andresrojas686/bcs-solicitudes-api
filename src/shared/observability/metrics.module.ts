import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import {
  CORE_BANKING_DURATION,
  SOLICITUDES_CREADAS,
  SOLICITUDES_ESTADO_ACTUAL,
} from './metrics.constants';
import { MetricsService } from './metrics.service';

/**
 * Métricas custom de negocio + endpoint /metrics expuesto por @willsoto/nestjs-prometheus.
 *
 *   - solicitudes_creadas_total{producto}                  counter
 *   - solicitudes_estado_actual{estado}                    gauge (sample tras cada update)
 *   - core_banking_request_duration_seconds{endpoint,status} histogram
 */

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      // path por defecto: /metrics (no protegido — para scrape de Prometheus)
    }),
  ],
  providers: [
    makeCounterProvider({
      name: SOLICITUDES_CREADAS,
      help: 'Número total de solicitudes creadas por producto',
      labelNames: ['producto'] as const,
    }),
    makeGaugeProvider({
      name: SOLICITUDES_ESTADO_ACTUAL,
      help: 'Cantidad de solicitudes en cada estado (sample tras cada cambio)',
      labelNames: ['estado'] as const,
    }),
    makeHistogramProvider({
      name: CORE_BANKING_DURATION,
      help: 'Duración de las llamadas al Core Bancario via Mulesoft',
      labelNames: ['endpoint', 'status'] as const,
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    }),
    MetricsService,
  ],
  exports: [PrometheusModule, MetricsService],
})
export class MetricsModule {}
