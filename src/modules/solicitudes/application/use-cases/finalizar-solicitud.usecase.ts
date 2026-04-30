import { Inject, Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { Solicitud } from '../../domain/entities/solicitud.entity';
import {
  SOLICITUD_REPOSITORY,
  type SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';
import {
  CORE_BANKING_PORT,
  type CoreBankingPort,
} from '../../domain/ports/core-banking.port';
import { err, isErr, ok, type Result } from '../../../../shared/kernel/result';
import {
  CoreBankingBusinessError,
  type DomainError,
  SolicitudNotFoundError,
} from '../../../../shared/kernel/domain-error';
import { getCorrelationId } from '../../../../shared/http/correlation-id.context';
import { MetricsService } from '../../../../shared/observability/metrics.service';

export interface FinalizarSolicitudInput {
  id: string;
  actor: string;
}

/**
 * Implementa la HU-002: cuando una solicitud está APPROVED, llamamos al Core
 * para que abra el producto. La respuesta determina el destino:
 *
 *   - 201 OK   → solicitud → FINALIZED, guarda numeroProducto.
 *   - 422 4xx  → solicitud regresa a IN_REVIEW con motivo (rechazo de negocio).
 *   - 5xx (post-retry) → solicitud queda APPROVED con flag pendienteEnvioCore.
 *
 * La idempotencia se logra usando el id de la solicitud como Idempotency-Key.
 */
@Injectable()
export class FinalizarSolicitudUseCase {
  private readonly logger = new Logger(FinalizarSolicitudUseCase.name);

  constructor(
    @Inject(SOLICITUD_REPOSITORY)
    private readonly repo: SolicitudRepositoryPort,
    @Inject(CORE_BANKING_PORT)
    private readonly core: CoreBankingPort,
    private readonly metrics: MetricsService,
  ) {}

  async execute(input: FinalizarSolicitudInput): Promise<Result<Solicitud, DomainError>> {
    const solicitud = await this.repo.buscarPorId(input.id);
    if (!solicitud) return err(new SolicitudNotFoundError(input.id));

    if (solicitud.estado.value !== 'APPROVED') {
      // Forzamos a que el caller haya pasado por aprobar primero.
      // El Filter convertirá esto a 409 Conflict.
      const transition = solicitud.transicionar('FINALIZED', input.actor);
      if (!transition.ok) return err(transition.error);
    }

    const correlationId = getCorrelationId();
    const idempotencyKey = `sol-finalize-${solicitud.id}-${nanoid(6)}`;

    const endTimer = this.metrics.startCoreRequest('solicitarApertura');
    const coreResult = await this.core.solicitarApertura({
      cliente: solicitud.cliente,
      productoCodigo: solicitud.productoCodigo,
      idempotencyKey,
      correlationId,
      metadata: { canal: 'MICROSITIO', solicitudId: solicitud.id },
    });
    endTimer(coreResult.ok ? 'ok' : 'error');

    if (isErr(coreResult)) {
      // Validación de negocio del Core (4xx) → regresa a IN_REVIEW (HU-002 CA#3)
      if (coreResult.error instanceof CoreBankingBusinessError) {
        const back = solicitud.regresarARevisionPorRechazoCore(
          coreResult.error.message,
          input.actor,
        );
        if (back.ok) await this.repo.guardar(solicitud);
        return err(coreResult.error);
      }
      // 5xx tras retries / circuit open: queda APPROVED + pendiente
      this.logger.warn(
        `Core no respondió OK al finalizar solicitud ${solicitud.id}; encolando para retry diferido.`,
      );
      solicitud.marcarPendienteEnvioCore();
      await this.repo.guardar(solicitud);
      return err(coreResult.error);
    }

    const finalize = solicitud.marcarFinalizada(coreResult.value.numeroProducto, input.actor);
    if (!finalize.ok) return err(finalize.error);
    await this.repo.guardar(solicitud);
    this.metrics.recordCambioEstado('APPROVED', 'FINALIZED');
    return ok(solicitud);
  }
}
