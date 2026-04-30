import { Inject, Injectable } from '@nestjs/common';
import type { Solicitud } from '../../domain/entities/solicitud.entity';
import type { EstadoSolicitudValue } from '../../domain/value-objects/estado-solicitud.vo';
import {
  SOLICITUD_REPOSITORY,
  type SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';
import { err, ok, type Result } from '../../../../shared/kernel/result';
import {
  type DomainError,
  SolicitudNotFoundError,
} from '../../../../shared/kernel/domain-error';
import { MetricsService } from '../../../../shared/observability/metrics.service';

export interface TransicionarSolicitudInput {
  id: string;
  target: Extract<EstadoSolicitudValue, 'APPROVED' | 'REJECTED' | 'ABANDONED'>;
  actor: string;
  motivo?: string;
}

/**
 * Use case genérico para transiciones de aprobar / rechazar / abandonar.
 * `finalizar` (que llama al Core) tiene su propio use case porque tiene
 * lógica de integración asociada.
 */
@Injectable()
export class TransicionarSolicitudUseCase {
  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
    private readonly metrics: MetricsService,
  ) {}

  async execute(input: TransicionarSolicitudInput): Promise<Result<Solicitud, DomainError>> {
    const solicitud = await this.repo.buscarPorId(input.id);
    if (!solicitud) return err(new SolicitudNotFoundError(input.id));

    const previousEstado = solicitud.estado.value;
    const r = solicitud.transicionar(input.target, input.actor, input.motivo);
    if (!r.ok) return err(r.error);

    await this.repo.guardar(solicitud);
    this.metrics.recordCambioEstado(previousEstado, solicitud.estado.value);
    return ok(solicitud);
  }
}
