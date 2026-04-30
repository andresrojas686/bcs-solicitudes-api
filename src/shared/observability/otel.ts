/**
 * OpenTelemetry bootstrap. Importar **antes** de cualquier dependencia que se
 * quiera instrumentar (NestFactory, Mongoose, axios, etc.).
 *
 * En desarrollo el exporter por defecto es `ConsoleSpanExporter` para no
 * requerir un colector externo. Si OTEL_EXPORTER_OTLP_ENDPOINT está definido,
 * se usa OTLP/HTTP (ej. Jaeger, Tempo, Honeycomb).
 *
 * Para deshabilitar OTel (ej. en CI rápido), exportar OTEL_SDK_DISABLED=true.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const isDisabled = process.env.OTEL_SDK_DISABLED === 'true';

if (!isDisabled) {
  // Quiet in production; chatty in dev to surface config errors.
  diag.setLogger(
    new DiagConsoleLogger(),
    process.env.NODE_ENV === 'development' ? DiagLogLevel.WARN : DiagLogLevel.ERROR,
  );

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'bcs-solicitudes-api',
      [ATTR_SERVICE_VERSION]: '0.0.1',
    }),
    traceExporter: otlpEndpoint
      ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
      : new ConsoleSpanExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduce ruido — desactiva auto-instrumentación de fs.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Express genera demasiados spans para health checks.
        '@opentelemetry/instrumentation-express': {
          ignoreLayers: [/health/, /metrics/, /api\/docs/],
        },
      }),
    ],
  });

  sdk.start();

  process.once('SIGTERM', () => {
    sdk.shutdown().catch(() => {});
  });
}
