# HU-001 — Consultar productos elegibles para un cliente

> Historia técnica de integración Micrositio ↔ Core Bancario (vía Mulesoft).
> Endpoint: `GET /clientes/:tipoDoc/:numDoc/productos-elegibles`
> Implementación: `src/modules/clientes/clientes.controller.ts`

## Como
asesor del banco que está iniciando una solicitud para un cliente

## Quiero
ver el catálogo de productos para los que el cliente es elegible según las reglas del Core Bancario (KYC, segmentación, mora vigente)

## Para que
no inicie una solicitud de un producto que el Core va a rechazar más adelante, evitando reproceso y mala experiencia del cliente

---

## Criterios de aceptación

### CA#1 — Caso feliz
**Dado** un cliente identificado por `tipoDoc=CC` y `numDoc=1111111111` con **KYC APROBADO** en el Core,
**cuando** el asesor consulta `GET /clientes/CC/1111111111/productos-elegibles`,
**entonces** la respuesta es **200 OK** con la lista de productos elegibles (`AHO-001`, `TC-001`, `LI-001` en el mock)
**y** la respuesta incluye el header `x-correlation-id` propagado o generado.

### CA#2 — Reintento con backoff exponencial ante 5xx del Core
**Dado** que el Core responde **503 Service Unavailable** transitoriamente,
**cuando** el adapter Mulesoft hace la llamada,
**entonces** reintenta hasta **3 veces** con backoff exponencial (con jitter, base 200ms),
**y** si tras los reintentos persiste el 5xx, devuelve **503 application/problem+json** con `correlationId` en el cuerpo
**y** el log estructurado registra `event: core_unavailable, attempts: 3, correlationId: …` (sin filtrar el documento del cliente en claro).

### CA#3 — Cliente no existe en el Core
**Dado** que el cliente `4444444444` no existe en el Core,
**cuando** el asesor consulta,
**entonces** la respuesta es **404 Not Found** con cuerpo `application/problem+json`,
**y** el `detail` no contiene el documento del cliente en texto plano (solo el hash en logs, no en el response).

### CA#4 — Cache de 60s
**Dado** un cliente válido cuya consulta de productos elegibles fue exitosa hace menos de 60 segundos,
**cuando** se consulta de nuevo el mismo `tipoDoc + numDoc`,
**entonces** la respuesta proviene de cache local (medible: el campo `cache` en el body es `"HIT"` y el span de OTel hacia el Core no aparece)
**y** se sigue registrando un evento de auditoría con `accion: consultar.productos-elegibles.cache-hit`.

### CA#5 — Auditoría con hash del documento
**Dado** cualquier consulta válida de productos elegibles,
**cuando** se procesa,
**entonces** se inserta un documento en la colección `auditoria_eventos` con:
- `actor`: `id` del usuario JWT (no `username` ni nombre).
- `accion`: `consultar.productos-elegibles.cache-hit` o `cache-miss`.
- `recursoTipo`: `cliente`.
- `recursoId`: **hash SHA-256 de `${tipoDoc}:${numDoc}`** (nunca el documento en claro).
- `correlationId`: el de la request.
- `timestamp`: actual.

### CA#6 — Filtrado por KYC
**Dado** un cliente con **KYC PENDIENTE** (`numDoc=2222222222`),
**cuando** consulta productos elegibles,
**entonces** la respuesta solo incluye productos de **bajo riesgo** (cuenta de ahorros);
las tarjetas de crédito y créditos quedan filtrados por la regla del Core.

---

## Consideraciones de seguridad

| Vector | Mitigación implementada |
|---|---|
| **Acceso no autenticado** | Endpoint protegido por `JwtAuthGuard` global; sin Bearer JWT → 401 |
| **Privilegios excesivos** | `@Roles('ASESOR', 'SUPERVISOR', 'ADMIN')`; otros roles → 403 |
| **PII en logs** | Documento del cliente nunca en logs. Solo `SHA-256(tipoDoc:numDoc)` en audit |
| **Cache poisoning** | Cache es **per-instance** y key incluye `tipoDoc + numDoc` exactos; cliente no controla la key |
| **SSRF outbound al Core** | Allowlist de hosts en `MulesoftAdapter` (`localhost:4001`, `api.mulesoft.bcs.co`) |
| **Replay attack** | El JWT lleva `exp` corto (15 min); replay > 15min = 401 |
| **Rate limit** | Throttler global 60 req/min por IP |
| **Trazabilidad** | `correlationId` en cada log + audit + propagado al Core |

---

## Implementación

| Aspecto | Detalle |
|---|---|
| Endpoint | `GET /clientes/:tipoDoc/:numDoc/productos-elegibles` |
| Controller | `src/modules/clientes/clientes.controller.ts` |
| Service | `src/modules/auditoria/auditoria.service.ts` |
| Adapter | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.adapter.ts` |
| Tests | Smoke `pnpm smoke` (escenarios 1111, 2222, 4444 cubiertos) |
| ADR relacionado | `docs/adr/0005-retry-circuit-breaker-en-adapter.md` |

---

## Mocks / contrato Mulesoft

Definido en `openapi/core-banking.yaml`:

```yaml
GET /core/v1/clientes/{tipoDoc}/{numDoc}/productos-elegibles
  parameters:
    - X-Correlation-Id (header, optional)
  responses:
    200: ProductosElegiblesResponse
    404: ProblemDetails
    503: ProblemDetails
```

Documentos determinísticos en `bcs-core-mock`:
- `1111111111` → 3 productos (KYC APROBADO)
- `2222222222` → 1 producto (KYC PENDIENTE, solo ahorros)
- `4444444444` → 404
- `3333333333` → 503 dos veces, luego 200 (prueba retry)

---

## Métricas

- **Counter**: cada llamada al endpoint incrementa el counter HTTP por defecto (`http_requests_total`).
- **Histogram**: `core_banking_request_duration_seconds{endpoint="consultarProductosElegibles", status="ok|error"}` (cuando se invoque el adapter via finalizar).
- **Audit events**: 1 documento por consulta en colección `auditoria_eventos`.

## Loose ends

- Cache es in-memory (per-instance). Para multi-instancia → mover a Redis con misma TTL (ADR de futuro).
- HMAC opcional de la request al Core (firma del request body): documentado en ADR-0005, deferido a producción real.
