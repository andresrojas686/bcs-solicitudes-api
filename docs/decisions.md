# Decisiones arquitectónicas (ADRs consolidados)

> Resumen ejecutivo de las 7 decisiones arquitectónicas clave del proyecto.
> Formato Michael Nygard simplificado: contexto + decisión + trade-off + alternativas descartadas.
> Las decisiones son **inmutables**: si una cambia, se anexa una nueva al final con referencia a la reemplazada.

**Fecha:** 2026-04-29 · **Autor:** Líder Técnico

## Índice

1. [Clean Architecture pragmática](#1--clean-architecture-pragmática)
2. [Mongoose 8 como ODM](#2--mongoose-8-como-odm)
3. [JWT mock para la prueba (vs Keycloak)](#3--jwt-mock-para-la-prueba-vs-keycloak)
4. [Máquina de estados en Value Object](#4--máquina-de-estados-en-value-object)
5. [Retry + circuit breaker en adapter Mulesoft](#5--retry--circuit-breaker-en-adapter-mulesoft)
6. [Observabilidad: pino + Prometheus + OpenTelemetry](#6--observabilidad-pino--prometheus--opentelemetry)
7. [Uso de IA en desarrollo: política y guardrails](#7--uso-de-ia-en-desarrollo-política-y-guardrails)

---

## 1 — Clean Architecture pragmática

**Estado:** Aceptado

**Contexto:** alta variabilidad de reglas por producto bancario + integración con Core externo cuyos contratos pueden cambiar. Necesitamos aislar el dominio de la infraestructura sin imponer overhead burocrático.

**Decisión:** capas (`domain` / `application` / `infrastructure` / `interfaces`) **solo en el módulo crítico (`solicitudes/`)**. Otros módulos (`productos`, `clientes`, `auth`) usan estructura más fina porque su complejidad es menor. El dominio no depende de Nest, Mongoose ni HTTP.

**Trade-off:**
- ✅ 42 unit tests del VO de estado corren en milisegundos sin tocar nada externo. Cambiar Mongoose por DynamoDB toca solo `infrastructure/persistence/`.
- ❌ ~3-5 archivos por feature en Solicitudes. Curva de aprendizaje para devs nuevos.
- 🛡️ Mitigación: documentación con diagrama, onboarding pair-programming, plantillas para añadir use cases.

**Alternativas descartadas:**
- **MVC tradicional NestJS** (controller-service-repository): mezcla responsabilidades, requiere mockear servicios para testear lógica.
- **Hexagonal "puro"** con Application Service + Command/Query Handlers: sobre-ingeniería para squad de 5.
- **DDD completo con event sourcing**: el dominio aún no lo justifica.

---

## 2 — Mongoose 8 como ODM

**Estado:** Aceptado · revisable cada 2 trimestres

**Contexto:** la plataforma usa MongoDB Atlas porque `datosFormulario` varía por producto (schema flexible). Necesitamos un ODM con tipos compartidos, validación, queries idiomáticos y soporte de TTL indexes (idempotencia con expiración 24h).

**Decisión:** **Mongoose 8** con `@nestjs/mongoose` para integración con DI.

**Trade-off:**
- ✅ Estándar de facto del ecosistema Node + Mongo, soporte nativo de Atlas, hooks `pre/post`, TTL indexes, `mongodb-memory-server` integrado para tests.
- ❌ Type-safety del schema débil: hay que mantener `interface SolicitudDocument` paralelo al `Schema`.
- 🛡️ Mitigación: ambos viven en el mismo archivo (`solicitud.schema.ts`); los cambios son visibles en un PR.

**Alternativas descartadas:**
- **Driver oficial `mongodb`** sin ODM: demasiado low-level.
- **TypeORM con Mongo driver**: soporte secundario, orientado a SQL.
- **Prisma con Mongo connector**: limitado (sin transacciones complejas, sin hooks); lock-in fuerte con su CLI.

**Plan a futuro:** si los datos se vuelven altamente relacionales o necesitamos reporting complejo, considerar dual-write a Postgres antes de migración completa.

---

## 3 — JWT mock para la prueba (vs Keycloak)

**Estado:** Aceptado para la prueba técnica · Reemplazable en sprint 1 productivo

**Contexto:** se requiere autenticación con roles (`ASESOR`, `SUPERVISOR`, `ADMIN`). En producción BCS usaría Keycloak/Auth0 corporativo. Integrar Keycloak excede el time-box de la prueba y desviaría el foco del backend de negocio.

**Decisión:** JWT firmado HS256 por el backend mismo. Tres usuarios sembrados con bcrypt en memoria (`asesor / supervisor / admin`).

**Trade-off:**
- ✅ Permite mostrar la arquitectura completa de autorización (`@Roles`, `@CurrentUser`, `JwtAuthGuard`, `RolesGuard`) sin overhead. Tests e2e funcionan sin dependencia externa. Throttler estricto en `/auth/login` (OWASP A07).
- ❌ **NO listo para producción**: no hay rotación de secret, ni revocación de tokens, ni refresh tokens.
- 🛡️ Mitigación: documentado claramente en este ADR y en el README. El reemplazo es localizable a `auth.module.ts` (~2 días de un dev senior).

**Plan de migración a Keycloak (sprint 1):** reemplazar `Credentials Provider` por validación JWKS contra Keycloak (RS256), claims de roles desde `realm_access.roles`. El frontend cambia el provider de `Credentials` a `Keycloak` en NextAuth.

**Alternativas descartadas:**
- Implementar OAuth completo con Keycloak local en Docker.
- Sin auth ("público"): no demuestra A01/A07 de OWASP.
- Auth0 hosted free: configuración de tenant excede el alcance.

---

## 4 — Máquina de estados en Value Object

**Estado:** Aceptado

**Contexto:** una solicitud bancaria atraviesa 6 estados con transiciones rígidas. Las transiciones inválidas son bug crítico (apertura de producto sin revisión, auditoría falsa). Necesitamos garantizar las reglas independientemente de quién tenga la entidad.

**Decisión:** Value Object inmutable `EstadoSolicitud` con tabla constante `ALLOWED` y método `transitionTo(target): Result<EstadoSolicitud, InvalidStateTransitionError>`. La entidad `Solicitud` envuelve al VO y registra cada cambio en `historicoEstados`.

**Tabla autoritativa de transiciones:**
```
DRAFT     → IN_REVIEW | ABANDONED
IN_REVIEW → APPROVED  | REJECTED | ABANDONED
APPROVED  → FINALIZED | ABANDONED
REJECTED | FINALIZED | ABANDONED → terminal
```

**Excepción de negocio** (HU-002 CA#3): `regresarARevisionPorRechazoCore()` permite `APPROVED → IN_REVIEW` cuando el Core rechaza con 4xx. Es una regla de negocio explícita encapsulada en la entidad.

**Trade-off:**
- ✅ 42 unit tests cubren todas las transiciones (7 válidas + 23 inválidas) en < 100ms. Imposible introducir transición ilegal sin romper tests.
- ❌ Una transición legítima nueva requiere tocar `ALLOWED`, los tests y posiblemente este documento.

**Alternativas descartadas:**
- **Enum simple + if/else en cada use case**: las reglas se duplican y divergen.
- **Librería [xstate](https://xstate.js.org)**: excelente, pero overkill para 6 estados sin sub-estados ni guards complejos.

---

## 5 — Retry + circuit breaker en adapter Mulesoft

**Estado:** Aceptado

**Contexto:** la integración con el Core vía Mulesoft es inherentemente inestable (picos de latencia, mantenimientos, errores de red). Sin protección, cada request se ve afectada uno-a-uno y puede generar inconsistencias (solicitudes APPROVED sin producto en Core).

**Decisión:** tres capas combinadas en `MulesoftAdapter`:
1. **Timeout**: axios con `timeout: 5000ms`.
2. **Retry**: `axios-retry` con 3 reintentos, backoff exponencial + jitter, **solo en 5xx y errores de red** (4xx no se reintenta).
3. **Circuit breaker**: `opossum` con threshold 50% sobre 10 requests, recovery 30s, fallback que lanza `CoreBankingCircuitOpenError` (falla rápido < 100ms).

**Principio 4xx vs 5xx:**
| Tipo | Significado | Acción |
|---|---|---|
| 4xx (especialmente 422) | Error de negocio | NO reintentar; mapear a `CoreBankingBusinessError` |
| 5xx + network errors | Falla transitoria | Reintentar; si persiste, circuit breaker abre |

Esto alinea con HU-002: 4xx → solicitud regresa a IN_REVIEW; 5xx tras retries → APPROVED + flag `pendienteEnvioCore` para retry diferido.

**Idempotencia outbound:** toda llamada al Core lleva `Idempotency-Key` derivado del `solicitudId`.

**Trade-off:**
- ✅ Smoke tests verifican el funcionamiento end-to-end (escenario `3333333333` con retry recovery). Si el Core cae, el asesor recibe 503 explícito en < 100ms en vez de esperar 15s.
- ❌ Adapter ~200 líneas. Estado del circuit breaker es per-instance (en memoria).
- 🛡️ Mitigación: dependencias maduras (axios-retry, opossum). Para coordinación cross-instance considerar Hystrix-style con Redis en sprint 3+.

**Alternativas descartadas:**
- **Solo retry, sin circuit breaker**: cuando el Core cae, cada request consume 4 intentos × 5s = 20s.
- **Solo circuit breaker, sin retry**: picos transitorios provocan errores que un retry simple resolvería.

---

## 6 — Observabilidad: pino + Prometheus + OpenTelemetry

**Estado:** Aceptado

**Contexto:** plataforma de banca interna debe ser observable end-to-end. Cuando algo falla, el oncall necesita saber qué request, qué usuario, qué pasó en cada hop, cuánto tardó. Necesitamos los 3 pilares (logs/métricas/traces) con costo proporcional al equipo.

**Decisión:**
| Pilar | Stack |
|---|---|
| **Logs** | `pino` + `nestjs-pino` con redacción de PII automática (`numDoc`, `email`, `password`, `authorization` → `[REDACTED]`); `correlationId` por request via `AsyncLocalStorage` |
| **Métricas** | `prom-client` + `@willsoto/nestjs-prometheus`, endpoint `/metrics` público para scrape |
| **Traces** | OpenTelemetry SDK con auto-instrumentations (HTTP, mongoose, axios, dns); console exporter por defecto, OTLP/HTTP si `OTEL_EXPORTER_OTLP_ENDPOINT` está set |

**Métricas custom de negocio:**
- `solicitudes_creadas_total{producto}` (counter)
- `solicitudes_estado_actual{estado}` (gauge)
- `core_banking_request_duration_seconds{endpoint,status}` (histogram)

**Trade-off:**
- ✅ Un solo `correlationId` atraviesa Nest → Mongoose → adapter → Core mock. Métricas listas para Prometheus sin esfuerzo. Sin lock-in: stacks abiertos consumibles por Datadog, New Relic, Grafana, Honeycomb.
- ❌ OTel auto-instrumentation puede ser ruidosa en dev (cada `/health` emite 5+ spans).
- 🛡️ Mitigación: `ignoreLayers` en `otel.ts`, toggle `OTEL_SDK_DISABLED=true`, `pino-pretty` solo en dev.

**Alternativas descartadas:**
- **Solo logs**: insuficiente para diagnosticar latencia cross-service.
- **Datadog APM con agent propietario**: lock-in y caro.
- **Winston en lugar de pino**: pino es 5-10x más rápido y JSON-first.

---

## 7 — Uso de IA en desarrollo: política y guardrails

**Estado:** Aceptado

**Contexto:** la IA generativa multiplica productividad cuando se usa con criterio. La rúbrica de la prueba evalúa explícitamente "uso de IA". Sin política, los riesgos son: filtrar PII/secrets a un servicio externo, aprobación ciega de código en zonas críticas (auth, máquina de estados), pérdida de aprendizaje del equipo, decisiones arquitectónicas sin firma humana.

**Decisión:** política explícita con guardrails (detalle completo en [`ai-usage/policy.md`](ai-usage/policy.md)):

| ✅ SÍ con IA | ❌ NO con IA |
|---|---|
| Boilerplate (DTOs, mappers, módulos) | Pasar PII / secrets a un LLM externo |
| Generar tests adicionales sobre código existente | Aprobar el propio PR sin segunda revisión |
| Refactor mecánico (renombres, extract method) | Decisiones arquitectónicas sin firma humana |
| Primer borrador de docs y ADRs | Código en zonas críticas sin revisión profunda |
| Refinement de historias y CA | Sustituir el code review humano |

**Evidencia y trazabilidad:**
- Trailer `Assisted-by: Claude Code` en commits con asistencia significativa (no falsificar).
- [`docs/ai-usage/prompts.md`](ai-usage/prompts.md) documenta los 10 prompts representativos usados durante esta prueba.
- Cada decisión arquitectónica de este documento está firmada por humano, aunque su redacción haya sido asistida.

**Trade-off:**
- ✅ ~30% de tiempo ahorrado en boilerplate y tests exhaustivos (`it.each`). Política versionada documenta el "cómo" del trabajo.
- ❌ Riesgo de dependencia (si la IA cae, baja productividad). Riesgo de homogeneización (código con sello LLM puede ser blando en decisiones difíciles).
- 🛡️ Mitigación: code review humano no-negociable. Política revisable cada 2 trimestres.

**Casos concretos en esta prueba:** ver [`ai-usage/prompts.md`](ai-usage/prompts.md) — incluye P-01 (42 tests del VO con `it.each`), P-02 (OpenAPI YAML del Core), P-04 (wizard frontend), P-06 (estrategia QA ISTQB), P-08 (estos ADRs), P-10 (bugs reales detectados por IA).
