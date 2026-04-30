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

@Injectable()
export class ConsultarSolicitudUseCase {
  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
  ) {}

  async execute(id: string): Promise<Result<Solicitud, DomainError>> {
    const solicitud = await this.repo.buscarPorId(id);
    if (!solicitud) return err(new SolicitudNotFoundError(id));
    return ok(solicitud);
  }
}
