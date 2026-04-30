import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import {
  CORE_BANKING_DURATION,
  SOLICITUDES_CREADAS,
  SOLICITUDES_ESTADO_ACTUAL,
} from './metrics.constants';

/**
 * Wrapper para emitir métricas de negocio. Usar este servicio en lugar de
 * inyectar los counters/gauges directamente — facilita el testing y el cambio
 * de backend de métricas si es necesario.
 */
@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(SOLICITUDES_CREADAS) private readonly solicitudesCreadas: Counter<'producto'>,
    @InjectMetric(SOLICITUDES_ESTADO_ACTUAL) private readonly solicitudesEstado: Gauge<'estado'>,
    @InjectMetric(CORE_BANKING_DURATION) private readonly coreDuration: Histogram<'endpoint' | 'status'>,
  ) {}

  recordSolicitudCreada(producto: string): void {
    this.solicitudesCreadas.inc({ producto });
  }

  recordCambioEstado(estadoAnterior: string, estadoNuevo: string): void {
    if (estadoAnterior !== estadoNuevo) {
      this.solicitudesEstado.dec({ estado: estadoAnterior });
    }
    this.solicitudesEstado.inc({ estado: estadoNuevo });
  }

  /** Devuelve el endTimer para llamarlo cuando termine la request al Core. */
  startCoreRequest(endpoint: string): (status: 'ok' | 'error') => void {
    const end = this.coreDuration.startTimer({ endpoint });
    return (status) => end({ status });
  }
}
