import { Inject, Injectable } from '@nestjs/common';
import type { Solicitud } from '../../domain/entities/solicitud.entity';
import {
  SOLICITUD_REPOSITORY,
  type SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';
import { err, ok, type Result } from '../../../../shared/kernel/result';
import {
  type DomainError,
  SolicitudNotFoundError,
} from '../../../../shared/kernel/domain-error';

export interface ActualizarSolicitudInput {
  id: string;
  datosFormulario?: Record<string, unknown>;
  /** Si true, transiciona DRAFT → IN_REVIEW al guardar. */
  enviarARevision?: boolean;
  actor: string;
}

@Injectable()
export class ActualizarSolicitudUseCase {
  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
  ) {}

  async execute(input: ActualizarSolicitudInput): Promise<Result<Solicitud, DomainError>> {
    const solicitud = await this.repo.buscarPorId(input.id);
    if (!solicitud) return err(new SolicitudNotFoundError(input.id));

    if (input.datosFormulario) {
      const r = solicitud.actualizarDatos(input.datosFormulario);
      if (!r.ok) return err(r.error);
    }
    if (input.enviarARevision) {
      const r = solicitud.transicionar('IN_REVIEW', input.actor, 'Enviada a revisión');
      if (!r.ok) return err(r.error);
    }

    await this.repo.guardar(solicitud);
    return ok(solicitud);
  }
}
