import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { nanoid } from 'nanoid';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from '../../config/env.schema';
import { requestContext } from '../http/correlation-id.context';

/** Header name used for end-to-end correlation. */
const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Pino logger with PII redaction, JSON output in prod, pretty in dev.
 * Each request gets/creates a correlation id stored in AsyncLocalStorage so
 * downstream code (adapters, repos) can log it without explicit threading.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          // Redact common PII fields anywhere they appear in the log payload.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              '*.password',
              '*.contraseña',
              '*.numDoc',
              '*.email',
              '*.telefono',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          customProps: () => {
            const ctx = requestContext.getStore();
            return ctx ? { correlationId: ctx.correlationId, userId: ctx.userId } : {};
          },
          // Ensure incoming `x-correlation-id` is reused; otherwise generate.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers[CORRELATION_HEADER];
            const id =
              (Array.isArray(incoming) ? incoming[0] : incoming) ?? `req-${nanoid(10)}`;
            res.setHeader(CORRELATION_HEADER, id);
            return id;
          },
          customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
