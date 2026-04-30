import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { AUDITORIA_COLLECTION, type AuditoriaDocument } from './auditoria.schema';

export interface AuditEventInput {
  actor: string;
  accion: string;
  recursoTipo: string;
  recursoId?: string;
  /** Payload sensible — se almacena solo el hash SHA-256 (sin PII en claro). */
  payloadSensible?: string;
  correlationId: string;
}

/**
 * Registra eventos de auditoría sin bloquear el flujo del request.
 * Si la inserción falla, se loguea pero no se propaga el error (auditoría no
 * debe romper la operación de negocio).
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectModel(AUDITORIA_COLLECTION) private readonly model: Model<AuditoriaDocument>,
  ) {}

  async record(event: AuditEventInput): Promise<void> {
    try {
      const payloadHash = event.payloadSensible
        ? crypto.createHash('sha256').update(event.payloadSensible).digest('hex')
        : undefined;
      await this.model.create({
        _id: `aud_${nanoid(12)}`,
        actor: event.actor,
        accion: event.accion,
        recursoTipo: event.recursoTipo,
        recursoId: event.recursoId,
        payloadHash,
        correlationId: event.correlationId,
        timestamp: new Date(),
      });
    } catch (err) {
      this.logger.warn({ err, event: { ...event, payloadSensible: undefined } }, 'Audit insert failed');
    }
  }
}
