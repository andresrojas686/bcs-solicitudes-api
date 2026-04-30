import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context kept in AsyncLocalStorage. Lets any code (services,
 * adapters, repositories) read the active correlation id without it being
 * threaded through every method signature.
 */
export interface RequestContext {
  correlationId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? 'no-correlation-id';
}
