# Estrategia de Calidad — Plataforma de Solicitudes Digitales BCS

> Autor: Líder Técnico · Documento vivo · v1.0
> Marco de referencia: **ISTQB Foundation Level v4.0** + complementos modernos (DORA, observability-driven testing, contract testing).

## 1. Objetivo

Definir la estrategia de calidad de la plataforma de solicitudes digitales BCS de forma que:
1. Las **decisiones de calidad sean trazables** desde requisito → CA → caso de prueba → defecto.
2. La **cobertura sea proporcional al riesgo de cada componente**, no uniforme.
3. El equipo (Backend, Frontend, QA) tenga **rituales claros** para refinamiento, ejecución y cierre.
4. Los **defectos detectados aporten información** (ambiente, evidencia, correlationId) para reproducir y arreglar rápido.

No es una colección exhaustiva de pruebas — es la **regla de cómo decidimos qué probar y dónde**.

---

## 2. Principios

| Principio ISTQB | Aplicación en este proyecto |
|---|---|
| **Las pruebas exhaustivas son imposibles** | Foco en caminos críticos del dominio (máquina de estados, integración Core, idempotencia). No perseguimos coverage 100%. |
| **Las pruebas tempranas ahorran tiempo y dinero** | TDD ligero en el VO `EstadoSolicitud`. Refinement con "3 amigos" antes de codificar. |
| **Agrupación de defectos** | El módulo `solicitudes/` concentra el riesgo (estados + integración + idempotencia). Recibe el 80% del esfuerzo de prueba. |
| **Paradoja del pesticida** | Rotamos qué tipo de pruebas se priorizan en cada sprint. Variamos datos de seed. |
| **Las pruebas dependen del contexto** | Un microsito de banca tiene costes regulatorios distintos a un blog. Tests de seguridad y de auditoría son first-class. |
| **Falacia de la ausencia de errores** | "Verde" no es lo mismo que "correcto para el cliente". Demos a stakeholders + UX testing manual son parte del DoD. |

---

## 3. Pirámide objetivo

```
       ┌──────────────────┐
       │   E2E (10%)      │  Playwright + axe-core (frontend), Supertest e2e (backend)
       ├──────────────────┤
       │ Integración (20%)│  Use case + Mongo en memoria; Controlador + DB
       ├──────────────────┤
       │  Unit (70%)      │  VO de estado, mappers, use cases con mocks
       └──────────────────┘
```

**Coverage objetivo realista** (no es target 100%):
- Backend, módulo `solicitudes/`: **70%+**.
- Backend, capas auxiliares: 50%+.
- Frontend, componentes críticos (wizard, login, listado): **50%+**.
- Frontend, componentes shadcn/ui reutilizados: 0% (ya cubiertos por upstream).

---

## 4. Niveles de prueba (ISTQB §2.2)

| Nivel | Qué verifica | Herramienta | Ubicación | Cuándo corre |
|---|---|---|---|---|
| **Componente (unit)** | Lógica pura: VO, mappers, use cases con mocks de puertos | Jest | `src/**/*.spec.ts` | En cada commit local + CI |
| **Integración** | Capas reales conectadas (use case + Mongoose + mongodb-memory-server) | Jest + Supertest + mongodb-memory-server | `test/integration/*.spec.ts` | CI |
| **Sistema (API e2e)** | Flujos CRUD completos contra la app real (sin mocks) + core-mock corriendo | Supertest contra app NestFactory.create | `test/e2e/*.e2e-spec.ts` | CI nightly + pre-merge |
| **Frontend componente** | Wizard, login form, validaciones | Vitest + Testing Library | `__tests__/*.test.tsx` | En cada commit local + CI |
| **Frontend e2e** | Login → wizard → finalizar (flujo crítico) | Playwright + axe-core | `e2e/*.spec.ts` | CI nightly + pre-deploy |
| **Contrato** | Validación de respuestas del API contra el OpenAPI publicado | [Schemathesis](https://schemathesis.readthedocs.io) | CI manual / opcional | Cuando cambia el contrato |
| **Smoke (post-deploy)** | `/health/ready` + 1-2 endpoints clave en producción | Script bash en pipeline | `scripts/smoke-api.sh` | Tras cada deploy |

---

## 5. Tipos de prueba (ISTQB §4)

### 5.1 Funcionales
- Aceptación de cada historia (Gherkin: Dado/Cuando/Entonces).
- Tests por **transición válida e inválida** de la máquina de estados (42 casos en `estado-solicitud.vo.spec.ts`).
- Idempotencia: misma `Idempotency-Key` → misma respuesta sin duplicar.

### 5.2 No-funcionales

| Atributo (ISO 25010) | Cómo se prueba |
|---|---|
| **Rendimiento** | k6 script (`docs/qa/perf/k6-create.js`, documentado, ejecución bajo demanda). Objetivo: p95 < 500ms en `POST /solicitudes` con 50 RPS sostenidas. |
| **Seguridad** | OWASP Top 10 abordado por diseño + tests específicos: JWT expirado/falsificado → 401, payload con `__proto__` → rechazado por `whitelist:true`, NoSQL injection en `numDoc` → bloqueado por `express-mongo-sanitize`. |
| **Usabilidad / a11y** | `@axe-core/playwright` corre en cada e2e del frontend. WCAG 2.1 AA es el target. |
| **Confiabilidad** | Tests del adapter Mulesoft contra mock con escenarios 503/422 (validan retry y rollback). |
| **Mantenibilidad** | Coverage + complejidad ciclomática vigilada. Lint con `eslint-config-prettier`. |

### 5.3 Estructurales
- `pnpm test:cov` genera reporte de Jest. CI falla si baja del umbral en módulos críticos.

### 5.4 Regresión
- Toda la suite (unit + integración + e2e API) corre en cada PR.
- Smoke en producción tras cada deploy.

### 5.5 Confirmación (re-test)
- Tras corregir un defecto, **se añade un test que reproduce el defecto antes de mergear**. Es DoD. Sin test, sin merge.

---

## 6. Mínimo viable de tests reales (lo que está en el repo)

### Backend
- **Unit (42 tests)** sobre la máquina de estados — `src/modules/solicitudes/domain/value-objects/estado-solicitud.vo.spec.ts`. Cubre las 7 transiciones válidas + 23 inválidas + terminales + inmutabilidad.
- **Integración (3 tests)** sobre el flujo crear/transicionar — `test/integration/solicitudes.int-spec.ts`. Usa `mongodb-memory-server`.
- **E2E (1 test)** que recorre crear → enviar a revisión → aprobar → finalizar contra core-mock real — `test/e2e/solicitudes.e2e-spec.ts`.
- **Smoke API (24 checks)** vía bash + curl — `scripts/smoke-api.sh`. Cubre auth + roles + transiciones + Idempotency-Key + rollback Core 422.
- **Smoke adapter (7 checks)** del MulesoftAdapter — `scripts/smoke-adapter.ts`. Cubre happy path, 404, 422, retry recovery, KYC filtering.

### Frontend
- **Unit (2 tests)** del schema de validación del wizard — `__tests__/wizard-schema.test.ts`.
- **E2E + a11y (1 test)** Playwright que cubre login → crear solicitud → ver en listado, con `@axe-core/playwright` validando cada pantalla — `e2e/happy-path.spec.ts`.

---

## 7. Liderazgo QA

### 7.1 Rol del QA en el ciclo
- **Refinement (3 amigos)**: cada historia se refina con PO + Dev + QA juntos. Salen los CA en Gherkin antes de planning. Sin CA, no entra a sprint.
- **Pair testing**: el QA hace pairing con el dev a la mitad de la implementación, no al final. Detecta ambigüedades temprano.
- **Definition of Done compartida** (ver Playbook de liderazgo): el QA es co-dueño junto con el dev.
- **Defect triage diario** (15 min asincrónico): el QA prioriza con el TL los bugs entrantes.

### 7.2 Rituales
| Ritual | Frecuencia | Salida |
|---|---|---|
| Refinement | Semanal | Historias con CA + estimación |
| Bug triage | Diario (async) | Bugs priorizados, dueño asignado |
| Test review | Por PR | Cobertura del cambio revisada por par |
| Mortems / postmortems | Tras incidente P1/P2 | RCA + acciones (sin culpa) |
| Calidad retro | Quincenal | Métricas DORA + ajustes a la pirámide |

### 7.3 Carrera del QA en el equipo
QA Engineer → QA Senior → SDET (test infra) o QA Lead (estrategia + onboarding). El QA no es un cuello de botella final: es un asesor en todo el flujo.

---

## 8. Métricas DORA (instrumentadas, no medidas longitudinalmente en esta prueba)

| Métrica | Cómo se captura | Target inicial |
|---|---|---|
| **Lead time for changes** | Diff entre primer commit en branch y merge a main (GitHub API en CI) | < 3 días |
| **Deployment frequency** | Conteo de deploys etiquetados en producción | ≥ 1 por día por servicio |
| **Change failure rate** | Releases con rollback / total releases | < 15% |
| **Time to restore service (MTTR)** | Tiempo entre alerta y resolución (PagerDuty + Linear) | < 1 hora para P1 |

> En esta prueba técnica las métricas están **instrumentadas conceptualmente** pero no medidas longitudinalmente — necesitarías al menos 30 días de datos.

---

## 9. Gestión de defectos

### 9.1 Severidad
| Severidad | Definición | SLA |
|---|---|---|
| **S1 - Crítico** | Plataforma caída o pérdida/corrupción de datos | Atender en < 30 min, fix < 4 h |
| **S2 - Alto** | Funcionalidad core rota (ej. crear solicitud) | Fix mismo día |
| **S3 - Medio** | Feature secundaria afectada con workaround | Fix en sprint actual |
| **S4 - Bajo** | UI minor, typos, enhancement | Backlog |

### 9.2 Plantilla de bug
Disponible en `.github/ISSUE_TEMPLATE/bug.yml`:
- Título descriptivo (verbo + objeto + condición).
- Severidad (S1-S4) + prioridad (P1-P4).
- Pasos para reproducir (incluyendo datos: documento del cliente, producto, JWT del usuario).
- Resultado esperado vs obtenido.
- **Evidencia**: HAR, screenshot, logs con `correlationId`.
- Ambiente (dev/staging/prod) + commit SHA.
- `correlationId` del log que evidencia el problema (clave para trazabilidad cross-stack).

### 9.3 Bug → corrección → confirmation
1. QA reproduce y agrega `correlationId` + ambiente.
2. Dev escribe **un test que falle** reproduciendo el bug.
3. Dev arregla → el test pasa.
4. PR con tag "fix:" + referencia al issue. CI corre suite completa.
5. Merge → deploy → QA confirma en staging → cierra.

---

## 10. Ambientes y datos

| Ambiente | Uso | Datos |
|---|---|---|
| **dev** (local) | Desarrollo | Atlas free tier + core-mock + seed determinístico |
| **CI** | PR validation | mongodb-memory-server (efímero) |
| **staging** | Validación pre-prod | Mongo gestionado + core-mock con datos de prueba |
| **production** | Real | Mongo gestionado + Mulesoft real |

**Datos sensibles**: Documentos de los clientes nunca aparecen en logs en claro (SHA-256 en auditoría). Las `Idempotency-Key` y `correlationId` no contienen PII.

---

## 11. Plan de mejora continua

| Mejora propuesta | Cuándo |
|---|---|
| Mutation testing en `estado-solicitud.vo` con [Stryker](https://stryker-mutator.io) | Sprint 2 |
| Contract testing automatizado entre frontend ↔ backend con Pact | Sprint 3 |
| Performance budget en pipeline (k6 + thresholds) | Sprint 3 |
| Caos testing en adapter Mulesoft (latency injection) | Sprint 4 |
| Visual regression testing del frontend (Chromatic / Percy) | Sprint 4 |

---

## Anexo A — Casos de prueba críticos

### CP-001 — Crear solicitud con Idempotency-Key duplicada
**Origen**: HU-CRUD-Solicitudes
**Tipo**: Funcional, integración
**Pasos**:
1. POST /solicitudes con header `Idempotency-Key: ABC` y body válido.
2. POST /solicitudes con MISMA `Idempotency-Key: ABC` y mismo body.
3. POST /solicitudes con MISMA `Idempotency-Key: ABC` y body distinto.
**Esperado**: Paso 1 → 201. Paso 2 → 201, mismo `id`. Paso 3 → 201, mismo `id` (la idempotencia ignora el body cambiado por design — el primer cuerpo gana).

### CP-002 — Rollback Core 422 → IN_REVIEW (HU-002 CA#3)
**Origen**: HU-002
**Tipo**: Funcional, e2e
**Pasos**:
1. Crear solicitud para cliente `5555555555` (escenario que el Core rechaza).
2. Enviar a revisión + aprobar.
3. POST /solicitudes/:id/finalizar.
**Esperado**: HTTP 422 con Problem Details. La solicitud queda en `IN_REVIEW` con `motivoRechazo` poblado. El historial muestra `APPROVED → IN_REVIEW`.

### CP-003 — Reintento del Core con backoff exponencial
**Origen**: [decisión #5](../decisions.md#5--retry--circuit-breaker-en-adapter-mulesoft), smoke adapter
**Tipo**: No-funcional (resiliencia), unit + e2e
**Pasos**: Llamar `solicitarApertura` con `numDoc=3333333333` (mock falla 503 los primeros 2 intentos).
**Esperado**: Tras ~1.5s (200ms + 600ms backoff) la llamada eventualmente tiene éxito. Histogram `core_banking_request_duration_seconds` registra la duración total.

### CP-004 — Transición inválida es rechazada con 409
**Origen**: Máquina de estados
**Tipo**: Funcional, unit + e2e
**Pasos**: Crear solicitud DRAFT, intentar `POST /solicitudes/:id/aprobar` directamente.
**Esperado**: 409 Conflict con `application/problem+json` y `correlationId` en el cuerpo.

### CP-005 — JWT expirado retorna 401
**Origen**: Seguridad, OWASP A07
**Tipo**: Funcional, integración
**Pasos**: Generar JWT con `exp` en el pasado, llamar `GET /solicitudes`.
**Esperado**: 401 Unauthorized. Log estructurado con `event: "jwt_expired"`, sin filtrar el token.
