import { Schema } from 'mongoose';

export interface AuditoriaDocument {
  _id: string;
  actor: string;
  accion: string;
  recursoTipo: string;
  recursoId?: string;
  payloadHash?: string;
  correlationId: string;
  timestamp: Date;
}

export const AUDITORIA_COLLECTION = 'auditoria_eventos';

export const AuditoriaSchema = new Schema<AuditoriaDocument>(
  {
    _id: { type: String, required: true },
    actor: { type: String, required: true, index: true },
    accion: { type: String, required: true, index: true },
    recursoTipo: { type: String, required: true, index: true },
    recursoId: { type: String, index: true, sparse: true },
    payloadHash: { type: String },
    correlationId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { collection: AUDITORIA_COLLECTION, versionKey: false },
);
