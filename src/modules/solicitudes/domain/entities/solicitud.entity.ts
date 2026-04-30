import { nanoid } from 'nanoid';
import {
  EstadoSolicitud,
  type EstadoSolicitudValue,
  InvalidStateTransitionError,
} from '../value-objects/estado-solicitud.vo';
import { err, ok, type Result } from '../../../../shared/kernel/result';
import type { TipoDocumento } from '../ports/core-banking.port';

export interface ClienteRef {
  readonly tipoDoc: TipoDocumento;
  readonly numDoc: string;
}

export interface CambioEstado {
  readonly estadoAnterior: EstadoSolicitudValue;
  readonly estadoNuevo: EstadoSolicitudValue;
  readonly actor: string;
  readonly motivo?: string;
  readonly timestamp: Date;
}

export interface SolicitudProps {
  id: string;
  cliente: ClienteRef;
  productoCodigo: string;
  estado: EstadoSolicitud;
  datosFormulario: Record<string, unknown>;
  historicoEstados: CambioEstado[];
  correlationId: string;
  idempotencyKey?: string;
  numeroProducto?: string;
  motivoRechazo?: string;
  pendienteEnvioCore?: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Solicitud — entidad raíz del agregado. Encapsula el estado y las invariantes
 * (transiciones, historial). Las únicas formas de modificar `estado` son los
 * métodos `transitionar*` que registran auditoría en `historicoEstados`.
 */
export class Solicitud {
  private constructor(private props: SolicitudProps) {}

  // ---- Factories ------------------------------------------------------------

  /** Crear una solicitud nueva, siempre arranca en DRAFT. */
  static crear(input: {
    cliente: ClienteRef;
    productoCodigo: string;
    datosFormulario?: Record<string, unknown>;
    correlationId: string;
    idempotencyKey?: string;
    actor: string;
  }): Solicitud {
    const now = new Date();
    return new Solicitud({
      id: `sol_${nanoid(12)}`,
      cliente: input.cliente,
      productoCodigo: input.productoCodigo,
      estado: EstadoSolicitud.initial(),
      datosFormulario: input.datosFormulario ?? {},
      historicoEstados: [
        {
          estadoAnterior: 'DRAFT',
          estadoNuevo: 'DRAFT',
          actor: input.actor,
          motivo: 'Creación de solicitud',
          timestamp: now,
        },
      ],
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  /** Rehidrata una solicitud desde persistencia. */
  static fromPersistence(props: SolicitudProps): Solicitud {
    return new Solicitud(props);
  }

  // ---- Getters --------------------------------------------------------------

  get id() { return this.props.id; }
  get cliente() { return this.props.cliente; }
  get productoCodigo() { return this.props.productoCodigo; }
  get estado() { return this.props.estado; }
  get datosFormulario() { return this.props.datosFormulario; }
  get historicoEstados(): readonly CambioEstado[] { return this.props.historicoEstados; }
  get correlationId() { return this.props.correlationId; }
  get idempotencyKey() { return this.props.idempotencyKey; }
  get numeroProducto() { return this.props.numeroProducto; }
  get motivoRechazo() { return this.props.motivoRechazo; }
  get pendienteEnvioCore() { return this.props.pendienteEnvioCore ?? false; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  get version() { return this.props.version; }

  /** Plain object for repository persistence. */
  toPersistence(): SolicitudProps {
    return { ...this.props, historicoEstados: [...this.props.historicoEstados] };
  }

  // ---- Mutators (controlled) ------------------------------------------------

  /** Reemplaza datos del formulario (solo válido en DRAFT). */
  actualizarDatos(
    nuevosDatos: Record<string, unknown>,
  ): Result<void, InvalidStateTransitionError> {
    if (this.props.estado.value !== 'DRAFT') {
      return err(new InvalidStateTransitionError(this.props.estado.value, 'DRAFT'));
    }
    this.props.datosFormulario = { ...nuevosDatos };
    this.touch();
    return ok(undefined);
  }

  /**
   * Aplica una transición de estado registrando auditoría. Si la transición
   * es inválida, devuelve Err sin mutar la entidad.
   */
  transicionar(
    target: EstadoSolicitudValue,
    actor: string,
    motivo?: string,
  ): Result<void, InvalidStateTransitionError> {
    const transition = this.props.estado.transitionTo(target);
    if (!transition.ok) return err(transition.error);

    const previous = this.props.estado.value;
    this.props.estado = transition.value;
    this.props.historicoEstados.push({
      estadoAnterior: previous,
      estadoNuevo: target,
      actor,
      motivo,
      timestamp: new Date(),
    });
    if (target === 'REJECTED' && motivo) this.props.motivoRechazo = motivo;
    this.touch();
    return ok(undefined);
  }

  /** Marca la solicitud como FINALIZED tras éxito en el Core. */
  marcarFinalizada(numeroProducto: string, actor: string): Result<void, InvalidStateTransitionError> {
    const transition = this.transicionar('FINALIZED', actor, 'Apertura confirmada por Core');
    if (!transition.ok) return transition;
    this.props.numeroProducto = numeroProducto;
    this.props.pendienteEnvioCore = false;
    this.touch();
    return ok(undefined);
  }

  /** Tras 5xx en Core: la solicitud queda APPROVED con flag para retry diferido. */
  marcarPendienteEnvioCore(): void {
    this.props.pendienteEnvioCore = true;
    this.touch();
  }

  /**
   * Caso especial HU-002 CA#3: el Core rechaza con validación de negocio (4xx)
   * después de que la solicitud fue aprobada. La regla pide regresar a IN_REVIEW
   * con motivo. Esta es una transición controlada que rompe la máquina normal
   * (APPROVED no permite ir a IN_REVIEW por la vía pública); se encapsula aquí
   * porque es una regla de negocio explícita y auditable.
   */
  regresarARevisionPorRechazoCore(
    motivo: string,
    actor: string,
  ): Result<void, InvalidStateTransitionError> {
    if (this.props.estado.value !== 'APPROVED') {
      return err(new InvalidStateTransitionError(this.props.estado.value, 'IN_REVIEW'));
    }
    const previous = this.props.estado.value;
    this.props.estado = EstadoSolicitud.from('IN_REVIEW');
    this.props.historicoEstados.push({
      estadoAnterior: previous,
      estadoNuevo: 'IN_REVIEW',
      actor,
      motivo: `Rechazo Core: ${motivo}`,
      timestamp: new Date(),
    });
    this.props.motivoRechazo = motivo;
    this.touch();
    return ok(undefined);
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }
}
