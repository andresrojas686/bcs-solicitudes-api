# BCS Solicitudes Digitales — Handbook técnico

> Documento único que consolida toda la documentación del proyecto.
> Pensado para lectura lineal o por secciones según el rol del lector.
>
> **v1.0 · Autor:** Líder Técnico · **Fecha:** 2026-04-29

---

## Índice

1. [Setup de MongoDB Atlas (paso a paso)](#1--setup-de-mongodb-atlas-paso-a-paso)
2. [Decisiones arquitectónicas (7 ADRs consolidados)](#2--decisiones-arquitectónicas)
3. [Estrategia de calidad (ISTQB)](#3--estrategia-de-calidad-istqb)
4. [Playbook de liderazgo técnico](#4--playbook-de-liderazgo-técnico)
5. [Política de uso de IA en el equipo](#5--política-de-uso-de-ia-en-el-equipo)
6. [Prompts representativos usados con IA](#6--prompts-representativos-usados-con-ia)
7. [Historia técnica HU-001 — Productos elegibles](#7--hu-001--consultar-productos-elegibles-para-un-cliente)
8. [Historia técnica HU-002 — Finalizar solicitud en Core](#8--hu-002--finalizar-solicitud-aprobada-notificando-al-core)

---
---

# 1 · Setup de MongoDB Atlas (paso a paso)

Esta es la guía única para conectar el backend a MongoDB Atlas. Tiempo estimado: **~5 minutos**.

> **¿Por qué Atlas y no Docker?** Para esta prueba elegimos Atlas porque (1) el disco C: del candidato estaba ajustado y Docker añadiría 2-3 GB, (2) hardware con WSL2 ya disponible pero queríamos cero virtualización, (3) Atlas es el sabor de Mongo más realista para producción y muestra criterio de Líder Técnico al evaluador.

## 1.1 Crear cuenta en Atlas

1. Abre https://cloud.mongodb.com/
2. Si tienes cuenta Google/GitHub, usa SSO. Si no, regístrate con email.
3. Cuando pida "What is your goal?", elige **Build a new app**.

## 1.2 Crear el cluster M0 free

1. Click **+ Create** o **Build a Database**.
2. Plan **M0 — Free** (`$0/forever`).
3. Provider: **AWS**, Region: la más cercana (Colombia → `us-east-1`).
4. Cluster Name: `bcs-solicitudes-cluster` (puedes dejar default).
5. **Create Deployment** (1-3 minutos).

## 1.3 Crear usuario de base de datos

Wizard "Connect to Cluster":
1. **Username**: `bcs-app`
2. **Password**: usa **Autogenerate Secure Password** y **cópiala antes de cerrar la ventana**.
3. **Create User**.

> ⚠️ Si la contraseña tiene caracteres especiales (`@`, `:`, `/`, `?`, `#`, `[`, `]`), tendrás que URL-encodearla en `MONGODB_URI`. Para evitarlo, regenera hasta que sea solo alfanumérica + `_` o `-`.

## 1.4 Configurar Network Access

1. Sidebar → **Network Access** (sección Security).
2. **+ ADD IP ADDRESS** → **ALLOW ACCESS FROM ANYWHERE** (`0.0.0.0/0`) con descripción "Prueba técnica BCS — abierto temporalmente".
3. **Confirm**.

> ⚠️ En producción real **nunca** abriríamos `0.0.0.0/0`. Allowlist de IPs corporativas, VPN o VPC peering. Documentado en el README como trade-off conocido.

## 1.5 Obtener el connection string

1. Sidebar → **Database** → **Connect** en tu cluster → **Drivers** → Node.js v6.7+.
2. Copia el connection string:
   ```
   mongodb+srv://bcs-app:<password>@bcs-solicitudes-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=bcs-solicitudes-cluster
   ```
3. Reemplaza `<password>` con la real, **añade el nombre de la base de datos** entre `/` y `?`:
   ```
   mongodb+srv://bcs-app:TU_PASSWORD@bcs-solicitudes-cluster.xxxxx.mongodb.net/bcs-solicitudes?retryWrites=true&w=majority&appName=bcs-solicitudes-cluster
   ```

## 1.6 Pegar en `.env`

```bash
cd bcs-solicitudes-api
cp .env.example .env
# Edita .env: pega el connection string en MONGODB_URI y pon MONGODB_DB_NAME=bcs-solicitudes
```

## 1.7 Verificar conexión

```bash
pnpm install
pnpm dev
# en otra terminal:
curl http://localhost:3000/health/ready
```

Esperado: `{"status":"ok","info":{"mongo":{"status":"up"},"core-mock":{"status":"up"}}}`.

Problemas comunes si `mongo: down`:
1. Password mal copiada o no URL-encodeada.
2. IP no autorizada → confirma `0.0.0.0/0` en Network Access.
3. Falta el nombre de DB en el path (`/bcs-solicitudes`).

## 1.8 Inspeccionar datos (opcional)

Atlas → **Database** → **Browse Collections** → `bcs-solicitudes` → verás `solicitudes`, `idempotency_keys`, `auditoria_eventos` cuando reciban datos.

---
---

# 2 · Decisiones arquitectónicas

> Las decisiones son **inmutables**: si una cambia, se anexa una nueva al final con referencia a la reemplazada.

Las 7 decisiones clave del proyecto, formato Michael Nygard simplificado: contexto + decisión + trade-off + alternativas descartadas.

## 2.1 — Clean Architecture pragmática · Aceptado

**Contexto:** alta variabilidad de reglas por producto bancario + integración con Core externo cuyos contratos pueden cambiar.

**Decisión:** capas (`domain` / `application` / `infrastructure` / `interfaces`) **solo en el módulo crítico (`solicitudes/`)**. Otros módulos usan estructura más fina. El dominio no depende de Nest, Mongoose ni HTTP.

**Trade-off:**
- ✅ 42 unit tests del VO de estado corren en milisegundos sin tocar nada externo. Cambiar Mongoose toca solo `infrastructure/persistence/`.
- ❌ ~3-5 archivos por feature en Solicitudes. Curva de aprendizaje.
- 🛡️ Mitigación: documentación con diagrama, onboarding pair-programming, plantillas.

**Alternativas descartadas:** MVC tradicional NestJS (mezcla responsabilidades), Hexagonal "puro" (sobre-ingeniería para squad de 5), DDD completo con event sourcing (no justifica el costo).

## 2.2 — Mongoose 8 como ODM · Aceptado, revisable cada 2 trimestres

**Contexto:** MongoDB Atlas porque `datosFormulario` varía por producto. Necesitamos ODM con tipos compartidos, validación, queries idiomáticos y TTL indexes.

**Decisión:** Mongoose 8 con `@nestjs/mongoose` para integración con DI.

**Trade-off:**
- ✅ Estándar de facto Node + Mongo, soporte Atlas, hooks `pre/post`, TTL nativo, `mongodb-memory-server` para tests.
- ❌ Type-safety del schema débil: hay que mantener `interface SolicitudDocument` paralelo al `Schema`.
- 🛡️ Mitigación: ambos viven en el mismo archivo (`solicitud.schema.ts`).

**Alternativas descartadas:** driver oficial sin ODM (low-level), TypeORM con Mongo (soporte secundario, orientado a SQL), Prisma con Mongo (limitado, sin transacciones complejas, lock-in).

**Plan a futuro:** si los datos se vuelven altamente relacionales, considerar dual-write a Postgres antes de migración completa.

## 2.3 — JWT mock vs Keycloak · Aceptado para la prueba, reemplazable en sprint 1 productivo

**Contexto:** se requiere autenticación con roles (`ASESOR`, `SUPERVISOR`, `ADMIN`). En producción BCS usaría Keycloak. Integrar Keycloak excede el time-box.

**Decisión:** JWT firmado HS256 por el backend. Tres usuarios sembrados con bcrypt en memoria.

**Trade-off:**
- ✅ Permite mostrar la arquitectura completa de autorización sin overhead. Tests e2e funcionan sin dependencia externa.
- ❌ **NO listo para producción**: sin rotación de secret, sin revocación, sin refresh tokens.
- 🛡️ Reemplazo localizable a `auth.module.ts` (~2 días de un dev senior).

**Plan de migración a Keycloak (sprint 1):** reemplazar `Credentials Provider` por validación JWKS contra Keycloak (RS256), claims de roles desde `realm_access.roles`. El frontend cambia el provider de `Credentials` a `Keycloak` en NextAuth.

**Alternativas descartadas:** OAuth completo con Keycloak en Docker, sin auth ("público"), Auth0 hosted free.

## 2.4 — Máquina de estados en Value Object · Aceptado

**Contexto:** una solicitud atraviesa 6 estados con transiciones rígidas. Las transiciones inválidas son bug crítico (apertura sin revisión, auditoría falsa).

**Decisión:** Value Object inmutable `EstadoSolicitud` con tabla constante `ALLOWED` y método `transitionTo(target): Result<EstadoSolicitud, InvalidStateTransitionError>`.

**Tabla autoritativa:**
```
DRAFT     → IN_REVIEW | ABANDONED
IN_REVIEW → APPROVED  | REJECTED | ABANDONED
APPROVED  → FINALIZED | ABANDONED
REJECTED | FINALIZED | ABANDONED → terminal
```

**Excepción de negocio** (HU-002 CA#3): `regresarARevisionPorRechazoCore()` permite `APPROVED → IN_REVIEW` cuando el Core rechaza con 4xx.

**Trade-off:**
- ✅ 42 unit tests cubren todas las transiciones (7 válidas + 23 inválidas) en < 100ms. Imposible introducir transición ilegal sin romper tests.
- ❌ Una transición legítima nueva requiere tocar `ALLOWED`, los tests y este documento.

**Alternativas descartadas:** enum + if/else (las reglas se duplican y divergen), [xstate](https://xstate.js.org) (overkill para 6 estados sin sub-estados).

## 2.5 — Retry + circuit breaker en adapter Mulesoft · Aceptado

**Contexto:** la integración con el Core es inherentemente inestable (latencia, mantenimientos, errores de red). Sin protección, cada request se afecta uno-a-uno.

**Decisión:** tres capas combinadas en `MulesoftAdapter`:
1. **Timeout**: axios `timeout: 5000ms`.
2. **Retry**: `axios-retry` 3 reintentos, backoff exponencial + jitter, **solo en 5xx y errores de red**.
3. **Circuit breaker**: `opossum` threshold 50% sobre 10 requests, recovery 30s, fallback `CoreBankingCircuitOpenError` (< 100ms).

**Principio 4xx vs 5xx:**

| Tipo | Significado | Acción |
|---|---|---|
| 4xx (especialmente 422) | Error de negocio | NO reintentar; mapear a `CoreBankingBusinessError` |
| 5xx + network errors | Falla transitoria | Reintentar; si persiste, circuit breaker abre |

Alineado con HU-002: 4xx → IN_REVIEW; 5xx tras retries → APPROVED + flag `pendienteEnvioCore`.

**Idempotencia outbound:** toda llamada al Core lleva `Idempotency-Key` derivado del `solicitudId`.

**Trade-off:**
- ✅ Si el Core cae, asesor recibe 503 explícito en < 100ms en vez de esperar 15s.
- ❌ Estado del circuit breaker es per-instance (en memoria). Adapter ~200 líneas.
- 🛡️ Para coordinación cross-instance considerar Hystrix-style con Redis en sprint 3+.

**Alternativas descartadas:** solo retry (cuando el Core cae, 4 intentos × 5s = 20s), solo CB (picos transitorios provocan errores).

## 2.6 — Observabilidad: pino + Prometheus + OpenTelemetry · Aceptado

**Contexto:** plataforma de banca interna debe ser observable end-to-end. Necesitamos los 3 pilares con costo proporcional al equipo.

**Decisión:**

| Pilar | Stack |
|---|---|
| **Logs** | `pino` + `nestjs-pino` con redacción de PII automática + `correlationId` por request via `AsyncLocalStorage` |
| **Métricas** | `prom-client` + `@willsoto/nestjs-prometheus`, endpoint `/metrics` público |
| **Traces** | OpenTelemetry SDK con auto-instrumentations (HTTP, mongoose, axios, dns) |

**Métricas custom de negocio:** `solicitudes_creadas_total{producto}`, `solicitudes_estado_actual{estado}`, `core_banking_request_duration_seconds{endpoint,status}`.

**Trade-off:**
- ✅ Un solo `correlationId` atraviesa Nest → Mongoose → adapter → Core mock. Sin lock-in: stacks abiertos consumibles por Datadog, Grafana, Honeycomb.
- ❌ OTel auto-instrumentation puede ser ruidosa en dev.
- 🛡️ `ignoreLayers` en `otel.ts`, toggle `OTEL_SDK_DISABLED=true`.

**Alternativas descartadas:** solo logs (insuficiente para latencia cross-service), Datadog APM con agent (lock-in y caro), Winston (5-10x más lento que pino).

## 2.7 — Uso de IA en desarrollo: política y guardrails · Aceptado

**Contexto:** la IA generativa multiplica productividad cuando se usa con criterio. Sin política, los riesgos son: filtrar PII a un LLM externo, aprobación ciega en zonas críticas, decisiones arquitectónicas sin firma humana.

**Decisión:** política explícita con guardrails (sección [5](#5--política-de-uso-de-ia-en-el-equipo) de este handbook).

| ✅ SÍ con IA | ❌ NO con IA |
|---|---|
| Boilerplate (DTOs, mappers, módulos) | PII / secrets a un LLM externo |
| Tests adicionales sobre código existente | Aprobar el propio PR sin segunda revisión |
| Refactor mecánico | Decisiones arquitectónicas sin firma humana |
| Primer borrador de docs y ADRs | Código en zonas críticas sin revisión profunda |
| Refinement de historias y CA | Sustituir el code review humano |

**Evidencia:** trailer `Assisted-by: Claude Code` en commits relevantes; sección [6](#6--prompts-representativos-usados-con-ia) documenta los 10 prompts representativos.

**Trade-off:**
- ✅ ~30% de tiempo ahorrado en boilerplate y tests exhaustivos.
- ❌ Riesgo de dependencia y homogeneización.
- 🛡️ Code review humano no-negociable. Política revisable cada 2 trimestres.

---
---

# 3 · Estrategia de calidad (ISTQB)

> Marco de referencia: **ISTQB Foundation Level v4.0** + complementos modernos (DORA, observability-driven testing, contract testing).

## 3.1 Objetivo

1. **Decisiones de calidad trazables** desde requisito → CA → caso de prueba → defecto.
2. **Cobertura proporcional al riesgo**, no uniforme.
3. **Rituales claros** para refinamiento, ejecución y cierre.
4. **Defectos detectados aportan información** (ambiente, evidencia, correlationId) para reproducir y arreglar rápido.

No es una colección exhaustiva de pruebas — es la **regla de cómo decidimos qué probar y dónde**.

## 3.2 Principios ISTQB aplicados

| Principio | Aplicación |
|---|---|
| Las pruebas exhaustivas son imposibles | Foco en caminos críticos (máquina de estados, integración Core, idempotencia). No perseguimos coverage 100%. |
| Las pruebas tempranas ahorran tiempo y dinero | TDD ligero en el VO `EstadoSolicitud`. Refinement con "3 amigos" antes de codificar. |
| Agrupación de defectos | El módulo `solicitudes/` concentra el riesgo. Recibe el 80% del esfuerzo de prueba. |
| Paradoja del pesticida | Rotamos qué tipo de pruebas se priorizan en cada sprint. |
| Las pruebas dependen del contexto | Microsito de banca → tests de seguridad y auditoría son first-class. |
| Falacia de la ausencia de errores | "Verde" ≠ "correcto para el cliente". Demos a stakeholders + UX testing manual son parte del DoD. |

## 3.3 Pirámide objetivo

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
- Frontend, componentes críticos: **50%+**.
- Frontend, componentes shadcn/ui reutilizados: 0% (cubiertos por upstream).

## 3.4 Niveles de prueba (ISTQB §2.2)

| Nivel | Qué verifica | Herramienta | Cuándo corre |
|---|---|---|---|
| **Componente (unit)** | Lógica pura: VO, mappers, use cases con mocks | Jest | Cada commit + CI |
| **Integración** | Use case + Mongoose + mongodb-memory-server | Jest + Supertest | CI |
| **Sistema (API e2e)** | Flujos CRUD completos contra app real + core-mock | Supertest contra `NestFactory.create` | CI nightly + pre-merge |
| **Frontend componente** | Wizard, login form, validaciones | Vitest + Testing Library | Cada commit + CI |
| **Frontend e2e** | Login → wizard → finalizar | Playwright + axe-core | CI nightly + pre-deploy |
| **Contrato** | Validación de respuestas del API contra OpenAPI | [Schemathesis](https://schemathesis.readthedocs.io) | CI manual |
| **Smoke (post-deploy)** | `/health/ready` + endpoints clave | Bash + curl | Tras cada deploy |

## 3.5 Tipos de prueba (ISTQB §4)

### Funcionales
- CA de cada historia (Gherkin: Dado/Cuando/Entonces).
- Transiciones válidas e inválidas de la máquina de estados (42 casos).
- Idempotencia: misma `Idempotency-Key` → misma respuesta sin duplicar.

### No-funcionales (ISO 25010)

| Atributo | Cómo se prueba |
|---|---|
| **Rendimiento** | k6 documentado. Objetivo: p95 < 500ms en `POST /solicitudes` con 50 RPS. |
| **Seguridad** | OWASP Top 10 + tests específicos: JWT expirado → 401, payload con `__proto__` → rechazado, NoSQL injection → bloqueado. |
| **Usabilidad / a11y** | `@axe-core/playwright` en cada e2e del frontend. WCAG 2.1 AA target. |
| **Confiabilidad** | Tests del adapter contra mock con escenarios 503/422. |
| **Mantenibilidad** | Coverage + lint con `eslint-config-prettier`. |

### Estructurales
- `pnpm test:cov` genera reporte. CI falla si baja del umbral en módulos críticos.

### Regresión
- Toda la suite (unit + integración + e2e API) corre en cada PR.

### Confirmación (re-test)
Tras un defecto, **se añade un test que reproduce el defecto antes de mergear**. Es DoD. Sin test, sin merge.

## 3.6 Tests reales en el repo

### Backend (88 verde)
- **Unit (42 tests)**: máquina de estados — `estado-solicitud.vo.spec.ts`. Cubre 7 transiciones válidas + 23 inválidas + terminales + inmutabilidad.
- **Integración (4 tests)**: use cases con `mongodb-memory-server` — `test/integration/solicitudes.int-spec.ts`.
- **Smoke API (24 checks)**: bash + curl — `scripts/smoke-api.sh`. Cubre auth + roles + transiciones + idempotencia + rollback Core 422.
- **Smoke adapter (7 checks)**: MulesoftAdapter — `scripts/smoke-adapter.ts`. Cubre happy path, 404, 422, retry recovery, KYC filtering.

### Frontend (11 verde)
- **Unit (8 tests)**: `wizard-schema.test.ts` (5) + `estado-badge.test.tsx` (3).
- **E2E + a11y (3 tests)**: Playwright — login, dashboard+listado, wizard de 3 pasos. axe-core en cada pantalla.

## 3.7 Liderazgo QA

### Rol del QA en el ciclo
- **Refinement (3 amigos)**: PO + Dev + QA juntos. CA en Gherkin antes de planning. Sin CA, no entra a sprint.
- **Pair testing**: QA pair-programa con dev a la mitad de la implementación, no al final.
- **DoD compartido**: el QA es co-dueño junto con el dev.
- **Defect triage diario** (15 min asincrónico): QA prioriza con el TL.

### Rituales

| Ritual | Frecuencia | Salida |
|---|---|---|
| Refinement | Semanal | Historias con CA + estimación |
| Bug triage | Diario (async) | Bugs priorizados |
| Test review | Por PR | Cobertura del cambio revisada |
| Postmortems | Tras incidente P1/P2 | RCA + acciones (sin culpa) |
| Calidad retro | Quincenal | Métricas DORA + ajustes a la pirámide |

### Carrera del QA
QA Engineer → QA Senior → SDET (test infra) o QA Lead (estrategia + onboarding). El QA es asesor en todo el flujo, no cuello de botella final.

## 3.8 Métricas DORA (instrumentadas, no medidas longitudinalmente)

| Métrica | Cómo se captura | Target |
|---|---|---|
| **Lead time for changes** | Diff primer commit → merge a main (GitHub API en CI) | < 3 días |
| **Deployment frequency** | Conteo de deploys etiquetados | ≥ 1 por día por servicio |
| **Change failure rate** | Releases con rollback / total | < 15% |
| **MTTR** | Tiempo entre alerta y resolución (PagerDuty + Linear) | < 1 hora para P1 |

> Instrumentadas conceptualmente; necesitas ≥30 días de datos para medición real.

## 3.9 Gestión de defectos

### Severidad y SLA

| Severidad | Definición | SLA |
|---|---|---|
| **S1 - Crítico** | Plataforma caída o pérdida de datos | Atender < 30 min, fix < 4h |
| **S2 - Alto** | Funcionalidad core rota | Fix mismo día |
| **S3 - Medio** | Feature secundaria con workaround | Fix en sprint actual |
| **S4 - Bajo** | UI minor, typos, enhancement | Backlog |

### Plantilla de bug

`.github/ISSUE_TEMPLATE/bug.yml` incluye: título descriptivo, severidad+prioridad, pasos para reproducir (con datos: documento, producto, JWT user), resultado esperado vs obtenido, **evidencia** (HAR, screenshot, logs con `correlationId`), ambiente + commit SHA, `correlationId`.

### Bug → corrección → confirmación
1. QA reproduce y agrega `correlationId` + ambiente.
2. Dev escribe **un test que falle** reproduciendo el bug.
3. Dev arregla → el test pasa.
4. PR con tag `fix:` + referencia al issue.
5. Merge → deploy → QA confirma en staging → cierra.

## 3.10 Ambientes y datos

| Ambiente | Uso | Datos |
|---|---|---|
| **dev** (local) | Desarrollo | Atlas free + core-mock + seed determinístico |
| **CI** | PR validation | mongodb-memory-server (efímero) |
| **staging** | Pre-prod | Mongo gestionado + core-mock |
| **production** | Real | Mongo gestionado + Mulesoft real |

**Datos sensibles:** documentos nunca en logs en claro (SHA-256 en auditoría). `Idempotency-Key` y `correlationId` no contienen PII.

## 3.11 Plan de mejora continua

| Mejora propuesta | Cuándo |
|---|---|
| Mutation testing en `estado-solicitud.vo` con [Stryker](https://stryker-mutator.io) | Sprint 2 |
| Contract testing con Pact | Sprint 3 |
| Performance budget en pipeline (k6 + thresholds) | Sprint 3 |
| Caos testing en adapter (latency injection) | Sprint 4 |
| Visual regression testing (Chromatic / Percy) | Sprint 4 |

## 3.12 Casos de prueba críticos

### CP-001 — Crear solicitud con Idempotency-Key duplicada
**Pasos:** POST con key `ABC` → POST con misma key `ABC` mismo body → POST con misma key `ABC` body distinto.
**Esperado:** los 3 → 201 con mismo `id` (la idempotencia ignora cambios de body — el primero gana).

### CP-002 — Rollback Core 422 → IN_REVIEW (HU-002 CA#3)
**Pasos:** crear solicitud para `5555555555` → enviar a revisión → aprobar → finalizar.
**Esperado:** HTTP 422 RFC 7807. Solicitud queda IN_REVIEW con `motivoRechazo`. Historial muestra `APPROVED → IN_REVIEW`.

### CP-003 — Reintento con backoff exponencial (sección [2.5](#25--retry--circuit-breaker-en-adapter-mulesoft--aceptado))
**Pasos:** llamar `solicitarApertura` con `numDoc=3333333333` (mock falla 503 los 2 primeros).
**Esperado:** tras ~1.5s (200ms + 600ms backoff) éxito. Histogram registra duración total.

### CP-004 — Transición inválida es rechazada con 409
**Pasos:** crear DRAFT, intentar `POST /solicitudes/:id/aprobar` directo.
**Esperado:** 409 Conflict con `application/problem+json` y `correlationId`.

### CP-005 — JWT expirado retorna 401
**Pasos:** generar JWT con `exp` pasado, `GET /solicitudes`.
**Esperado:** 401. Log estructurado con `event: "jwt_expired"`, sin filtrar el token.

---
---

# 4 · Playbook de liderazgo técnico

> Cómo opera el equipo: qué se decide, cuándo, con quién, y con qué nivel de calidad. Base sobre la cual el equipo se autoorganiza.

## 4.1 Modelo operativo

### Equipo
Squad de **5 personas** orientada a producto:
- 1 **Líder Técnico** — arquitectura, decisiones cross-stack, code review final, mentoría.
- 2 **Backend Engineers** — uno senior (Solicitudes/Core), uno mid (Productos/Auditoría).
- 1 **Frontend Engineer** — Next.js + a11y, dueño de wizards.
- 1 **QA Engineer** — estrategia, automatización, refinamiento (3 amigos).

> Sin PM dedicado en esta fase: el TL y un BPO interno priorizan. Cuando crece, se incorpora.

### Capacidad
- Sprints de **2 semanas**.
- Capacidad estimada conservadora: **30-35 SP/sprint** los primeros 3 sprints.
- **20% reservado** a deuda técnica/observabilidad/refactor.
- **No medimos velocity para comparar entre squads**, solo para predicibilidad propia.

### Roadmap de 4 sprints

| Sprint | Foco | KPI |
|---|---|---|
| 1 (ahora) | MVP CRUD + integración Core mock | Demo end-to-end al CIO |
| 2 | Hardening: tests, observabilidad real, audit log | Coverage 70%+, MTTR < 1h |
| 3 | Mulesoft real + staging + canary | Uptime 99.5% |
| 4 | Multi-canal (móvil) + nuevos productos | Time-to-market nuevo producto < 1 sprint |

## 4.2 Ceremonias

| Ceremonia | Frecuencia | Duración | Salida |
|---|---|---|---|
| **Daily** | Diario | 15 min (mitad asincrónica) | Bloqueos, próximos pasos |
| **Refinement** | Semanal | 60 min | Historias con CA + estimación |
| **Planning** | Bisemanal | 60 min | Sprint backlog comprometido |
| **Retro** | Quincenal | 60 min | 3 acciones concretas con dueño |
| **Demo a stakeholders** | Cada sprint | 30 min | Feedback + ajustes |
| **Tech sync (cross-squad)** | Quincenal | 30 min | Decisiones cross-cutting |
| **Postmortem** | Tras incidente P1/P2 | 60 min | RCA + acciones blameless |

### Asincronía explícita
Daily asincrónico lunes y miércoles (Slack thread con plantilla). Sólo síncrono martes/jueves. Respeta a quien empieza temprano y a quien necesita deep work.

### Demos a stakeholders
Cierran con: lo que vimos, lo que NO se logró y por qué (transparente, sin excusas), próximas decisiones que necesitamos del negocio.

## 4.3 Definition of Ready

Una historia entra a sprint sólo si:
- ✅ CA Gherkin (camino feliz + 2 alternativos).
- ✅ Mockup o ejemplo de payload acordado con frontend.
- ✅ Dependencias resueltas (ej. contrato Mulesoft confirmado).
- ✅ Estimación acordada por al menos 2 devs.
- ✅ Criterios no funcionales explícitos cuando aplican (ej. "p95 < 500ms", "WCAG AA").

Sin DoR → no se compromete.

## 4.4 Definition of Done

Una historia se cierra sólo cuando:
- ✅ Código mergeado a `main` con commits semánticos.
- ✅ Tests al nivel apropiado (unit + integración + smoke).
- ✅ Coverage no baja del umbral del módulo.
- ✅ Swagger/OpenAPI actualizado si cambia el API.
- ✅ Decisión documentada si introduce cambio arquitectónico.
- ✅ Revisión de seguridad (OWASP Top 10).
- ✅ Logs estructurados con `correlationId`.
- ✅ a11y verificada con axe-core (sin violaciones serias) si toca UI.
- ✅ Desplegado a staging y validado por QA.
- ✅ Documentación actualizada cuando aplica.

El QA es **co-dueño del DoD**.

## 4.5 Code review

### Reglas firmes
- **Máx 24h** para primer review de PR pequeño (< 200 líneas).
- **2 aprobaciones** para cambios en core (auth, máquina de estados, integración Core); 1 para cambios menores.
- **No mergea quien escribió** el código (excepción: hotfixes P1).
- **Anti-cross-aprovación**: una persona no aprueba dos PRs seguidos del mismo autor sin que un tercero también revise.

### Checklist del reviewer
1. Funcionalidad: ¿hace lo que dice la historia?
2. Tests: ¿al nivel apropiado, no solo unit?
3. Seguridad: validación de inputs, manejo de errores sin filtrar PII, autorización.
4. Observabilidad: logs y métricas en el camino crítico.
5. a11y: si toca UI — labels, focus, aria.
6. Mantenibilidad: nombres claros, comentarios solo cuando el "porqué" no es obvio.
7. Performance: ¿N+1 queries? ¿memory leaks?

### Cultura
- Comentarios sobre el código, no sobre la persona.
- Sugerencias, no órdenes ("¿qué te parece extraer X?" en vez de "extrae X").
- Aprobar con comentarios menores está bien; bloquear se reserva para issues reales.

## 4.6 Onboarding

| Día | Hito |
|---|---|
| Día 1 | Entorno funcionando: Atlas + backend + frontend. Acceso a repos, Linear, Slack. |
| Día 2 | Primer PR mergeado (typo, doc, o test pequeño). Pair con TL. |
| Semana 1 | Pair con un senior. Lee este Handbook, en especial secciones [2](#2--decisiones-arquitectónicas) (decisiones) y [3](#3--estrategia-de-calidad-istqb) (QA). |
| Semana 2 | Toma una historia pequeña end-to-end. |
| Mes 1 | Mentor asignado para 1:1 quincenales sobre carrera. |

**Mentor ≠ TL**: el mentor escucha; el TL evalúa. Separación intencional.

## 4.7 Deuda técnica

- Registrada en `tech-debt.md` con: descripción, impacto si no se atiende, costo estimado.
- **20% de capacidad por sprint** (no negociable).
- **Tech debt review mensual**: el TL prioriza con el squad qué entra.
- **Si hay 3 items P1 sin atender, no se compromete feature nueva** hasta resolver al menos 2.

## 4.8 Decision log (ADRs + RFCs)

### Decisiones arquitectónicas
- Una decisión = una sección en este Handbook (sección [2](#2--decisiones-arquitectónicas)).
- **Estados:** Propuesto → Aceptado → Reemplazado/Obsoleto.
- **No se borran**; se reemplazan con una nueva que cita la anterior.

### RFCs
Para cambios mayores (refactor de un módulo, cambio de stack, nueva integración) → RFC en `docs/rfc/` antes de implementar:
- Contexto · Propuesta · Alternativas · Trade-offs · Plan de implementación + rollback.

RFC abierto al squad **3 días hábiles**. Sin objeción mayor → se acepta.

## 4.9 Comunicación con negocio

### Traducción de métricas técnicas

| Métrica técnica | Cómo se cuenta al negocio |
|---|---|
| Uptime 99.5% | "≈3.5 horas de servicio interrumpido al mes" |
| p95 latencia 800ms | "1 de cada 20 asesores espera más de 800ms" |
| Coverage 70% | "Estimado: ~30% de probabilidad de defecto en zonas no cubiertas" |
| MTTR 1h | "Recuperación garantizada en 1 hora ante incidentes" |
| Change failure rate 10% | "9 de cada 10 deploys son seguros sin rollback" |

### Reportes ejecutivos
- **Mensual**: 1 página. Throughput, métricas DORA, riesgos abiertos, próximos hitos. Sin jerga técnica.
- **Postmortem ejecutivo**: tras P1, resumen sin culpa con acciones medibles.

## 4.10 Cultura

- **Blameless postmortems**: el sistema falló, no la persona. RCA enfoca proceso/herramienta/diseño.
- **"You build it, you run it"**: oncall rotativo después de 3 meses en la squad.
- **Psychological safety**: se puede decir "no sé" o "estamos rotos" sin consecuencias.
- **Trabajo profundo respetado**: bloques de 2-3h sin reuniones es la norma.
- **Documentar mientras se construye**, no al final.

## 4.11 KPIs del Líder Técnico

Mido mi propio impacto con:

1. **Squad health survey** trimestral (1-5 en 7 dimensiones). Target ≥ 4.
2. **Time-to-onboarding** del último incorporado. Target < 10 días.
3. **PR cycle time mediano**. Target < 2 días.
4. **Incidentes P1** atribuibles a decisión técnica reciente. Target ≤ 1/trimestre.
5. **Adoption de decisiones documentadas**: ¿el squad las consulta? Medido por encuesta. Target ≥ 80%.

Si bajo de target, ajusto procesos o el rol.

## 4.12 Antipatterns que evito

- **Heroismo**: persona que arregla todo de noche. Síntoma de proceso roto.
- **Code review como gate burocrático**: si bloquea > 3 días sin razón, escalo.
- **Estimaciones como compromiso de fecha**: estimación = mejor guess, no contrato.
- **"Refactor masivo" en un PR**: PRs > 500 líneas no se revisan bien — los rechazo.
- **Métricas como vara**: si el equipo gamea las métricas, ajusto las métricas, no presiono.
- **Reuniones como sustituto de claridad**: si la decisión es clara, escríbela y cancela la reunión.

---
---

# 5 · Política de uso de IA en el equipo

> Aplica a todo el squad. Complemento de la decisión #7 (sección [2.7](#27--uso-de-ia-en-desarrollo-política-y-guardrails--aceptado)).

## 5.1 Principios

1. **La IA es una herramienta, no un sustituto del criterio.** Acelera, no decide.
2. **Toda decisión que afecte producción tiene un humano responsable**, aunque la IA la haya redactado.
3. **PII y secretos no salen del perímetro corporativo** — nunca, ni para "probar".
4. **Transparencia**: si IA contribuyó significativamente a un commit, el commit lo dice.

## 5.2 Tabla de uso permitido vs prohibido

| Actividad | ✅ SÍ | ⚠️ Con cuidado | ❌ NO |
|---|---|---|---|
| Boilerplate (DTOs, schemas, mappers, módulos Nest) | ✓ | | |
| Tests adicionales sobre código humano existente | ✓ | | |
| Edge cases sugeridos por IA | ✓ | | |
| Refactor mecánico (renombres, extract method) | ✓ | | |
| Primer borrador de README, doc de QA | ✓ — luego revisable por humano | | |
| Refinement de historias (CA Gherkin) | ✓ | | |
| Comandos shell, regex, queries Mongo no triviales | ✓ | | |
| Generar OpenAPI YAML sobre schema diseñado por humano | ✓ | | |
| Código en zona crítica (auth, máquina de estados, redacción PII) | | ⚠️ asistido + revisión profunda | |
| Code review | | ⚠️ IA puede sugerir; el aprobador es humano | |
| Datos de producción en prompts | | | ❌ Datos sintéticos siempre |
| PII (números de documento reales, contraseñas, emails) | | | ❌ |
| Secrets (JWT secrets, API keys, MONGODB_URI con password) | | | ❌ |
| Aprobar tu propio PR generado por IA sin segunda revisión | | | ❌ |
| Decisiones arquitectónicas sin firma humana | | | ❌ |

## 5.3 Evidencia y trazabilidad

### En commits
Si la IA contribuyó **significativamente** (más del 30% del cambio), trailer obligatorio:

```
feat(solicitudes): add idempotency-key support

Implements decisión #1 idempotency: requests with same key return
the existing solicitud instead of creating a duplicate.

Closes #42

Assisted-by: Claude Code
```

**No falsificar.** Si fue 100% humano, no se pone el trailer.

### En PRs
Si IA generó tests nuevos automáticamente: mencionarlo en la descripción del PR.

### En docs
Documentos asistidos llevan al final una nota: *"Borrador asistido por IA, revisado y editado por [nombre]."*

## 5.4 Datos en prompts

**Regla simple:** si no se lo pegarías a un competidor, no se lo pegues a un LLM externo.

| ✓ Acceptable en prompt | ✗ Nunca en prompt |
|---|---|
| Esquema Mongoose (sin datos) | Documento Mongo real con datos de cliente |
| `.env.example` (sin secrets) | `.env` real |
| Logs sintéticos generados | Logs de producción con userId real |
| Stack trace anonimizado | Stack trace que revela estructura interna |
| Snippet de código de la organización | Código bajo NDA o con secrets en literales |

## 5.5 Code review

### Reglas
1. **El humano que aprueba un PR es responsable de lo aprobado.** La IA no aprueba; sugiere.
2. Si el código fue generado por IA, el reviewer **debe leer línea por línea**, no escanear.
3. **Reviewer ≠ autor del prompt**.

### Checklist específico para PRs con IA
- [ ] ¿El código respeta los patrones del proyecto (Result<T,E>, port/adapter)?
- [ ] ¿Hay variables sin usar, imports innecesarios, código muerto?
- [ ] ¿Maneja errores de manera consistente con el resto?
- [ ] ¿Hay tests para los caminos no felices?
- [ ] ¿La complejidad agregada está justificada o es sobre-ingeniería de IA?

## 5.6 Onboarding y mentoría

- Junior + IA es **multiplicador**, pero el junior debe **entender** lo que la IA generó. El TL pide explicaciones del código en 1:1.
- Pair-programming sigue siendo central: junior + senior > junior + IA en complejidad alta.
- **No usar IA en entrevistas técnicas internas** (excepción: tareas explícitamente "use IA y muéstranos cómo").

## 5.7 Costos y procurement

- Suscripciones (Copilot, Claude Pro, ChatGPT Plus) son responsabilidad del dev — la organización reembolsa con tope.
- Servicios LLM **on-prem** (vLLM hospedado, AWS Bedrock con datos privados) para PII si se justifica.
- Datos de **clientes reales** solo en LLMs on-prem aprobados por seguridad y legal.

## 5.8 Métricas

### Sí miramos
- **% de PRs con trailer `Assisted-by`** — visibilidad, no objetivo.
- **Latencia de PRs** — bajada esperada por IA.
- **Defectos en zona crítica** — si suben tras adoptar IA, ajustamos política.

### NO miramos
- **Líneas de código por dev** — anti-patrón. La IA infla esto.
- **% de código generado por IA** — métrica de vanidad.

## 5.9 Revisión

Esta política se revisa **cada 6 meses** o cuando salga un modelo significativamente más capaz.

---
---

# 6 · Prompts representativos usados con IA

> Documenta cómo la IA contribuyó a la construcción de la plataforma. Es evidencia de uso responsable y consciente.
> Cada entrada incluye: contexto, prompt resumido, salida y validación humana aplicada.

## P-01 · Tests exhaustivos del Value Object

**Contexto:** tras escribir manualmente el VO `EstadoSolicitud`, necesitaba tests que cubrieran las 6×5=30 combinaciones (excluyendo identidad).

**Prompt:** *"Tengo un value object `EstadoSolicitud` con 6 estados y la siguiente tabla de transiciones permitidas: [...]. Genera tests Jest con `it.each` que prueben TODAS las transiciones inválidas además de las 7 válidas. Los tests deben usar el patrón `Result<T, E>` ya implementado."*

**Salida:** Suite de 42 tests con `it.each` para transiciones válidas + matriz de inválidas + casos terminales + inmutabilidad.

**Validación humana:** verifico que la lista de inválidas es realmente el complemento de las válidas. `pnpm test` → 42/42 verde. Verifico que los tests de inmutabilidad realmente prueben no-mutación.

## P-02 · OpenAPI YAML del gateway Mulesoft

**Contexto:** necesitaba contrato OpenAPI 3.1 para 5 endpoints del Core con schemas, examples, headers de correlación e idempotencia, errores RFC 7807.

**Prompt:** *"Generar OpenAPI 3.1 YAML para gateway Mulesoft con [5 endpoints]. Schemas: Cliente, ProductoElegible, SolicitudCoreRequest/Response, ProblemDetails. Ejemplos para los escenarios 1111/2222/4444/5555/3333. Bearer JWT. Tags por dominio."*

**Salida:** `openapi/core-banking.yaml` (~280 líneas).

**Validación humana:** cargado en Swagger Editor para validar sintaxis. Schema-por-schema vs lo que el mock devuelve. Smoke 24/24 verde.

## P-03 · Refactor de cast `as never` a tipado correcto

**Contexto:** había un cast feo `as never` en `Solicitud.actualizarDatos` que ocultaba un problema de tipo.

**Prompt:** *"Tengo este método con un cast a `never` que es un code smell. Reescríbelo usando el tipo `InvalidStateTransitionError` directamente."*

**Salida:** cambio de 3 líneas con `err(new InvalidStateTransitionError(estado.value, 'DRAFT'))`.

**Validación humana:** `tsc --noEmit` verde. Comportamiento del use case que lo usa no cambia.

## P-04 · Wizard frontend con schema dinámico Zod

**Contexto:** cada producto tiene un `formSchema: FormFieldSpec[]` distinto. Necesitaba renderizar formularios dinámicos sin schema fijo.

**Prompt:** *"Construye un wizard React de 3 pasos (cliente → datos producto → confirmación) que reciba un `formSchema: FormFieldSpec[]` y construya un Zod schema dinámicamente respetando: required, min/max numérico, enum para selects. Usa shadcn/ui. Cada input con label, aria-invalid, aria-describedby cuando hay error."*

**Salida:** `wizard.tsx` (~400 líneas) con builder de schema + 3 sub-componentes de paso.

**Validación humana:** 5 unit tests del schema builder. Smoke en navegador con los 3 productos. Test Playwright. axe-core: 0 violaciones serias.

## P-05 · Smoke API en bash con curl

**Contexto:** smoke test que cubriera 24 escenarios end-to-end. Bash + curl es el camino más rápido.

**Prompt:** *"Genera un script bash que pruebe los 24 escenarios listados con curl, usando JWT del backend, y reporte X passed / X failed al final. Que sea idempotente para re-ejecuciones."*

**Salida:** `scripts/smoke-api.sh` (~100 líneas).

**Validación humana:** 24/24 verde tras 2 iteraciones de fix (encontré bugs reales gracias al smoke). El script no requiere setup externo.

## P-06 · Estrategia QA basada en ISTQB

**Contexto:** documento estructurado por ISTQB Foundation Level que explique decisiones, no liste tests.

**Prompt:** *"Redacta `docs/qa/strategy.md` siguiendo ISTQB v4.0: principios, niveles de prueba, tipos (funcional/no-funcional/estructural/regresión/confirmación), pirámide objetivo, métricas DORA, gestión de defectos, plan de mejora continua. Incluye tabla específica de los tests reales en este repo. Tono: pragmático, no dogmático."*

**Salida:** `docs/qa/strategy.md` (~250 líneas) — ahora consolidado en sección [3](#3--estrategia-de-calidad-istqb) de este Handbook.

**Validación humana:** edición línea por línea para ajustar tono. Verifico que cada test mencionado existe. Casos críticos CP-001..CP-005 con referencias a archivos reales.

## P-07 · Playbook de liderazgo técnico

**Contexto:** documento del rol del TL — modelo operativo, ceremonias, DoR, DoD, code review, onboarding, deuda técnica, KPIs.

**Prompt:** *"Redacta un playbook del Líder Técnico de un squad de 5 personas en banca. Incluye: ceremonias (con asincronía explícita), DoR/DoD compartido con QA, code review (bloqueos máximos, regla anti-cross-aprovación), onboarding, deuda técnica (20%), KPIs personales del TL. Tono: pragmático, anti-burocrático."*

**Salida:** `docs/leadership/playbook.md` (~250 líneas) — consolidado en sección [4](#4--playbook-de-liderazgo-técnico).

**Validación humana:** edición para añadir contexto BCS (oncall, regulatorio). Sección "Antipatterns que evito" añadida manualmente.

## P-08 · Decisiones arquitectónicas (ADRs)

**Contexto:** 7 decisiones arquitectónicas cada una con su ADR formato Michael Nygard.

**Prompt** (repetido por ADR): *"ADR sobre [decisión]. Contexto: [...]. Alternativas que descartamos: [...]. Salida: contexto, decisión, consecuencias (positivas, negativas, mitigaciones), alternativas con tabla, plan de evolución si aplica. Pragmático, no académico."*

**Salidas:** 7 ADRs, originalmente en `docs/adr/0001..0007.md`, posteriormente consolidados en `docs/decisions.md` (un solo documento resumen, ~80-120 palabras por decisión), y finalmente integrados en sección [2](#2--decisiones-arquitectónicas) de este Handbook.

**Validación humana:** cada decisión firmada por mí (TL). Tablas de alternativas ajustadas para reflejar opciones realistas en BCS. Consolidación posterior decidida cuando 7 archivos resultaron demasiado volumen.

## P-09 · Generación de README

**Contexto:** README de cada repo con badges, diagrama Mermaid, inicio rápido, env, link a docs.

**Prompt:** *"README en español para `bcs-solicitudes-api`. Stack [...], inicio rápido en 3 comandos, link a docs/qa, docs/leadership, docs/decisions, docs/stories, docs/ai-usage. Diagrama Mermaid de la arquitectura. Sección 'Limitaciones conocidas' con honestidad."*

**Salida:** README.md de cada repo.

**Validación humana:** cada link verificado. Comandos probados en limpio. Limitaciones conocidas escritas con honestidad (JWT mock, Mulesoft mock, 0.0.0.0/0 en Atlas).

## P-10 · Sugerencia de bugs reales

**Contexto:** ocasionalmente la IA detectó issues reales antes que yo:
1. **`validateStatus: () => true`** en axios del adapter → axios-retry no se activa porque axios nunca lanza error.
2. **Tipos generados como `enviarARevision: boolean`** en lugar de `boolean | undefined` por NestJS Swagger.
3. **Ciclo de imports** entre `metrics.module.ts` y `metrics.service.ts` — la IA sugirió extraer a `metrics.constants.ts`.

**Validación humana:** cada bug verificado con un test que reproducía el problema antes del fix.

## Notas finales

- **Tiempo ahorrado estimado:** ~30% del trabajo total. Más en boilerplate, menos en decisiones críticas.
- **Tiempo perdido por bugs introducidos por IA:** ~5% del total. Detectados en la misma sesión.
- **Lo que la IA NO hizo:** las decisiones (Mongo vs Postgres, Clean Arch vs MVC, retry+CB vs solo retry, máquina de estados en VO vs xstate, JWT mock vs Keycloak, observabilidad stack). Las firmé yo (TL).
- **Lo que la IA HIZO mejor que yo:** tablas exhaustivas de transiciones, tests `it.each`, redacción uniforme de ADRs, propagación de cambios cross-stack al refactorizar tipos.

---
---

# 7 · HU-001 — Consultar productos elegibles para un cliente

> Historia técnica de integración Micrositio ↔ Core Bancario (vía Mulesoft).
> **Endpoint:** `GET /clientes/:tipoDoc/:numDoc/productos-elegibles`
> **Implementación:** `src/modules/clientes/clientes.controller.ts`

## 7.1 Como / Quiero / Para que

**Como** asesor del banco que está iniciando una solicitud para un cliente,
**quiero** ver el catálogo de productos para los que el cliente es elegible según las reglas del Core Bancario (KYC, segmentación, mora vigente),
**para que** no inicie una solicitud de un producto que el Core va a rechazar más adelante, evitando reproceso y mala experiencia del cliente.

## 7.2 Criterios de aceptación

### CA#1 — Caso feliz
**Dado** un cliente identificado por `tipoDoc=CC` y `numDoc=1111111111` con **KYC APROBADO**,
**cuando** el asesor consulta `GET /clientes/CC/1111111111/productos-elegibles`,
**entonces** la respuesta es **200 OK** con la lista de productos elegibles (`AHO-001`, `TC-001`, `LI-001` en el mock)
**y** la respuesta incluye el header `x-correlation-id` propagado o generado.

### CA#2 — Reintento con backoff exponencial ante 5xx del Core
**Dado** que el Core responde **503 Service Unavailable** transitoriamente,
**cuando** el adapter Mulesoft hace la llamada,
**entonces** reintenta hasta **3 veces** con backoff exponencial (con jitter, base 200ms),
**y** si tras los reintentos persiste el 5xx, devuelve **503 application/problem+json** con `correlationId`
**y** el log estructurado registra `event: core_unavailable, attempts: 3, correlationId: …` (sin filtrar el documento del cliente).

### CA#3 — Cliente no existe en el Core
**Dado** que el cliente `4444444444` no existe,
**cuando** el asesor consulta,
**entonces** la respuesta es **404 Not Found** con cuerpo `application/problem+json`,
**y** el `detail` no contiene el documento del cliente en texto plano (solo el hash en logs, no en el response).

### CA#4 — Cache de 60s
**Dado** un cliente válido cuya consulta de productos elegibles fue exitosa hace menos de 60 segundos,
**cuando** se consulta de nuevo el mismo `tipoDoc + numDoc`,
**entonces** la respuesta proviene de cache local (campo `cache: "HIT"` en el body, sin span de OTel hacia el Core)
**y** se sigue registrando un evento de auditoría con `accion: consultar.productos-elegibles.cache-hit`.

### CA#5 — Auditoría con hash del documento
**Dado** cualquier consulta válida,
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

## 7.3 Consideraciones de seguridad

| Vector | Mitigación |
|---|---|
| Acceso no autenticado | Endpoint protegido por `JwtAuthGuard` global; sin Bearer JWT → 401 |
| Privilegios excesivos | `@Roles('ASESOR', 'SUPERVISOR', 'ADMIN')`; otros roles → 403 |
| PII en logs | Documento del cliente nunca en logs. Solo `SHA-256(tipoDoc:numDoc)` en audit |
| Cache poisoning | Cache **per-instance** y key incluye `tipoDoc + numDoc` exactos; cliente no controla la key |
| SSRF outbound | Allowlist de hosts en `MulesoftAdapter` (`localhost:4001`, `api.mulesoft.bcs.co`) |
| Replay attack | El JWT lleva `exp` corto (15 min) |
| Rate limit | Throttler global 60 req/min por IP |
| Trazabilidad | `correlationId` en cada log + audit + propagado al Core |

## 7.4 Implementación

| Aspecto | Detalle |
|---|---|
| Endpoint | `GET /clientes/:tipoDoc/:numDoc/productos-elegibles` |
| Controller | `src/modules/clientes/clientes.controller.ts` |
| Service | `src/modules/auditoria/auditoria.service.ts` |
| Adapter | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.adapter.ts` |
| Tests | Smoke `pnpm smoke` (escenarios 1111, 2222, 4444 cubiertos) |
| Decisión relacionada | [Sección 2.5 — retry + circuit breaker](#25--retry--circuit-breaker-en-adapter-mulesoft--aceptado) |

## 7.5 Mocks / contrato Mulesoft

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

## 7.6 Métricas

- **Counter**: cada llamada incrementa `http_requests_total`.
- **Histogram**: `core_banking_request_duration_seconds{endpoint="consultarProductosElegibles", status="ok|error"}`.
- **Audit events**: 1 documento por consulta en `auditoria_eventos`.

## 7.7 Loose ends

- Cache es in-memory (per-instance). Para multi-instancia → mover a Redis con misma TTL.
- HMAC opcional de la request al Core: documentado en sección [2.5](#25--retry--circuit-breaker-en-adapter-mulesoft--aceptado), deferido a producción real.

---
---

# 8 · HU-002 — Finalizar solicitud aprobada notificando al Core

> Historia técnica de integración Micrositio ↔ Core Bancario (vía Mulesoft).
> **Endpoint:** `POST /solicitudes/:id/finalizar`
> **Implementación:** `src/modules/solicitudes/application/use-cases/finalizar-solicitud.usecase.ts`

## 8.1 Como / Quiero / Para que

**Como** sistema de solicitudes digitales (orquestado por un supervisor),
**quiero** notificar al Core Bancario cuando una solicitud transiciona al estado `APPROVED` para que se abra efectivamente el producto,
**para que** el cliente reciba el `numeroProducto` generado por el Core, la solicitud quede en `FINALIZED`, y se cierre el ciclo end-to-end.

## 8.2 Criterios de aceptación

### CA#1 — Caso feliz: Core acepta y devuelve numeroProducto
**Dado** una solicitud `S` en estado `APPROVED`,
**cuando** un usuario con rol `SUPERVISOR` invoca `POST /solicitudes/:id/finalizar`,
**entonces** el adapter llama al Core en **menos de 5 segundos**,
**y** si el Core responde **201** con `numeroProducto`, la solicitud transiciona a `FINALIZED`,
**y** el `numeroProducto` queda persistido,
**y** el historial registra `APPROVED → FINALIZED, motivo: "Apertura confirmada por Core"`,
**y** el response al cliente es **201**.

### CA#2 — Core rechaza por validación de negocio (4xx) → solicitud regresa a IN_REVIEW
**Dado** una solicitud en `APPROVED` con cliente `5555555555` (que el Core rechaza con 422),
**cuando** se invoca finalizar,
**entonces** el adapter recibe `422 Unprocessable Entity`,
**y** la solicitud transiciona de `APPROVED` a **`IN_REVIEW`** (rollback controlado por `regresarARevisionPorRechazoCore`),
**y** el `motivoRechazo` se persiste con el `detail` del Problem Details,
**y** el historial muestra `APPROVED → IN_REVIEW, motivo: "Rechazo Core: …"`,
**y** el response al cliente es **422 application/problem+json** con `correlationId`.

### CA#3 — Core no disponible (5xx) tras reintentos → queda APPROVED + flag pendienteEnvioCore
**Dado** que el Core responde **5xx** persistente tras los **3 reintentos** del adapter,
**cuando** se invoca finalizar,
**entonces** el adapter devuelve `CoreBankingUpstreamError`,
**y** la solicitud **permanece en `APPROVED`** (no es rechazo de negocio),
**y** se setea `pendienteEnvioCore: true` (para job de retry diferido),
**y** se loguea `event: core_unavailable_after_retries, solicitudId, correlationId` (sin PII),
**y** el response es **502 Bad Gateway** application/problem+json.

### CA#4 — Idempotencia outbound al Core
**Dado** una solicitud que se intenta finalizar dos veces (ej. retry diferido),
**cuando** el adapter llama al Core,
**entonces** envía siempre el mismo `Idempotency-Key` derivado del `solicitudId`
**y** el Core no abre dos productos para la misma solicitud.

### CA#5 — Circuit breaker abierto → falla rápido
**Dado** que el circuit breaker está **abierto** (50%+ failure rate),
**cuando** se invoca finalizar,
**entonces** la respuesta llega en **< 100ms** (no espera al timeout de 5s),
**y** la solicitud queda en `APPROVED + pendienteEnvioCore=true`,
**y** el response es **503 Service Unavailable** application/problem+json con `code: CORE_CIRCUIT_OPEN`.

### CA#6 — Solo SUPERVISOR/ADMIN puede finalizar
**Dado** un usuario con rol `ASESOR`,
**cuando** intenta `POST /solicitudes/:id/finalizar`,
**entonces** la respuesta es **403 Forbidden** y la solicitud no se modifica.

### CA#7 — Solo solicitudes APPROVED se pueden finalizar
**Dado** una solicitud en estado `DRAFT`, `IN_REVIEW`, o terminal,
**cuando** se invoca finalizar,
**entonces** la respuesta es **409 Conflict** (`InvalidStateTransitionError`).

### CA#8 — Auditoría
**Dado** cualquier invocación de finalizar (exitosa o fallida),
**cuando** se procesa,
**entonces** queda en el `historicoEstados` de la solicitud al menos un cambio (incluye intentos rollback en CA#2).

## 8.3 Consideraciones de seguridad

| Vector | Mitigación |
|---|---|
| Llamada no autorizada al Core | Solo se llama tras validar internamente que la solicitud está en `APPROVED` y el rol es `SUPERVISOR` |
| Doble apertura por race condition | `Idempotency-Key` outbound + idempotencia in-app por id de solicitud |
| Datos transaccionales en logs | Logs solo registran `solicitudId`, `correlationId`, `event`, `status`. Nunca `numeroProducto` en claro |
| Replay del JWT | `exp: 15min` evita replay tardío |
| Circuit breaker como escudo | Cierra el camino al Core si está degradado, evitando cascada |
| HMAC body firmado | Documentado en contrato; opcional para mock, obligatorio en producción |
| Rate limit por usuario | Adicional al global: throttler específico documentado para `:id/finalizar` (TODO sprint 2) |

## 8.4 Implementación

| Pieza | Archivo |
|---|---|
| Use case | `src/modules/solicitudes/application/use-cases/finalizar-solicitud.usecase.ts` |
| Entity (rollback) | `src/modules/solicitudes/domain/entities/solicitud.entity.ts` (`regresarARevisionPorRechazoCore`) |
| Adapter | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.adapter.ts` |
| Mappers | `src/modules/solicitudes/infrastructure/core-banking/mulesoft.mappers.ts` |
| Métricas | `src/shared/observability/metrics.service.ts` (`startCoreRequest`) |
| Tests | `scripts/smoke-api.sh` (CP-002 cubierto) + `scripts/smoke-adapter.ts` (CP-003 retry) |
| Decisiones relacionadas | [Sección 2.4 — máquina de estados en VO](#24--máquina-de-estados-en-value-object--aceptado), [Sección 2.5 — retry + circuit breaker](#25--retry--circuit-breaker-en-adapter-mulesoft--aceptado) |

## 8.5 Métricas y observabilidad

- **Histogram**: `core_banking_request_duration_seconds{endpoint="solicitarApertura", status="ok|error"}` — duración real cada llamada.
- **Gauge**: `solicitudes_estado_actual{estado=FINALIZED}` incrementa cuando éxito; `solicitudes_estado_actual{estado=IN_REVIEW}` incrementa en CA#2.
- **Trace**: span padre del request HTTP envuelve span hijo del adapter (axios).
- **Logs estructurados** con `event: core_request_failed, status: 503, attempts: 3, correlationId, solicitudId` cuando aplica.

## 8.6 Plan de retry diferido (CA#3, sprint 2)

Cuando una solicitud queda con `pendienteEnvioCore: true`:
1. Job programado (BullMQ) cada 5 min escanea `solicitudes` con `pendienteEnvioCore: true && estado=APPROVED && updatedAt > now() - 1h`.
2. Re-invoca `FinalizarSolicitudUseCase` con el mismo `solicitudId` (idempotencia preserva).
3. Si Core responde OK → `FINALIZED`, flag false.
4. Si tras 6 intentos persiste, alerta a oncall + escalada manual.

Job no implementado en esta prueba — documentado para sprint 2.

---

## Cierre

Este Handbook es el documento único de referencia. Si encuentras una contradicción con el código, el **código es la verdad** y el documento debe actualizarse. Si hay una decisión nueva que no aparece aquí, abre un PR que añada una sección.

> **Borrador asistido por IA, revisado y editado por el Líder Técnico (Andres Rojas).**
