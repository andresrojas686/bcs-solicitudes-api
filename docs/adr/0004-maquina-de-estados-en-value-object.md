# ADR-0004 — Máquina de estados encapsulada en un Value Object

* **Estado**: Aceptado
* **Fecha**: 2026-04-29

## Contexto

Una solicitud bancaria atraviesa varios estados con **transiciones rígidas**: una solicitud `DRAFT` no puede pasar directamente a `APPROVED`, una solicitud `FINALIZED` no puede revertirse, etc. Las transiciones inválidas son una **clase de bug crítico** porque pueden generar inconsistencias contables (apertura de un producto sin haber pasado revisión) o auditoría falsa.

Necesitamos garantizar que estas reglas:
1. Se apliquen **independientemente** de quién tenga la entidad en mano (HTTP, job de retry, seed).
2. Sean **explícitas y testeables** sin tener que arrancar la app.
3. Se **documenten una sola vez** y no se dispersen en if/else por la base de código.

## Decisión

Encapsular la máquina de estados en un **Value Object inmutable**: `EstadoSolicitud`.

```ts
class EstadoSolicitud {
  private constructor(public readonly value: EstadoSolicitudValue) {}
  static initial(): EstadoSolicitud;
  static from(v: EstadoSolicitudValue): EstadoSolicitud;
  transitionTo(target): Result<EstadoSolicitud, InvalidStateTransitionError>;
  isTerminal(): boolean;
  canTransitionTo(target): boolean;
}
```

**Reglas clave**:
- El VO **no muta**: `transitionTo` devuelve un nuevo VO o un `Err`.
- Las transiciones permitidas viven en una **tabla constante** dentro del VO (`ALLOWED`).
- Devuelve `Result<T, E>` en vez de lanzar — los errores de transición son **valores**, no excepciones.
- La entidad `Solicitud` envuelve al VO y registra cada cambio en `historicoEstados`.
- Excepción documentada: `regresarARevisionPorRechazoCore()` en la entidad permite `APPROVED → IN_REVIEW` (CA#3 de HU-002), un caso de negocio explícito que rompe la máquina de manera controlada.

## Consecuencias

### Positivas
- **42 unit tests** cubren todas las transiciones (7 válidas + 23 inválidas + terminales + inmutabilidad). Suite corre en < 100ms.
- Imposible introducir transición ilegal sin romper tests.
- Diagrama del flujo es **legible directamente del código**.

### Negativas
- Para una transición legítima nueva, hay que tocar 3 lugares: `ALLOWED`, los tests (nuevo "válido", remover de "inválido"), y posiblemente ADR.
- El "rollback Core 422" requirió un método especial en la entidad — la pureza del VO no acomodaba el caso real de negocio. Es un trade-off documentado en `regresarARevisionPorRechazoCore`.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Enum simple + if/else en cada use case** | Las reglas se duplican y divergen; no es testeable de forma centralizada. |
| **Librería [xstate](https://xstate.js.org)** | Excelente, pero overkill para 6 estados. Su fortaleza es máquinas con jerarquía y guards complejos. Si crecemos a 20+ estados con sub-estados, lo reconsideramos. |
| **Estado como string sin validación** | Catastrófico — invita a setear `solicitud.estado = "FINALIZED"` saltándose todo. |

## Tabla de transiciones (autoritativa)

```
DRAFT     → IN_REVIEW | ABANDONED
IN_REVIEW → APPROVED  | REJECTED | ABANDONED
APPROVED  → FINALIZED | ABANDONED
REJECTED  → (terminal)
FINALIZED → (terminal)
ABANDONED → (terminal)
```

**Excepción negocio** (no en máquina pura, encapsulada en `regresarARevisionPorRechazoCore`):
- `APPROVED → IN_REVIEW` cuando el Core rechaza con 4xx tras llamar finalizar.

## Tests

Ver `src/modules/solicitudes/domain/value-objects/estado-solicitud.vo.spec.ts`.
