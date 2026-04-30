# Prompts representativos usados en el desarrollo de esta prueba

> Documenta cómo la IA contribuyó a la construcción de la plataforma. Es evidencia de uso responsable y consciente de IA — no es exhaustivo, pero captura los casos representativos.

Cada entrada incluye: **contexto**, **prompt resumido**, **salida esperada** y **validación humana** que se aplicó.

---

## P-01 · Generación de tests exhaustivos del Value Object

**Contexto**: Tras escribir manualmente el VO `EstadoSolicitud` y la tabla de transiciones, necesitaba tests que cubrieran las 6×5=30 combinaciones (excluyendo identidad). Escribirlas a mano sería tedioso.

**Prompt** (resumido):
> Tengo un value object `EstadoSolicitud` con 6 estados y la siguiente tabla de transiciones permitidas: [...]. Genera tests Jest con `it.each` que prueben TODAS las transiciones inválidas (las que no están en la tabla) además de las 7 válidas. Los tests deben usar el patrón `Result<T, E>` ya implementado.

**Salida**: Suite de 42 tests con `it.each` para transiciones válidas + matriz de inválidas + casos terminales + inmutabilidad.

**Validación humana**:
- Compruebo que la lista de inválidas es realmente el complemento de las válidas (revisión manual de la tabla generada).
- Ejecuto `pnpm test` → 42/42 verde.
- Verifico que los tests de "inmutabilidad" realmente prueben no-mutación (no solo equality).

---

## P-02 · OpenAPI YAML del gateway Mulesoft

**Contexto**: Necesitaba un contrato OpenAPI 3.1 para 5 endpoints del Core Bancario, con schemas, examples por escenario, headers de correlación e idempotencia, y errores RFC 7807. Escribir YAML a mano es propenso a errores de indentación.

**Prompt** (resumido):
> Generar un OpenAPI 3.1 YAML para un gateway Mulesoft con estos 5 endpoints: [...]. Schemas: Cliente, ProductoElegible, SolicitudCoreRequest/Response, ProblemDetails (RFC 7807). Ejemplos para los escenarios de prueba: 1111 (KYC OK), 2222 (KYC PENDIENTE), 4444 (404), 5555 (422), 3333 (retry). Bearer JWT auth. Tags por dominio.

**Salida**: `openapi/core-banking.yaml` (~280 líneas).

**Validación humana**:
- Cargo el YAML en Swagger Editor para validar sintaxis.
- Reviso schema-por-schema vs lo que el mock realmente devuelve.
- Verifico que el mock + adapter + frontend funcionan contra este contrato (smoke 24/24).

---

## P-03 · Refactor de cast `as never` a tipado correcto

**Contexto**: Inicialmente había un cast feo `as never` en `Solicitud.actualizarDatos` que oculta un problema de tipo.

**Prompt** (resumido):
> Tengo este método con un cast a `never` que es un code smell. Reescríbelo usando el tipo `InvalidStateTransitionError` directamente.

**Salida**: Cambio de 3 líneas con `err(new InvalidStateTransitionError(estado.value, 'DRAFT'))`.

**Validación humana**:
- Compilo con `tsc --noEmit` → verde.
- Compruebo que el comportamiento del use case que lo usa no cambia.

---

## P-04 · Wizard frontend con schema dinámico Zod

**Contexto**: Cada producto bancario tiene un `formSchema: FormFieldSpec[]` distinto. Necesitaba renderizar formularios dinámicos con react-hook-form + Zod sin escribir un schema fijo.

**Prompt** (resumido):
> Construye un wizard React de 3 pasos (cliente → datos producto → confirmación) que reciba un `formSchema: FormFieldSpec[]` y construya un Zod schema dinámicamente respetando: required, min/max numérico, enum para selects. Usa shadcn/ui (Base UI) para los componentes. Cada input con label, aria-invalid, aria-describedby cuando hay error.

**Salida**: `wizard.tsx` (~400 líneas) con builder de schema + 3 sub-componentes de paso.

**Validación humana**:
- 5 unit tests del schema builder (`__tests__/wizard-schema.test.ts`).
- Smoke en navegador: probé los 3 productos del catálogo (3, 4, 5 campos respectivamente).
- Test Playwright que cubre el flujo end-to-end.
- a11y check con axe-core: 0 violaciones serias.

---

## P-05 · Smoke API en bash con curl

**Contexto**: Necesitaba un smoke test que cubriera 24 escenarios end-to-end del backend (auth, roles, transiciones, idempotencia, Core 422). Bash + curl es el camino más rápido.

**Prompt** (resumido):
> Genera un script bash que pruebe los 24 escenarios listados con curl, usando JWT del backend, y reporte X passed / X failed al final. Que sea idempotente para re-ejecuciones.

**Salida**: `scripts/smoke-api.sh` (~100 líneas).

**Validación humana**:
- Ejecutado contra el backend real → 24/24 verde tras 2 iteraciones de fix (encontré bugs reales gracias al smoke).
- Validé que el script no requiere setup externo: `pnpm dev` corriendo es suficiente.

---

## P-06 · Estrategia QA basada en ISTQB

**Contexto**: Necesitaba un documento de estrategia QA estructurado por ISTQB Foundation Level que explique decisiones, no liste tests.

**Prompt** (resumido):
> Redacta `docs/qa/strategy.md` siguiendo ISTQB v4.0: principios, niveles de prueba, tipos (funcional/no-funcional/estructural/regresión/confirmación), pirámide objetivo, métricas DORA, gestión de defectos, plan de mejora continua. Incluye tabla específica de los tests reales que están en este repo. Tono: pragmático, no dogmático.

**Salida**: `docs/qa/strategy.md` (~250 líneas).

**Validación humana**:
- Edición línea por línea para ajustar tono al de un Líder Técnico que opera, no que recita un libro.
- Verifico que cada test mencionado en "Mínimo viable" realmente existe en el repo.
- Añadidos casos críticos CP-001..CP-005 con referencias a archivos reales.

---

## P-07 · Playbook de liderazgo técnico

**Contexto**: Documento del rol del TL — modelo operativo, ceremonias, DoR, DoD, code review, onboarding, deuda técnica, comunicación, KPIs.

**Prompt** (resumido):
> Redacta un playbook del Líder Técnico de un squad de 5 personas en banca (Backend + Frontend + QA + Integración Core). Incluye: ceremonias (con asincronía explícita), DoR/DoD compartido con QA, code review (bloqueos máximos, regla anti-cross-aprovación), onboarding (día 1 - mes 1), deuda técnica (20% capacity), KPIs personales del TL. Tono: pragmático, anti-burocrático.

**Salida**: `docs/leadership/playbook.md` (~250 líneas).

**Validación humana**:
- Edición para añadir contexto BCS (oncall, regulatorio).
- Sección final "Antipatterns que evito" añadida manualmente — refleja experiencia personal.

---

## P-08 · ADRs

**Contexto**: 7 decisiones arquitectónicas cada una con su ADR formato Michael Nygard.

**Prompt** (resumido, repetido para cada ADR):
> ADR-XXX sobre [decisión]. Contexto: [...]. Alternativas que descartamos: [...]. Quiero que la salida sea: contexto, decisión, consecuencias (positivas, negativas, mitigaciones), alternativas consideradas con tabla, plan de evolución si aplica. Pragmático, no académico.

**Salidas**: 7 ADRs originalmente en `docs/adr/0001..0007.md`, posteriormente consolidados en [`docs/decisions.md`](../decisions.md) (un solo documento resumen, ~80-120 palabras por decisión).

**Validación humana**:
- Cada decisión firmada mentalmente por mí (TL); el contenido refleja decisiones reales tomadas, no documenta teóricas.
- Tablas de alternativas se ajustaron para reflejar opciones realistas en BCS, no genéricas.
- Consolidación posterior decidida cuando 7 archivos separados resultaron demasiado volumen para escanear.

---

## P-09 · Generación de README

**Contexto**: README de cada repo con badges, diagrama Mermaid, inicio rápido, variables de entorno, link a docs.

**Prompt** (resumido):
> README en español para `bcs-solicitudes-api`. Stack [...], inicio rápido en 3 comandos, link a docs/qa, docs/leadership, docs/decisions, docs/stories, docs/ai-usage. Diagrama Mermaid de la arquitectura (Frontend → API → Mongo + Mulesoft). Sección "Limitaciones conocidas" con honestidad.

**Salida**: README.md de cada repo (B7).

**Validación humana**:
- Verificación de que cada link funciona.
- Comandos de inicio rápido probados en limpio.
- Limitaciones conocidas escritas con honestidad: cosas que no funcionarían en prod (JWT mock, Mulesoft mock, 0.0.0.0/0 en Atlas).

---

## P-10 · Sugerencia de bugs reales

**Contexto**: Ocasionalmente la IA detectó issues reales antes que yo. Ejemplos:

1. **`validateStatus: () => true`** en el axios del adapter Mulesoft → axios-retry no se activa porque axios nunca lanza error. La IA me lo señaló al pedirle que revisara el smoke test fallido.
2. **Tipos generados como `enviarARevision: boolean` en lugar de `boolean | undefined`** porque NestJS Swagger marcaba como required. La IA detectó la inconsistencia entre el DTO y el cliente generado.
3. **Ciclo de imports** entre `metrics.module.ts` y `metrics.service.ts` cuando las constantes vivían en el module — la IA sugirió extraer a `metrics.constants.ts`.

**Validación humana**:
- Cada bug detectado por IA fue verificado independientemente con un test que reproducía el problema antes del fix.

---

## Notas finales

- **Tiempo ahorrado estimado**: ~30% del trabajo total. Más en boilerplate, menos en decisiones críticas.
- **Tiempo perdido por bugs introducidos por IA**: ~5% del total — bug del `validateStatus`, ciclo de imports, casts feos. Detectados y corregidos en la misma sesión.
- **Lo que la IA NO hizo**: las decisiones (Mongo vs Postgres, Clean Arch vs MVC, retry+CB vs solo retry, máquina de estados en VO vs xstate, JWT mock vs Keycloak, observabilidad stack). Esas las firmé yo (TL).
- **Lo que la IA HIZO mejor que yo**: tablas exhaustivas de transiciones, generación de tests `it.each`, redacción uniforme de ADRs, propagación de cambios cross-stack al refactorizar tipos.
