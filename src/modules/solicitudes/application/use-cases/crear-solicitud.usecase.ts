import { Inject, Injectable } from '@nestjs/common';
import { Solicitud, type ClienteRef } from '../../domain/entities/solicitud.entity';
import {
  SOLICITUD_REPOSITORY,
  type SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';
import { ok, type Result } from '../../../../shared/kernel/result';
import type { DomainError } from '../../../../shared/kernel/domain-error';
import { MetricsService } from '../../../../shared/observability/metrics.service';

export interface CrearSolicitudInput {
  cliente: ClienteRef;
  productoCodigo: string;
  datosFormulario?: Record<string, unknown>;
  correlationId: string;
  idempotencyKey?: string;
  actor: string;
}

@Injectable()
export class CrearSolicitudUseCase {
  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
    private readonly metrics: MetricsService,
  ) {}

  async execute(input: CrearSolicitudInput): Promise<Result<Solicitud, DomainError>> {
    // Idempotency: si ya existe una solicitud con la misma key, devolverla.
    if (input.idempotencyKey) {
      const existing = await this.repo.buscarPorIdempotencyKey(input.idempotencyKey);
      if (existing) return ok(existing);
    }

    const solicitud = Solicitud.crear(input);
    await this.repo.guardar(solicitud);
    this.metrics.recordSolicitudCreada(solicitud.productoCodigo);
    return ok(solicitud);
  }
}
