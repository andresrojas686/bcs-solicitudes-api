import { Inject, Injectable } from '@nestjs/common';
import {
  type ListarSolicitudesQuery,
  type ListarSolicitudesResult,
  SOLICITUD_REPOSITORY,
  type SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';

@Injectable()
export class ListarSolicitudesUseCase {
  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
  ) {}

  async execute(query: ListarSolicitudesQuery): Promise<ListarSolicitudesResult> {
    const page = Math.max(1, query.page);
    const size = Math.min(100, Math.max(1, query.size));
    return this.repo.listar({ ...query, page, size });
  }
}
