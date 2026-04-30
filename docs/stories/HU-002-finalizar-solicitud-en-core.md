# HU-002 — Finalizar solicitud aprobada notificando al Core

> Historia técnica de integración Micrositio ↔ Core Bancario (vía Mulesoft).
> Endpoint: `POST /solicitudes/:id/finalizar`
> Implementación: `src/modules/solicitudes/application/use-cases/finalizar-solicitud.usecase.ts`

## Como
sistema de solicitudes digitales (orquestado por un supervisor)

## Quiero
notificar al Core Bancario cuando una solicitud transiciona al estado `APPROVED` para que se abra efectivamente el producto

## Para que
el cliente reciba el `numeroProducto` generado por el Core, la solicitud quede en `FINALIZED`, y se cierre el ciclo end-to-end

---

## Criterios de aceptación

### CA#1 — Caso feliz: Core acepta y devuelve numeroProducto
**Dado** una solicitud `S` en estado `APPROVED`,
**cuando** un usuario con rol `SUPERVISOR` invoca `POST /solicitudes/:id/finalizar`,
**entonces** el adapter llama al Core en **menos de 5 segundos** (timeout configurado),
**y** si el Core responde **201** con `numeroProducto`, la solicitud transiciona a `FINALIZED`,
**y** el `numeroProducto` queda persistido en el documento,
**y** el historial registra `APPROVED → FINALIZED, motivo: "Apertura confirmada por Core"`,
**y** el response al cliente es **201** con la solicitud actualizada.

### CA#2 — Core rechaza por validación de negocio (4xx) → solicitud regresa a IN_REVIEW
**Dado** una solicitud `S` en estado `APPROVED` con cliente `5555555555` (que el Core rechaza con 422),
**cuando** se invoca finalizar,
**entonces** el adapter recibe `422 Unprocessable Entity`,
**y** la solicitud transiciona de `APPROVED` a **`IN_REVIEW`** (rollback controlado por `regresarARevisionPorRechazoCore`),
**y** el `motivoRechazo` se persiste con el `detail` del Problem Details del Core,
**y** el historial muestra `APPROVED → IN_REVIEW, motivo: "Rechazo Core: …"`,
**y** el response al cliente es **422 application/problem+json** con `correlationId`.

### CA#3 — Core no disponible (5xx) tras reintentos → queda APPROVED + flag pendienteEnvioCore
**Dado** que el Core responde **5xx** persistente tras los **3 reintentos** del adapter,
**cuando** se invoca finalizar,
**entonces** el adapter devuelve `CoreBankingUpstreamError`,
**y** la solicitud **permanece en `APPROVED`** (no se rollback porque no es rechazo de negocio),
**y** se setea `pendienteEnvioCore: true` en el documento (para job de retry diferido),
**y** se loguea `event: core_unavailable_after_retries, solicitudId, correlationId` (sin PII),
**y** el response es **502 Bad Gateway** application/problem+json.

### CA#4 — Idempotencia outbound al Core
**Dado** una solicitud que se intenta finalizar dos veces (ej. retry diferido tras 5xx),
**cuando** el adapter llama al Core,
**entonces** envía siempre el mismo `Idempotency-Key` derivado del `solicitudId` para esa operación específica
**y** el Core no abre dos productos para la misma solicitud (idempotencia garantizada por contrato).

### CA#5 — Circuit breaker abierto → falla rápido
**Dado** que el circuit breaker del adapter está **abierto** (50%+ failure rate en últimas 10 requests),
**cuando** se invoca finalizar,
**entonces** la respuesta llega en **< 100ms** (no espera al timeout de 5s),
**y** la solicitud queda en `APPROVED + pendienteEnvioCore=true`,
**y** el response es **503 Service Unavailable** application/problem+json con `code: CORE_CIRCUIT_OPEN`.

### CA#6 — Solo SUPERVISOR/ADMIN puede finalizar
**Dado** un usuario con rol `ASESOR`,
**cuando** intenta `POST /solicitudes/:id/finalizar`,
**entonces** la respuesta es **403 Forbidden** y la solicitud no se modifica.

### CA#7 — Solo solicitudes APPROVED se pueden finalizar
**Dado** una solicitud en estado `DRAFT`, `IN_REVIEW`, o cualquier terminal,
**cuando** se invoca finalizar,
**entonces** la respuesta es **409 Conflict** (`InvalidStateTransitionError`)
**y** el cuerpo es application/problem+json con el detalle de la transición inválida.

### CA#8 — Auditoría
**Dado** cualquier invocación de finalizar (exitosa o fallida),
**cuando** se procesa,
**entonces** queda en el `historicoEstados` de la solicitud al menos un cambio (incluye intentos rollback en CA#2).

---

## Consideraciones de seguridad

| Vector | Mitigación |
|---|---|
| **Llamada no autorizada al Core** | Solo se llama tras validar internamente que la solicitud está en `APPROVED` y el rol es `SUPERVISOR` |
| **Doble apertura por race condition** | `Idempotency-Key` outbound + idempotencia in-app por id de solicitud |
| **Datos transaccionales en logs** | Logs solo registran `solicitudId`, `correlationId`, `event`, `status`. Nunca `numeroProducto` en claro ni datos del formulario |
| **Replay del JWT** | `exp: 15min` evita replay tardío; oncall puede revocar JWT específicos vía blacklist (no implementado en mock) |
| **Circuit breaker como escudo** | Cierra el camino al Core si está degradado, evitando cascada de timeouts a Mongo y otros |
| **HMAC body firmado** | Documentado en contrato; opcional para mock, obligatorio en producción |
| **Rate limit por usuario** | Adicional al global: throttler específico documentado para `:id/finalizar` (TODO sprint 2) |

---

## Implementación

| Pieza | Archivo |
|---|---|
| Use case | `src/modules/solicitudes/application/use-cases/finalizar-solicitud.usecase.ts` |
| Entity (rollback) | `src/modules/solicitudes/domain/entities/solicitud.entity.ts` (`regresarARevisionPorRechazoCore`) |
| Adapter | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.adapter.ts` |
| Mappers | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.mappers.ts` |
| Métricas | `src/shared/observability/metrics.service.ts` (`startCoreRequest`) |
| Tests | `scripts/smoke-api.sh` (CP-002 cubierto end-to-end) + `scripts/smoke-adapter.ts` (CP-003 retry) |
| Decisiones relacionadas | [`decisions.md` #4 — máquina de estados en VO](../decisions.md#4--máquina-de-estados-en-value-object), [`decisions.md` #5 — retry + circuit breaker](../decisions.md#5--retry--circuit-breaker-en-adapter-mulesoft) |

---

## Métricas y observabilidad

- **Histogram**: `core_banking_request_duration_seconds{endpoint="solicitarApertura", status="ok|error"}` — duración real cada llamada.
- **Gauge**: `solicitudes_estado_actual{estado=FINALIZED}` incrementa cuando éxito; `solicitudes_estado_actual{estado=IN_REVIEW}` incrementa en CA#2.
- **Trace**: span padre del request HTTP `POST /solicitudes/:id/finalizar` envuelve span hijo del adapter (axios) → permite ver latencia y errores correlacionados.
- **Logs estructurados** con `event: core_request_failed, status: 503, attempts: 3, correlationId, solicitudId` cuando aplica.

---

## Plan de retry diferido (CA#3, sprint 2)

Cuando una solicitud queda con `pendienteEnvioCore: true`:
1. Job programado (BullMQ) cada 5 min escanea `solicitudes` con `pendienteEnvioCore: true && estado=APPROVED && updatedAt > now() - 1h`.
2. Re-invoca `FinalizarSolicitudUseCase` con el mismo `solicitudId` (idempotencia preserva).
3. Si Core responde OK → solicitud → `FINALIZED`, flag false.
4. Si tras 6 intentos persiste, alerta a oncall + escalada manual.

(Job no implementado en esta prueba — documentado para sprint 2.)
