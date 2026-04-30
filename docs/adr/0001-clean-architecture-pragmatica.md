# ADR-0001 — Clean Architecture pragmática en el módulo Solicitudes

* **Estado**: Aceptado
* **Fecha**: 2026-04-29
* **Autores**: Líder Técnico

## Contexto

La plataforma de solicitudes digitales debe sostener **alta variabilidad** en reglas de negocio (cada producto bancario tiene flujo, validaciones y formulario distinto) e integrarse con sistemas externos cuyos contratos pueden cambiar (Core Bancario vía Mulesoft). Necesitamos una arquitectura que:

1. Permita probar la lógica de dominio **sin Mongo, sin HTTP, sin Mulesoft**.
2. Aísle el dominio de cambios en infraestructura.
3. No imponga overhead burocrático para cambios pequeños.

## Decisión

Adoptamos **Clean Architecture en su versión pragmática** únicamente en el módulo crítico (`solicitudes/`). Otros módulos (productos, clientes, auth) usan capas más finas porque su complejidad es menor.

Estructura del módulo `solicitudes/`:

```
domain/         entidades, VOs, ports (interfaces) — sin dependencias de infra
application/    use cases — orquestan dominio + ports
infrastructure/ implementaciones de ports (Mongoose repo, axios adapter al Core)
interfaces/     HTTP (controladores, DTOs, mappers de respuesta)
```

Reglas:
- **Dominio no depende de Nest, Mongoose ni HTTP.** Es TS puro + ZodTypes + nanoid.
- **Use cases reciben ports**, no implementaciones concretas. Inyección por símbolo + `@Inject(SOLICITUD_REPOSITORY)`.
- **DTOs HTTP son mapeados** a/desde el dominio en `interfaces/http/*.mapper.ts`. Tipos de Mulesoft mapeados en `infrastructure/core-banking/mulesoft.mappers.ts`.
- **No hay `Repository<Solicitud>` genérico** — el port es específico del agregado.

## Consecuencias

### Positivas
- 42 unit tests del VO `EstadoSolicitud` corren en milisegundos sin tocar nada externo.
- Si mañana cambiamos Mongoose por DynamoDB, solo cambia `infrastructure/persistence/`.
- El equipo puede razonar sobre la lógica de negocio leyendo solo `domain/` y `application/`.

### Negativas
- Más archivos por feature (~3-5 archivos para una operación: entity, port, use case, repository, controller, DTO).
- Para cambios triviales (agregar un campo a la respuesta), tocar 3 archivos en lugar de 1.
- Curva de aprendizaje para devs que no conocen el patrón.

### Mitigaciones
- Documentación con diagrama (este ADR + README).
- Onboarding pair-programming durante semana 1.
- Plantillas/snippets para añadir un nuevo use case.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **MVC tradicional NestJS** (controller-service-repository) | Mezcla responsabilidades; testear lógica requiere mockear servicios; no aísla dependencias externas. |
| **Hexagonal "puro"** con clases adicionales (Application Service, Command Handlers, Query Handlers) | Sobre-ingeniería para una squad de 5; multiplica archivos sin valor proporcional. |
| **Domain-Driven Design completo** (Aggregate Root con eventos de dominio + event sourcing) | Tiene sentido en sistemas con muchas reglas; aquí no justifica el costo. |

## Referencias

- "Clean Architecture" — Robert C. Martin, capítulos sobre Use Cases y Boundaries.
- "Patterns of Enterprise Application Architecture" — Martin Fowler, capítulo Repository pattern.
