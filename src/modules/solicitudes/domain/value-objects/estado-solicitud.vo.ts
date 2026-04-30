import { DomainError } from '../../../../shared/kernel/domain-error';
import { err, ok, type Result } from '../../../../shared/kernel/result';

/**
 * EstadoSolicitud — Value Object con la máquina de estados de una solicitud.
 *
 * Transiciones permitidas:
 *
 *   DRAFT     → IN_REVIEW | ABANDONED
 *   IN_REVIEW → APPROVED  | REJECTED  | ABANDONED
 *   APPROVED  → FINALIZED | ABANDONED
 *   REJECTED  → (terminal)
 *   FINALIZED → (terminal)
 *   ABANDONED → (terminal)
 *
 * Las transiciones inválidas devuelven InvalidStateTransitionError (HTTP 409
 * en la capa de interfaces). El dominio nunca lanza para flujos esperados.
 */
export type EstadoSolicitudValue =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FINALIZED'
  | 'ABANDONED';

const ALLOWED: Record<EstadoSolicitudValue, EstadoSolicitudValue[]> = {
  DRAFT: ['IN_REVIEW', 'ABANDONED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'ABANDONED'],
  APPROVED: ['FINALIZED', 'ABANDONED'],
  REJECTED: [],
  FINALIZED: [],
  ABANDONED: [],
};

const TERMINAL_STATES: ReadonlySet<EstadoSolicitudValue> = new Set([
  'REJECTED',
  'FINALIZED',
  'ABANDONED',
]);

export class InvalidStateTransitionError extends DomainError {
  constructor(from: EstadoSolicitudValue, to: EstadoSolicitudValue) {
    super(
      'INVALID_STATE_TRANSITION',
      `Transición inválida: ${from} → ${to}`,
      { from, to, allowed: ALLOWED[from] },
    );
  }
}

export class EstadoSolicitud {
  private constructor(public readonly value: EstadoSolicitudValue) {}

  static initial(): EstadoSolicitud {
    return new EstadoSolicitud('DRAFT');
  }

  static from(value: EstadoSolicitudValue): EstadoSolicitud {
    return new EstadoSolicitud(value);
  }

  /**
   * Returns a new VO with `target` if the transition is allowed; otherwise an Err
   * carrying InvalidStateTransitionError. Pure — does not mutate `this`.
   */
  transitionTo(
    target: EstadoSolicitudValue,
  ): Result<EstadoSolicitud, InvalidStateTransitionError> {
    if (!ALLOWED[this.value].includes(target)) {
      return err(new InvalidStateTransitionError(this.value, target));
    }
    return ok(new EstadoSolicitud(target));
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.has(this.value);
  }

  canTransitionTo(target: EstadoSolicitudValue): boolean {
    return ALLOWED[this.value].includes(target);
  }

  equals(other: EstadoSolicitud): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
