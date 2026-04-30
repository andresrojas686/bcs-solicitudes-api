/**
 * Anti-corruption layer: maps Mulesoft response DTOs → domain types.
 * If the Core ever changes its shape, only this file changes.
 */
import type {
  AperturaProductoResponse,
  ClienteCore,
  ProductoElegible,
} from '../../domain/ports/core-banking.port';

/** Raw shapes as exposed by the Mulesoft mock (matches openapi/core-banking.yaml). */
export interface MulesoftClienteDto {
  tipoDoc: string;
  numDoc: string;
  nombres: string;
  apellidos: string;
  contacto: { email: string; telefono: string };
  kycStatus: string;
}

export interface MulesoftProductosElegiblesDto {
  clienteNumDoc: string;
  productos: Array<{ codigo: string; nombre: string; tipo: string }>;
}

export interface MulesoftAperturaResponseDto {
  numeroProducto: string;
  estado: string;
  creadoEn: string;
}

export interface MulesoftProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
  correlationId?: string;
}

export function mapCliente(dto: MulesoftClienteDto): ClienteCore {
  return {
    tipoDoc: dto.tipoDoc as ClienteCore['tipoDoc'],
    numDoc: dto.numDoc,
    nombres: dto.nombres,
    apellidos: dto.apellidos,
    contacto: dto.contacto,
    kycStatus: dto.kycStatus as ClienteCore['kycStatus'],
  };
}

export function mapProductosElegibles(
  dto: MulesoftProductosElegiblesDto,
): ProductoElegible[] {
  return dto.productos.map((p) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    tipo: p.tipo as ProductoElegible['tipo'],
  }));
}

export function mapAperturaResponse(
  dto: MulesoftAperturaResponseDto,
): AperturaProductoResponse {
  return {
    numeroProducto: dto.numeroProducto,
    estado: 'ACTIVO',
    creadoEn: new Date(dto.creadoEn),
  };
}
