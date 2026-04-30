/**
 * Base class for domain-level errors. Subclasses describe specific business
 * failures (e.g. InvalidStateTransition, ClienteNoElegible) and carry a stable
 * `code` for clients and observability.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Specific subclasses used across the Core Banking integration. */
export class CoreBankingUpstreamError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CORE_UPSTREAM_UNAVAILABLE', message, details);
  }
}
export class CoreBankingNotFoundError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CORE_NOT_FOUND', message, details);
  }
}
export class CoreBankingBusinessError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CORE_BUSINESS_VALIDATION', message, details);
  }
}
export class CoreBankingCircuitOpenError extends DomainError {
  constructor() {
    super('CORE_CIRCUIT_OPEN', 'Core circuit breaker is open — failing fast');
  }
}

export class SolicitudNotFoundError extends DomainError {
  constructor(id: string) {
    super('SOLICITUD_NOT_FOUND', `Solicitud no encontrada: ${id}`, { id });
  }
}

export class IdempotencyKeyConflictError extends DomainError {
  constructor(key: string) {
    super(
      'IDEMPOTENCY_KEY_CONFLICT',
      `La Idempotency-Key ya fue usada en una solicitud previa`,
      { key },
    );
  }
}
