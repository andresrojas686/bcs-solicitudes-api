import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { getCorrelationId } from './correlation-id.context';
import {
  CoreBankingBusinessError,
  CoreBankingCircuitOpenError,
  CoreBankingNotFoundError,
  CoreBankingUpstreamError,
  DomainError,
} from '../kernel/domain-error';

/** RFC 7807 Problem Details payload. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code?: string;
  correlationId?: string;
  errors?: unknown;
}

/**
 * Catches all unhandled exceptions and returns RFC 7807 problem+json bodies.
 *  - HttpException → maps to its status + message.
 *  - DomainError + subclasses → map to specific HTTP statuses (404, 422, 502, 503, 504).
 *  - Anything else → 500 with a safe message (no stack leak unless development).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly isDevelopment: boolean,
  ) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const correlationId = getCorrelationId();
    const instance = req.originalUrl ?? req.url ?? '/';

    const problem = this.toProblem(exception, instance, correlationId);

    // Log at appropriate severity. 5xx → error with stack, 4xx → warn.
    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, problem, correlationId },
        `Unhandled error on ${req.method} ${instance}`,
      );
    } else {
      this.logger.warn({ problem, correlationId }, `Client error on ${req.method} ${instance}`);
    }

    res.setHeader('content-type', 'application/problem+json; charset=utf-8');
    res.status(problem.status).json(problem);
  }

  private toProblem(
    exception: unknown,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      const errors =
        typeof response === 'object' ? (response as Record<string, unknown>).message : undefined;
      return {
        type: this.typeForStatus(status),
        title: this.titleForStatus(status),
        status,
        detail: Array.isArray(detail) ? detail.join('; ') : detail,
        instance,
        correlationId,
        ...(Array.isArray(errors) ? { errors } : {}),
      };
    }

    if (exception instanceof CoreBankingNotFoundError) {
      return {
        type: 'https://bcs.example/errors/not-found',
        title: 'Not Found',
        status: HttpStatus.NOT_FOUND,
        detail: exception.message,
        instance,
        code: exception.code,
        correlationId,
      };
    }
    if (exception instanceof CoreBankingBusinessError) {
      return {
        type: 'https://bcs.example/errors/business-validation',
        title: 'Unprocessable Entity',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: exception.message,
        instance,
        code: exception.code,
        correlationId,
      };
    }
    if (exception instanceof CoreBankingCircuitOpenError) {
      return {
        type: 'https://bcs.example/errors/circuit-open',
        title: 'Service Unavailable',
        status: HttpStatus.SERVICE_UNAVAILABLE,
        detail: exception.message,
        instance,
        code: exception.code,
        correlationId,
      };
    }
    if (exception instanceof CoreBankingUpstreamError) {
      return {
        type: 'https://bcs.example/errors/upstream',
        title: 'Bad Gateway',
        status: HttpStatus.BAD_GATEWAY,
        detail: exception.message,
        instance,
        code: exception.code,
        correlationId,
      };
    }
    if (exception instanceof DomainError) {
      return {
        type: `https://bcs.example/errors/${exception.code.toLowerCase()}`,
        title: 'Domain Error',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: exception.message,
        instance,
        code: exception.code,
        correlationId,
      };
    }

    // Unknown exception — never leak details in production.
    const detail =
      this.isDevelopment && exception instanceof Error
        ? `${exception.message}`
        : 'Ocurrió un error inesperado.';
    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      instance,
      correlationId,
    };
  }

  private typeForStatus(status: number): string {
    if (status === 404) return 'https://bcs.example/errors/not-found';
    if (status === 401) return 'https://bcs.example/errors/unauthorized';
    if (status === 403) return 'https://bcs.example/errors/forbidden';
    if (status === 409) return 'https://bcs.example/errors/conflict';
    if (status === 422) return 'https://bcs.example/errors/validation';
    if (status === 429) return 'https://bcs.example/errors/rate-limit';
    return 'about:blank';
  }

  private titleForStatus(status: number): string {
    return HttpStatus[status]?.toString().replace(/_/g, ' ') ?? 'Error';
  }
}
