# Política de uso de IA en el equipo

> Versión 1.0 · Aplica a todo el squad de la plataforma de Solicitudes Digitales BCS.
> Esta política es **complemento** del ADR-0007 — léelos juntos.

## Principios

1. **La IA es una herramienta, no un sustituto del criterio.** Acelera, no decide.
2. **Toda decisión que afecte producción tiene un humano responsable**, aunque la IA la haya redactado.
3. **PII y secretos no salen del perímetro corporativo** — nunca, ni para "probar".
4. **Transparencia**: si IA contribuyó significativamente a un commit, el commit lo dice.

---

## Tabla de uso permitido vs prohibido

| Actividad | ✅ SÍ | ⚠️ Con cuidado | ❌ NO |
|---|---|---|---|
| **Generar boilerplate** (DTOs, schemas, mappers, módulos Nest) | ✓ | | |
| **Tests adicionales** sobre código humano existente | ✓ | | |
| **Edge cases** sugeridos por IA | ✓ | | |
| **Refactor mecánico** (renombres, extract method) | ✓ | | |
| **Primer borrador** de README, ADR, doc de QA | ✓ — luego revisable por humano | | |
| **Refinement de historias** (CA Gherkin, criterios no funcionales) | ✓ | | |
| **Comandos shell, regex, queries Mongo no triviales** | ✓ | | |
| **Generar OpenAPI YAML** sobre un schema diseñado por humano | ✓ | | |
| **Código en zona crítica** (auth, máquina de estados, redacción PII, integración Core) | | ⚠️ asistido + revisión profunda | |
| **Code review** | | ⚠️ IA puede sugerir; el aprobador es humano | |
| **Datos de producción** en prompts | | | ❌ Datos sintéticos siempre |
| **PII** (números de documento reales, contraseñas, emails de clientes) | | | ❌ |
| **Secrets** (JWT secrets, API keys, MONGODB_URI con password real) | | | ❌ |
| **Aprobar tu propio PR** generado por IA sin segunda revisión | | | ❌ |
| **Decisiones arquitectónicas** sin firma humana (un ADR sin nombre del autor) | | | ❌ |

---

## Evidencia y trazabilidad

### En commits
- Si la IA contribuyó **significativamente** (más de un 30% del cambio): trailer obligatorio.

```
feat(solicitudes): add idempotency-key support

Implements ADR-0001 idempotency: requests with same key return
the existing solicitud instead of creating a duplicate.

Closes #42

Assisted-by: Claude Code
```

- **No falsificar**. Si fue 100% humano, no se pone el trailer.

### En PRs
- Si IA generó tests nuevos automáticamente: mencionar en la descripción del PR — facilita el code review.

### En docs
- Documentos asistidos por IA llevan al final una nota: *"Borrador asistido por IA, revisado y editado por [nombre]."*
- Documentos puramente humanos no necesitan nota.

---

## Datos en prompts

**Regla simple**: si no se lo pegarías a un competidor, no se lo pegues a un LLM externo.

| ✓ Acceptable en prompt | ✗ Nunca en prompt |
|---|---|
| Esquema Mongoose (sin datos) | Documento Mongo real con datos de cliente |
| `.env.example` (sin secrets) | `.env` real |
| Logs sintéticos generados (correlationId fake) | Logs de producción con userId real |
| Stack trace anonimizado | Stack trace con paths que revelan estructura interna |
| Snippet de código de la organización | Código bajo NDA o con secrets en literales |

---

## Code review

### Reglas
1. **El humano que aprueba un PR es responsable de lo aprobado**. La IA no aprueba; sugiere.
2. Si el código fue generado por IA, el reviewer **debe leer línea por línea**, no escanear. Es donde más bugs sutiles se cuelan.
3. **Reviewer ≠ autor del prompt**. Por eso es prohibido aprobar tu propio PR.

### Checklist específico para PRs con IA
- [ ] ¿El código respeta los patrones del proyecto (Result<T,E>, port/adapter, etc.)?
- [ ] ¿Hay variables sin usar, imports no necesarios, código muerto?
- [ ] ¿Maneja errores de manera consistente con el resto?
- [ ] ¿Hay tests para los caminos no felices?
- [ ] ¿La complejidad agregada está justificada o es sobre-ingeniería de IA?

---

## Onboarding y mentoría

- Junior + IA es **multiplicador**, pero el junior debe **entender** lo que la IA generó. El TL pide explicaciones del código en 1:1.
- Pair-programming sigue siendo central: junior + senior > junior + IA en complejidad alta.
- **No usar IA en entrevistas técnicas internas** (excepción: tareas explícitamente "use IA y muéstranos cómo").

---

## Costos y procurement

- Suscripciones (Copilot, Claude Pro, ChatGPT Plus) son responsabilidad de cada dev — la organización reembolsa con tope mensual.
- Servicios LLM **on-prem** (vLLM hospedado, AWS Bedrock con datos privados) se usan para PII si se justifica.
- Datos de **clientes reales** solo se procesan en LLMs on-prem aprobados por seguridad y legal.

---

## Métricas que sí miramos

- **% de PRs con trailer `Assisted-by`** — visibilidad, no objetivo. Sirve para entender adoption.
- **Latencia de PRs** — bajada esperada por IA.
- **Defectos en zona crítica** — vigilados; si suben tras adoptar IA, ajustamos política.

---

## Métricas que NO miramos

- **Líneas de código por dev** — anti-patrón. La IA infla esto.
- **% de código generado por IA** — métrica de vanidad sin valor.

---

## Revisión

Esta política se revisa **cada 6 meses** o cuando salga un modelo significativamente más capaz. El TL convoca al squad y a un par representante de seguridad/legal.

Última revisión: **2026-04-29** (creación inicial).
