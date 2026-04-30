# Playbook de Liderazgo Técnico — Solicitudes Digitales BCS

> Documento del Líder Técnico responsable de Backend, Frontend, QA e Integración Core.
> v1.0 · Documento vivo

Este playbook define **cómo opera el equipo**: qué se decide, cuándo, con quién, y con qué nivel de calidad. No es un manual de procesos rígidos — es la base sobre la cual el equipo se autoorganiza.

---

## 1. Modelo operativo

### 1.1 Equipo

Squad de **5 personas** orientada a producto:
- 1 **Líder Técnico** (yo) — arquitectura, decisiones cross-stack, code review final, mentoría.
- 2 **Backend Engineers** — uno senior dueño del dominio Solicitudes/Core, otro mid en Productos/Auditoría.
- 1 **Frontend Engineer** — Next.js + a11y, dueño de wizards y experiencia de asesor.
- 1 **QA Engineer** — estrategia, automatización, refinamiento (3 amigos).

> El squad **no tiene PM dedicado** en esta fase: el TL y un BPO interno priorizan. Cuando crece, se incorpora.

### 1.2 Capacidad

- Ciclo: **sprints de 2 semanas**.
- Capacidad estimada conservadora: **30-35 story points por sprint** los primeros 3 sprints (ramp-up).
- **20% de capacidad reservada** a deuda técnica/observability/refactor — registrado en `tech-debt.md`.
- **No medimos velocity para comparar entre squads**, solo para predicibilidad propia.

### 1.3 Foco actual y horizonte

| Sprint | Foco | KPI |
|---|---|---|
| 1 (ahora) | MVP CRUD + integración Core mock | Demo end-to-end al CIO |
| 2 | Hardening: tests, observabilidad real, audit log | Coverage 70%+, MTTR < 1h |
| 3 | Mulesoft real + staging + canary | Uptime 99.5% |
| 4 | Multi-canal (móvil) + nuevos productos | Time-to-market nuevo producto < 1 sprint |

---

## 2. Ceremonias

| Ceremonia | Frecuencia | Duración | Asistentes | Salida |
|---|---|---|---|---|
| **Daily** | Diario | 15 min (mitad asincrónica) | Squad | Bloqueos, próximos pasos |
| **Refinement** | Semanal | 60 min | TL + dev + QA + BPO | Historias con CA Gherkin + estimación |
| **Planning** | Bisemanal | 60 min | Squad | Sprint backlog comprometido |
| **Retro** | Quincenal | 60 min | Squad | 3 acciones concretas con dueño |
| **Demo a stakeholders** | Cada sprint | 30 min | Squad + stakeholders | Feedback + ajustes |
| **Tech sync (cross-squad)** | Quincenal | 30 min | TLs de squads | Decisiones cross-cutting |
| **Postmortem** | Tras incidente P1/P2 | 60 min | Quien estuvo + TL | RCA + acciones blameless |

### 2.1 Asincronía explícita

El **daily se hace asincrónico** los lunes y miércoles (vía Slack thread con plantilla). Solo síncrono martes/jueves. Esto respeta a quien empieza temprano y a quien necesita deep work.

### 2.2 Demos a stakeholders

Cada demo cierra con:
- **Lo que vimos** (3-5 bullets concretos).
- **Lo que NO se logró** y por qué (transparente, sin excusas).
- **Próximas decisiones** que necesitamos del negocio.

---

## 3. Definition of Ready (DoR)

Una historia entra a sprint sólo si:
- ✅ Tiene **CA Gherkin** (Dado/Cuando/Entonces) para al menos el camino feliz y 2 caminos alternativos.
- ✅ Tiene **mockup o ejemplo de payload** acordado con frontend si aplica.
- ✅ **Dependencias resueltas** (ej. contrato Mulesoft confirmado por arquitectura).
- ✅ **Estimación** acordada por al menos 2 devs.
- ✅ **Criterios no funcionales** explícitos cuando aplican (ej. "p95 < 500ms", "WCAG AA").

Sin DoR → no se compromete.

---

## 4. Definition of Done (DoD)

Una historia se cierra sólo cuando:
- ✅ Código mergeado a `main` con **commits semánticos** (`feat:`, `fix:`, `docs:`).
- ✅ Tests escritos al nivel apropiado (unit + integración + smoke).
- ✅ **Coverage no baja** del umbral del módulo.
- ✅ Swagger/OpenAPI actualizado si cambia el API.
- ✅ **ADR escrito** si la historia introduce una decisión arquitectónica.
- ✅ Revisión de seguridad aplicada (OWASP Top 10 checklist).
- ✅ Logs estructurados con `correlationId` para los flujos críticos.
- ✅ **a11y verificada** con axe-core (sin violaciones serias) si toca UI.
- ✅ Desplegado a staging y validado por QA.
- ✅ Documentación (`docs/`) actualizada cuando aplica.

El QA es **co-dueño del DoD** junto con el dev.

---

## 5. Code review

### 5.1 Reglas firmes
- **Máximo 24 horas** para primer review de un PR pequeño (< 200 líneas). Más tiempo ≠ sin revisar; trasladar urgencia explícitamente.
- **2 aprobaciones** para cambios en core (auth, máquina de estados, integración Core). 1 aprobación para cambios menores.
- **No mergea quien escribió** el código. Excepción: hotfixes P1.
- **No rotamos**: una persona no aprueba dos PRs seguidos del mismo autor sin que un tercero también revise. Evita dependencias cruzadas.

### 5.2 Checklist del reviewer

1. **Funcionalidad**: ¿hace lo que dice la historia?
2. **Tests**: ¿hay tests al nivel apropiado, no solo unit?
3. **Seguridad**: validación de inputs, manejo de errores sin filtrar PII, autorización.
4. **Observabilidad**: logs y métricas en el camino crítico.
5. **a11y**: si toca UI — labels, focus, aria.
6. **Mantenibilidad**: nombres claros, comentarios solo cuando el "porqué" no es obvio.
7. **Performance**: ¿agrega N+1 queries? ¿memory leaks?

### 5.3 Cultura
- **Comentarios en code review son sobre el código, no sobre la persona**.
- **Sugerencias, no órdenes**: "¿qué te parece extraer X?" en vez de "extrae X".
- **Aprobar con comentarios menores** está bien; bloquear se reserva para issues reales.

---

## 6. Onboarding

| Día | Hito |
|---|---|
| Día 1 | Entorno funcionando: Atlas + backend + frontend. Acceso a repos, Linear, Slack, Sentry. |
| Día 2 | Primer PR mergeado (typo, doc, o test pequeño). Pair con TL para conocer la arquitectura. |
| Semana 1 | Pair-programming con un senior. Lee `docs/decisions.md` y `docs/qa/`. |
| Semana 2 | Toma una historia pequeña end-to-end. |
| Mes 1 | Mentor asignado para 1:1 quincenales sobre carrera + crecimiento técnico. |

**Mentor ≠ TL**: el mentor escucha; el TL evalúa. Separación intencional.

---

## 7. Deuda técnica

- Registrada en `docs/tech-debt.md` con: descripción, impacto si no se atiende, costo estimado.
- **20% de capacidad por sprint** dedicada (no negociable).
- **Tech debt review mensual**: el TL prioriza con el squad qué entra en los próximos sprints.
- Bloquear features con **deuda crítica acumulada**: si hay 3 items P1 sin atender, no se compromete feature nueva hasta resolver al menos 2.

---

## 8. Decision log (ADRs + RFCs)

### 8.1 ADRs
- Una decisión arquitectónica = un ADR (1 página, formato Michael Nygard).
- Decisiones consolidadas en `docs/decisions.md` (resumen ejecutivo de los 7 ADRs principales).
- **Estados**: Propuesto → Aceptado → Reemplazado/Obsoleto.
- ADRs **no se borran**; se reemplazan con un ADR nuevo que cita al anterior.

### 8.2 RFCs
Para cambios mayores (refactor de un módulo, cambio de stack, nueva integración) → RFC en `docs/rfc/` antes de implementar:
- Contexto.
- Propuesta.
- Alternativas consideradas.
- Trade-offs.
- Plan de implementación + rollback.

RFC abierto al squad por **3 días hábiles**. Si nadie levanta objeción mayor, se acepta.

---

## 9. Comunicación con negocio

### 9.1 Traducción de métricas técnicas

| Métrica técnica | Cómo se cuenta al negocio |
|---|---|
| Uptime 99.5% | "≈3.5 horas de servicio interrumpido al mes" |
| p95 latencia 800ms | "1 de cada 20 asesores espera más de 800ms" |
| Coverage 70% | "Estimado: ~30% de probabilidad de defecto en zonas no cubiertas" |
| MTTR 1h | "Recuperación garantizada en 1 hora ante incidentes" |
| Change failure rate 10% | "9 de cada 10 deploys son seguros sin rollback" |

### 9.2 Reportes ejecutivos
- **Mensual**: 1 página. Throughput de historias, métricas DORA, riesgos abiertos, próximos hitos. Sin jerga técnica.
- **Postmortem ejecutivo**: cuando hay P1, resumen sin culpa con acciones medibles.

---

## 10. Cultura

- **Blameless postmortems**: el sistema falló, no la persona. RCA enfoca en proceso/herramienta/diseño.
- **"You build it, you run it"**: el squad es responsable de operar lo que construye. **Oncall rotativo** después de 3 meses en la squad.
- **Psychological safety**: se puede levantar la mano y decir "no sé" o "estamos rotos" sin consecuencias.
- **Trabajo profundo respetado**: bloques de 2-3 h sin reuniones es la norma.
- **Documentar mientras se construye**, no al final. Un PR sin doc cuando aplica → no merge.

---

## 11. Política de IA en el equipo

Resumen — el detalle vive en [`../ai-usage/policy.md`](../ai-usage/policy.md):

| ✅ SÍ con IA | ❌ NO con IA |
|---|---|
| Boilerplate (DTOs, mappers, tests repetitivos) | Pasar PII / secrets a un LLM externo |
| Generar primer borrador de docs y ADRs | Aprobar PR del propio "co-pilot" sin revisar |
| Escribir test cases adicionales sobre código existente | Decisiones arquitectónicas sin firma humana |
| Refactor mecánico (renombres, extract method) | Generar código en zonas críticas (auth, máquina de estados) sin revisión profunda |
| Refinar historias y CA con IA | Sustituir el code review humano |

Cada commit que use IA significativa lleva trailer `Assisted-by: Claude Code`. **No falsificar** — es deshonestidad y rompe la confianza.

---

## 12. KPIs del Líder Técnico

Mido mi propio impacto con:

1. **Squad health survey** trimestral (1-5 en 7 dimensiones: claridad, autonomía, calidad, ritmo, soporte, aprendizaje, conflicto). Target ≥ 4.
2. **Time-to-onboarding** del último incorporado (desde día 1 hasta primera historia mergeada). Target < 10 días.
3. **PR cycle time mediano**. Target < 2 días.
4. **Incidentes P1** atribuibles a decisión técnica reciente (proxy de calidad de mis decisiones). Target ≤ 1/trimestre.
5. **Adoption de ADRs**: ¿el squad consulta ADRs? Medido por encuesta. Target ≥ 80%.

Si bajo de target, ajusto procesos o el rol.

---

## Apéndice — Antipatterns que evito

- **Heroismo**: persona que arregla todo de noche. Síntoma de proceso roto, no de estrella.
- **Code review como gate burocrático**: si bloquea más de 3 días sin razón clara, escalo.
- **Estimaciones como compromiso de fecha**: estimación = mejor guess, no contrato.
- **"Refactor masivo" en un PR**: PRs > 500 líneas no se revisan bien — los rechazo.
- **Métricas como vara**: si el equipo gamea las métricas, ajusto las métricas, no presiono.
- **Reuniones como sustituto de claridad**: si la decisión es clara, escríbela en un ADR/RFC y cancela la reunión.
