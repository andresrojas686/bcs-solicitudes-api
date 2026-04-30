# ADR-0007 — Uso de IA en el desarrollo: política y guardrails

* **Estado**: Aceptado
* **Fecha**: 2026-04-29

## Contexto

La IA generativa (LLMs como Claude, GPT, Copilot) ha demostrado **multiplicar la productividad** del desarrollo cuando se usa con criterio. La rúbrica de esta prueba evalúa explícitamente "uso de IA". El equipo necesita una política clara sobre **qué se puede asistir con IA, qué no, y cómo evidenciarlo**.

Sin política, los riesgos son:
- Filtración de PII / secretos a un servicio externo.
- Aprobación ciega de código generado en zonas críticas (auth, máquina de estados).
- Pérdida de aprendizaje del equipo si se delega todo a IA.
- Decisiones arquitectónicas sin firma humana — deuda técnica oculta.

## Decisión

Adoptamos una política **explícita** de uso de IA — ver `docs/ai-usage/policy.md` para el detalle. Resumen:

### ✅ SÍ se asiste con IA
- Boilerplate (DTOs, mappers, módulos de NestJS).
- Generar tests adicionales sobre código existente (especialmente edge cases).
- Refactor mecánico (renombres, extract method, ajuste de imports).
- Primer borrador de docs y ADRs (revisable y editable por humano).
- Refinement de historias y CA Gherkin.
- Generar comandos shell, regex, queries Mongo no triviales.

### ❌ NO se asiste con IA
- Pasar **PII real** o **secrets** a un LLM externo.
- Aprobar **el propio PR** generado con IA sin revisión humana.
- Decisiones arquitectónicas (un ADR debe estar firmado por humano, aunque su redacción haya sido asistida).
- Código en **zonas críticas** sin revisión profunda: máquina de estados, auth, integración Core, redacción de PII en logs, validación de dominio.

### Evidencia
- Cada commit que use IA significativa lleva trailer: `Assisted-by: Claude Code`.
- `docs/ai-usage/prompts.md` documenta los prompts representativos usados durante la prueba (sin PII).
- **No falsificar**: si no se usó IA, no añadir el trailer.

### Code review humano sigue siendo obligatorio
La IA puede generar código que compila pero es semánticamente incorrecto, inseguro, o con vulnerabilidades sutiles (e.g., SQL injection, prototype pollution). El review humano detecta esto.

### Onboarding y mentoría
La IA **no sustituye** la mentoría a un junior. Si un junior usa IA para resolver un problema sin entenderlo, el TL lo nota en el 1:1 y refuerza fundamentos.

## Consecuencias

### Positivas
- Acelera tareas repetitivas. En esta prueba, ~30% del tiempo se ahorró en scaffolding de DTOs, schemas Zod, y tests con `it.each`.
- Documenta la decisión en lugar de dejarla implícita.
- Da al evaluador (y al equipo a futuro) un marco claro sobre cómo se construyó esto.

### Negativas
- Riesgo de **dependencia**: el equipo puede perder agilidad si la IA cae.
- Riesgo de **homogeneización**: código con sello LLM puede ser blando en decisiones difíciles.
- Costo de los servicios IA — manejado a nivel organizacional.

### Mitigaciones
- Días de "no IA" ocasionales para mantener fundamentos.
- Code review humano es no-negociable.
- Política revisable cada 2 trimestres a la luz de nuevas capacidades de los modelos.

## Casos concretos en esta prueba

| Tarea | Asistencia IA | Validación humana |
|---|---|---|
| 42 unit tests del VO `EstadoSolicitud` con `it.each` para todas las transiciones | Generación de la tabla de inválidas | Revisión + ejecución verde |
| Redacción inicial de ADRs y playbook | Borrador asistido | Edición por TL: ajuste de tono, adición de contexto BCS |
| OpenAPI YAML del Mulesoft mock | Asistido (estructura Open API es repetitiva) | Revisión schema-by-schema |
| Wizard frontend con react-hook-form + Zod dinámico | Asistido | Test del schema (Vitest) + manual en navegador |
| Smoke API bash script | Asistido (curl chains) | Ejecución verde 24/24 |
| Decisiones de arquitectura (Clean Arch, máquina de estados, retry+CB) | Documentación asistida; **decisión humana** | Firma del TL en cada ADR |

## Referencia

- Política completa: `docs/ai-usage/policy.md`
- Prompts representativos: `docs/ai-usage/prompts.md`
