/**
 * Port (interface) toward the Core Banking system, exposed via Mulesoft.
 *
 * The domain depends on this abstraction. Infrastructure provides the concrete
 * implementation (`MulesoftAdapter`). This is the **anti-corruption boundary**:
 * types declared here are domain types, not Mulesoft DTOs.
 */
import type { Result } from '../../../../shared/kernel/result';
import type { DomainError } from '../../../../shared/kernel/domain-error';

export type TipoDocumento = 'CC' | 'CE' | 'NIT' | 'PAS' | 'TI';
export type KycStatus = 'APROBADO' | 'PENDIENTE' | 'RECHAZADO';
export type TipoProducto = 'CUENTA_AHORROS' | 'TARJETA_CREDITO' | 'CREDITO_LIBRE_INVERSION';

export interface ClienteCore {
  readonly tipoDoc: TipoDocumento;
  readonly numDoc: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly contacto: { email: string; telefono: string };
  readonly kycStatus: KycStatus;
}

export interface ProductoElegible {
  readonly codigo: string;
  readonly nombre: string;
  readonly tipo: TipoProducto;
}

export interface AperturaProductoRequest {
  readonly cliente: { tipoDoc: TipoDocumento; numDoc: string };
  readonly productoCodigo: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AperturaProductoResponse {
  readonly numeroProducto: string;
  readonly estado: 'ACTIVO';
  readonly creadoEn: Date;
}

/** Abstract port — implemented by infrastructure adapters. */
export interface CoreBankingPort {
  consultarCliente(
    tipoDoc: TipoDocumento,
    numDoc: string,
    correlationId: string,
  ): Promise<Result<ClienteCore, DomainError>>;

  consultarProductosElegibles(
    tipoDoc: TipoDocumento,
    numDoc: string,
    correlationId: string,
  ): Promise<Result<ProductoElegible[], DomainError>>;

  solicitarApertura(
    req: AperturaProductoRequest,
  ): Promise<Result<AperturaProductoResponse, DomainError>>;

  abandonarSolicitud(
    id: string,
    correlationId: string,
  ): Promise<Result<void, DomainError>>;
}

export const CORE_BANKING_PORT = Symbol('CoreBankingPort');
