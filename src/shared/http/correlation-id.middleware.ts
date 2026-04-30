import { Injectable, type NestMiddleware } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';
import { requestContext } from './correlation-id.context';

const HEADER = 'x-correlation-id';

/**
 * Establishes a per-request AsyncLocalStorage scope so any code in the request
 * lifecycle can read the active correlation id (and userId once auth runs).
 * Echoes the id back to the client in the response header.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(HEADER);
    const correlationId = incoming && incoming.length > 0 ? incoming : `req-${nanoid(10)}`;
    res.setHeader(HEADER, correlationId);

    requestContext.run({ correlationId }, () => next());
  }
}
