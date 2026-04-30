import type { Solicitud } from '../entities/solicitud.entity';
import type { EstadoSolicitudValue } from '../value-objects/estado-solicitud.vo';

export interface ListarSolicitudesQuery {
  estado?: EstadoSolicitudValue;
  clienteNumDoc?: string;
  page: number;
  size: number;
}

export interface ListarSolicitudesResult {
  items: Solicitud[];
  total: number;
  page: number;
  size: number;
}

/** Port toward Solicitud persistence. Implemented in infrastructure (Mongo). */
export interface SolicitudRepositoryPort {
  guardar(solicitud: Solicitud): Promise<void>;
  buscarPorId(id: string): Promise<Solicitud | null>;
  buscarPorIdempotencyKey(key: string): Promise<Solicitud | null>;
  listar(query: ListarSolicitudesQuery): Promise<ListarSolicitudesResult>;
}

export const SOLICITUD_REPOSITORY = Symbol('SolicitudRepositoryPort');
