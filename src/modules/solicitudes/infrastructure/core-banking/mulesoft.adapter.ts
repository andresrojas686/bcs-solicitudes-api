/**
 * MulesoftAdapter — implements CoreBankingPort against the Mulesoft API gateway.
 *
 * Resilience patterns wired in:
 *   - axios with timeout + per-request correlation/idempotency headers
 *   - axios-retry: 3 attempts with exponential backoff + jitter, only on 5xx / network
 *   - opossum circuit breaker: opens at 50% failure rate over 10 reqs, recovery 30s
 *   - allowlist of hosts (mitigation A10 SSRF)
 *   - anti-corruption mapping (DTOs never leak into domain)
 *
 * In B4 this adapter is wired into a Nest module via DI. For now it can be
 * instantiated standalone (smoke tests, integration tests).
 */
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay, isNetworkError } from 'axios-retry';
import CircuitBreaker from 'opossum';

import { err, ok, type Result } from '../../../../shared/kernel/result';
import {
  CoreBankingBusinessError,
  CoreBankingCircuitOpenError,
  CoreBankingNotFoundError,
  CoreBankingUpstreamError,
  type DomainError,
} from '../../../../shared/kernel/domain-error';
import type {
  AperturaProductoRequest,
  AperturaProductoResponse,
  ClienteCore,
  CoreBankingPort,
  ProductoElegible,
  TipoDocumento,
} from '../../domain/ports/core-banking.port';
import {
  mapAperturaResponse,
  mapCliente,
  mapProductosElegibles,
  type MulesoftAperturaResponseDto,
  type MulesoftClienteDto,
  type MulesoftProblemDetails,
  type MulesoftProductosElegiblesDto,
} from './mulesoft.mappers';

export interface MulesoftAdapterConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  allowedHosts?: string[];
}

type AnyBreaker = CircuitBreaker<[() => Promise<unknown>], unknown>;

export class MulesoftAdapter implements CoreBankingPort {
  private readonly http: AxiosInstance;
  private readonly breakers = new Map<string, AnyBreaker>();

  constructor(private readonly config: MulesoftAdapterConfig) {
    this.assertHostAllowed(config.baseUrl);

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: { Accept: 'application/json' },
      // Treat 2xx and 4xx as resolved (4xx are business outcomes mapped to DomainError).
      // 5xx and network errors throw so axios-retry can kick in.
      validateStatus: (status) => status < 500,
    });

    axiosRetry(this.http, {
      retries: config.maxRetries,
      retryDelay: (retryCount) => exponentialDelay(retryCount, undefined, 200),
      retryCondition: (error) => {
        // Retry only on network errors and 5xx upstream failures.
        if (isNetworkError(error)) return true;
        const status = error.response?.status;
        return typeof status === 'number' && status >= 500 && status < 600;
      },
      shouldResetTimeout: true,
    });
  }

  // ---- Port methods ---------------------------------------------------------

  consultarCliente(
    tipoDoc: TipoDocumento,
    numDoc: string,
    correlationId: string,
  ): Promise<Result<ClienteCore, DomainError>> {
    return this.withBreaker('consultarCliente', async () => {
      const response = await this.http.get<MulesoftClienteDto | MulesoftProblemDetails>(
        `/core/v1/clientes/${encodeURIComponent(tipoDoc)}/${encodeURIComponent(numDoc)}`,
        { headers: { 'x-correlation-id': correlationId } },
      );
      return this.handle(response.status, response.data, mapCliente);
    });
  }

  consultarProductosElegibles(
    tipoDoc: TipoDocumento,
    numDoc: string,
    correlationId: string,
  ): Promise<Result<ProductoElegible[], DomainError>> {
    return this.withBreaker('consultarProductosElegibles', async () => {
      const response = await this.http.get<
        MulesoftProductosElegiblesDto | MulesoftProblemDetails
      >(
        `/core/v1/clientes/${encodeURIComponent(tipoDoc)}/${encodeURIComponent(numDoc)}/productos-elegibles`,
        { headers: { 'x-correlation-id': correlationId } },
      );
      return this.handle(response.status, response.data, mapProductosElegibles);
    });
  }

  solicitarApertura(
    req: AperturaProductoRequest,
  ): Promise<Result<AperturaProductoResponse, DomainError>> {
    return this.withBreaker('solicitarApertura', async () => {
      const response = await this.http.post<
        MulesoftAperturaResponseDto | MulesoftProblemDetails
      >(
        '/core/v1/solicitudes',
        {
          cliente: req.cliente,
          productoCodigo: req.productoCodigo,
          metadata: req.metadata,
        },
        {
          headers: {
            'x-correlation-id': req.correlationId,
            'idempotency-key': req.idempotencyKey,
          },
        },
      );
      return this.handle(response.status, response.data, mapAperturaResponse);
    });
  }

  abandonarSolicitud(
    id: string,
    correlationId: string,
  ): Promise<Result<void, DomainError>> {
    return this.withBreaker('abandonarSolicitud', async () => {
      const response = await this.http.post<unknown | MulesoftProblemDetails>(
        `/core/v1/solicitudes/${encodeURIComponent(id)}/abandonar`,
        {},
        { headers: { 'x-correlation-id': correlationId } },
      );
      if (response.status >= 200 && response.status < 300) return ok(undefined);
      return err(this.toDomainError(response.status, response.data as MulesoftProblemDetails));
    });
  }

  // ---- Internals ------------------------------------------------------------

  private handle<TDto, TDomain>(
    status: number,
    data: TDto | MulesoftProblemDetails,
    mapper: (dto: TDto) => TDomain,
  ): Result<TDomain, DomainError> {
    if (status >= 200 && status < 300) return ok(mapper(data as TDto));
    return err(this.toDomainError(status, data as MulesoftProblemDetails));
  }

  private toDomainError(status: number, body: MulesoftProblemDetails): DomainError {
    if (status === 404) {
      return new CoreBankingNotFoundError(body?.detail ?? 'Recurso no encontrado en el Core');
    }
    if (status === 422) {
      return new CoreBankingBusinessError(
        body?.detail ?? 'Validación de negocio rechazada por el Core',
        { code: body?.code },
      );
    }
    return new CoreBankingUpstreamError(
      body?.detail ?? `Core respondió con status ${status}`,
      { status, code: body?.code },
    );
  }

  private getBreaker(name: string): AnyBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(async (fn: () => Promise<unknown>) => fn(), {
        timeout: this.config.timeoutMs + 1000, // leave room for retries
        errorThresholdPercentage: 50,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
        name,
      });
      breaker.fallback(() => {
        throw new CoreBankingCircuitOpenError();
      });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  private async withBreaker<X>(
    name: string,
    fn: () => Promise<Result<X, DomainError>>,
  ): Promise<Result<X, DomainError>> {
    const breaker = this.getBreaker(name);
    try {
      return (await breaker.fire(fn)) as Result<X, DomainError>;
    } catch (e) {
      if (e instanceof CoreBankingCircuitOpenError) return err(e);
      if (isAxiosError(e)) {
        return err(
          new CoreBankingUpstreamError(e.message, {
            status: e.response?.status,
            code: e.code,
          }),
        );
      }
      throw e;
    }
  }

  private assertHostAllowed(baseUrl: string): void {
    if (!this.config.allowedHosts || this.config.allowedHosts.length === 0) return;
    const url = new URL(baseUrl);
    if (!this.config.allowedHosts.includes(url.host)) {
      throw new Error(
        `[mulesoft.adapter] Host no permitido: ${url.host}. Allowlist: ${this.config.allowedHosts.join(', ')}`,
      );
    }
  }
}

function isAxiosError(e: unknown): e is AxiosError {
  return typeof e === 'object' && e !== null && (e as AxiosError).isAxiosError === true;
}
