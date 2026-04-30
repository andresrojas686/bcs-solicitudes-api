# ADR-0005 — Retry exponencial + circuit breaker en el adapter Mulesoft

* **Estado**: Aceptado
* **Fecha**: 2026-04-29

## Contexto

La integración con el Core Bancario vía Mulesoft es **inherentemente inestable**:
- El gateway puede tener picos de latencia.
- El Core puede caer por mantenimientos.
- Errores transitorios (5xx, ECONNRESET) son normales en redes corporativas.

Sin protección, cada request a `POST /solicitudes/:id/finalizar` se vería afectada uno-a-uno por estos problemas, generando experiencia rota para los asesores y, peor aún, **inconsistencias** (solicitudes APPROVED sin producto en Core).

## Decisión

Implementamos en `MulesoftAdapter` tres capas combinadas:

### Capa 1 — Timeout
- `axios` con `timeout: 5000ms`.
- Timeout sobrescrito por la siguiente capa para dar tiempo a los reintentos.

### Capa 2 — Retry con backoff exponencial
- Librería `axios-retry`.
- **3 reintentos** (4 intentos totales).
- Backoff exponencial con jitter base 200ms (`exponentialDelay(retryCount, undefined, 200)`).
- **Solo se reintenta** en `5xx` o errores de red (`isNetworkError`). 4xx son errores de negocio: no se reintentan.

### Capa 3 — Circuit breaker
- Librería `opossum`.
- **Threshold**: 50% de error rate sobre 10 requests recientes (`volumeThreshold: 10`).
- **Recovery**: 30 segundos en estado `OPEN` antes de pasar a `HALF_OPEN`.
- **Fallback**: lanza `CoreBankingCircuitOpenError` para fallar rápido (< 100ms) sin esperar el timeout.

### Principio: 4xx vs 5xx

| Tipo | Significado | Acción |
|---|---|---|
| **4xx (4xx Bad Request, 422 validación de negocio)** | Error de negocio o cliente | NO reintentar; mapear a `CoreBankingBusinessError` y devolver al caller |
| **5xx, network errors** | Falla transitoria del Core | Reintentar; si persiste, abrir circuit breaker |

Esto está alineado con HU-002 CA#2 vs CA#3:
- 4xx → solicitud regresa a IN_REVIEW (rechazo de negocio).
- 5xx → solicitud queda APPROVED + flag pendienteEnvioCore (retry diferido).

## Consecuencias

### Positivas
- **Smoke test verifica funcionamiento**: cliente `3333333333` (mock falla 503 los primeros 2 intentos) eventualmente exitosa, latencia ~1.5s. Test pasa.
- Si el Core cae completamente, los asesores reciben **503 explícito en < 100ms** (no esperan 15s antes de saber que algo está roto).
- Histogram de latencia hacia el Core (`core_banking_request_duration_seconds`) discrimina entre OK y errores.

### Negativas
- **Complejidad agregada**: el adapter tiene ~200 líneas. Cualquier cambio toca: axios config + retry policy + breaker policy + mapper de errores.
- **Estado del circuit breaker es per-instance** (en memoria). En multi-instancia, cada réplica decide independientemente. Aceptable para Sprint 1 — para multi-instancia con coordinación se evaluaría Hystrix-style con Redis (sprint 3+).

### Mitigaciones
- Una sola dependencia hace el patrón (`opossum`); su mantenimiento no es nuestro problema.
- Tests del adapter cubren los caminos: `smoke-adapter.ts` con 7 escenarios (happy, retry, 4xx mapping, abandonar).

## Idempotencia outbound

Toda llamada al Core lleva `Idempotency-Key` derivado del `solicitudId` + `nanoid(6)`. El Core mock lo respeta: el mismo key sobre el mismo doc no abre dos productos.

## Configuración

| Variable | Default | Propósito |
|---|---|---|
| `CORE_MOCK_URL` | `http://localhost:4001` | URL base del adapter |
| `CORE_BANKING_TIMEOUT_MS` | `5000` | Timeout por intento |
| `CORE_BANKING_MAX_RETRIES` | `3` | Reintentos del adapter |

Defaults documentados en `src/config/env.schema.ts`.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Solo retry, sin circuit breaker** | Cuando el Core cae completamente, cada request consume 4 intentos × 5s = 20s. Pésima UX y carga el Core caído. |
| **Solo circuit breaker, sin retry** | Picos transitorios provocan errores que con un retry simple se hubieran resuelto. |
| **Resilience4j-style por jerarquía manual** | Reinventar la rueda. Las dos libs (`axios-retry` + `opossum`) son maduras y pequeñas. |

## Validación

- Tests del adapter: `pnpm smoke` → 7/7 verde.
- Smoke API: cliente `3333333333` (retry recovery), `5555555555` (4xx no-retry).
