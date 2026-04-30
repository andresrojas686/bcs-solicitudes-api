import { Schema, type HydratedDocument } from 'mongoose';
import type { EstadoSolicitudValue } from '../../domain/value-objects/estado-solicitud.vo';

/** Mongoose document shape for Solicitud (pure persistence type). */
export interface SolicitudDocument {
  _id: string; // we use our own nanoid as _id
  cliente: { tipoDoc: string; numDoc: string };
  productoCodigo: string;
  estado: EstadoSolicitudValue;
  datosFormulario: Record<string, unknown>;
  historicoEstados: Array<{
    estadoAnterior: EstadoSolicitudValue;
    estadoNuevo: EstadoSolicitudValue;
    actor: string;
    motivo?: string;
    timestamp: Date;
  }>;
  correlationId: string;
  idempotencyKey?: string;
  numeroProducto?: string;
  motivoRechazo?: string;
  pendienteEnvioCore?: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const SOLICITUD_COLLECTION = 'solicitudes';

export const SolicitudSchema = new Schema<SolicitudDocument>(
  {
    _id: { type: String, required: true },
    cliente: {
      tipoDoc: { type: String, required: true },
      numDoc: { type: String, required: true },
    },
    productoCodigo: { type: String, required: true, index: true },
    estado: {
      type: String,
      required: true,
      index: true,
      enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'FINALIZED', 'ABANDONED'],
    },
    datosFormulario: { type: Schema.Types.Mixed, default: {} },
    historicoEstados: [
      {
        _id: false,
        estadoAnterior: String,
        estadoNuevo: String,
        actor: String,
        motivo: String,
        timestamp: { type: Date, default: () => new Date() },
      },
    ],
    correlationId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, index: true, sparse: true },
    numeroProducto: { type: String, index: true, sparse: true },
    motivoRechazo: String,
    pendienteEnvioCore: { type: Boolean, default: false, index: true, sparse: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    version: { type: Number, required: true, default: 0 },
  },
  {
    collection: SOLICITUD_COLLECTION,
    versionKey: false,
    minimize: false,
  },
);

// Compound index for the most common list query: by cliente + estado + recent.
SolicitudSchema.index({ 'cliente.numDoc': 1, estado: 1, createdAt: -1 });

export type SolicitudHydrated = HydratedDocument<SolicitudDocument>;
