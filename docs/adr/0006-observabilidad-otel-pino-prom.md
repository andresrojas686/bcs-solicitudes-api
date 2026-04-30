# ADR-0006 — Observabilidad: pino + Prometheus + OpenTelemetry

* **Estado**: Aceptado
* **Fecha**: 2026-04-29

## Contexto

Una plataforma de banca interna debe ser **observable end-to-end**: cuando algo falla, el oncall necesita saber **inmediatamente** qué request fue, qué usuario lo generó, qué pasó en cada hop, y cuánto tardó. Sin observabilidad, los incidentes se resuelven con "intuición", lo cual es caro y lento.

Necesitamos los **3 pilares**: logs, métricas, traces. Y necesitamos que el costo de operarlos sea proporcional al equipo (squad de 5).

## Decisión

| Pilar | Stack |
|---|---|
| **Logs** | `pino` + `nestjs-pino` con redacción de PII automática y `correlationId` por request vía `AsyncLocalStorage` |
| **Métricas** | `prom-client` + `@willsoto/nestjs-prometheus`, endpoint `/metrics` (público para scrape) |
| **Traces** | OpenTelemetry SDK con auto-instrumentations (HTTP, mongoose, axios, dns) — exporter consola por defecto, OTLP/HTTP si `OTEL_EXPORTER_OTLP_ENDPOINT` se setea |

### Logs — qué y cómo

- **Formato**: JSON structured. En dev se ve "pretty" (`pino-pretty`); en prod siempre JSON para parseo en CloudWatch/Datadog/Loki.
- **Niveles**: configurable via `LOG_LEVEL`. Default `info`.
- **Campos siempre presentes**: `correlationId`, `userId` (cuando aplica), `level`, `time`, `msg`.
- **Redacción de PII automática**: `password`, `numDoc`, `email`, `telefono`, `authorization` → `[REDACTED]`. Fail-safe: si nuevo campo PII se introduce, agregar al `redact.paths`.
- **CorrelationId** se genera en middleware (`x-correlation-id` del cliente o nanoid). Vive en `AsyncLocalStorage` para ser leído por código profundo sin pasarlo por argumento.

### Métricas custom

| Métrica | Tipo | Labels | Propósito |
|---|---|---|---|
| `solicitudes_creadas_total` | Counter | `producto` | Volumen de solicitudes nuevas por producto |
| `solicitudes_estado_actual` | Gauge | `estado` | Distribución actual entre los 6 estados |
| `core_banking_request_duration_seconds` | Histogram | `endpoint`, `status` | Latencia/error rate hacia Mulesoft |

Más las **métricas default de Node** (`process_cpu_*`, `nodejs_eventloop_*`, `process_resident_memory_bytes`) y de HTTP server (`http_request_duration_seconds`).

### Tracing

- SDK arranca **antes** de NestFactory (en `main.ts`, primera línea: `import './shared/observability/otel'`).
- Auto-instrumentations capturan HTTP entrante, queries Mongoose, llamadas axios al Core, y resoluciones DNS.
- Spans incluyen: `http.method`, `http.url`, `db.system`, `db.statement`, status, latencia.
- En dev, exporter consola (puede ser ruidoso; toggleable con `OTEL_SDK_DISABLED=true`).
- En prod, OTLP/HTTP a un colector (Tempo, Honeycomb, Datadog) — solo cambia env var.

## Consecuencias

### Positivas
- **Un solo correlationId** atraviesa: log de Nest → Mongoose → adapter axios → Core mock → respuesta. Verificable.
- **Métricas listas para Prometheus** sin esfuerzo: `/metrics` endpoint público, scrape config trivial.
- **Sin lock-in**: pino, prom-client, OTel SDK son estándares abiertos. Cualquier backend (Datadog, New Relic, Grafana stack, Honeycomb) los consume.
- Auto-instrumentation OTel reduce el código manual a casi cero.

### Negativas
- OTel auto-instrumentation puede ser **ruidosa** en dev (cada request a /health emite 5+ spans). Mitigado con `ignoreLayers` en `otel.ts` y posibilidad de desactivar via env.
- pino-pretty en dev tiene overhead; en CI usamos JSON puro.
- Métrica `solicitudes_estado_actual` como gauge es aproximada (sample tras cada cambio); para distribución real exacta sería un cron que cuente Mongo. Aceptable para nuestro tamaño.

## Plan de evolución

| Hito | Cuándo |
|---|---|
| Jaeger UI / Grafana Tempo | Sprint 2 (si oncall lo justifica) |
| Custom spans en use cases (`@SpanKind.INTERNAL`) | Cuando sea necesario para diagnóstico fino |
| RED method dashboards (Rate, Errors, Duration) | Sprint 2 |
| Alertas SLO-based (multi-window multi-burn-rate) | Sprint 3 |

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Solo logs (sin métricas/traces)** | Insuficiente para diagnosticar latencia en flujos cross-service. |
| **Datadog APM con su agent** | Lock-in y caro. OTel + cualquier backend es la solución estándar. |
| **Winston en lugar de pino** | pino es 5-10x más rápido y JSON-first. Winston tiene más plugins pero los costos en latencia no valen. |
| **express-prom-bundle solo, sin custom metrics** | Cubre solo HTTP. Custom metrics de negocio (counters de solicitudes por producto) son lo que más valor da al equipo de producto. |

## Verificación

- `/metrics` expone counters/gauges/histogram + métricas Node default.
- Logs en dev muestran `correlationId` consistente a lo largo del flujo.
- Spans visibles en consola con `traceId` y `parentSpanContext` correctamente nested.
