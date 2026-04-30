import type { Solicitud } from '../../domain/entities/solicitud.entity';
import type {
  PaginatedSolicitudesResponseDto,
  SolicitudResponseDto,
} from './dto/solicitud-response.dto';

export function toSolicitudResponse(s: Solicitud): SolicitudResponseDto {
  return {
    id: s.id,
    cliente: { tipoDoc: s.cliente.tipoDoc, numDoc: s.cliente.numDoc },
    productoCodigo: s.productoCodigo,
    estado: s.estado.value,
    datosFormulario: s.datosFormulario,
    historicoEstados: s.historicoEstados.map((h) => ({
      estadoAnterior: h.estadoAnterior,
      estadoNuevo: h.estadoNuevo,
      actor: h.actor,
      motivo: h.motivo,
      timestamp: h.timestamp.toISOString(),
    })),
    correlationId: s.correlationId,
    numeroProducto: s.numeroProducto,
    motivoRechazo: s.motivoRechazo,
    pendienteEnvioCore: s.pendienteEnvioCore,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    version: s.version,
  };
}

export function toPaginatedResponse(input: {
  items: Solicitud[];
  total: number;
  page: number;
  size: number;
}): PaginatedSolicitudesResponseDto {
  return {
    items: input.items.map(toSolicitudResponse),
    total: input.total,
    page: input.page,
    size: input.size,
  };
}
