# ADR-0002 — Mongoose como ODM en lugar de TypeORM/Prisma

* **Estado**: Aceptado
* **Fecha**: 2026-04-29

## Contexto

La plataforma usa **MongoDB Atlas** (decisión separada: ADR pendiente sobre Mongo vs Postgres — corto plazo es Mongo por velocidad de iteración, schemas flexibles para `datosFormulario` por producto). Necesitamos un ODM/cliente que permita:

1. Tipos compartidos entre entidad de dominio y documento persistido.
2. Validación de schema antes de escribir.
3. Queries idiomáticos en TypeScript.
4. Soporte para TTL indexes (idempotencia: `idempotency_keys` con expiración 24h).

## Decisión

Usamos **Mongoose 8** con `@nestjs/mongoose` para integración con DI de Nest.

## Consecuencias

### Positivas
- Mongoose es **el estándar de facto** del ecosistema Node + Mongo: docs, ejemplos, soporte de Atlas.
- TTL indexes nativos.
- Hooks (`pre`/`post` save) si los necesitamos a futuro.
- `mongodb-memory-server` integrado para tests.

### Negativas
- Type-safety del schema **no es fuerte**: hay que mantener `interface SolicitudDocument` paralelo al `Schema`.
- Performance no es la mejor de Node ODMs (Prisma es más rápido pero está orientado a SQL).

### Mitigaciones
- Mantenemos el `interface` y el `Schema` en el mismo archivo (`solicitud.schema.ts`) para que cualquier cambio sea visible.
- Tests de integración con `mongodb-memory-server` (rapidísimos, no requieren Atlas).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Driver oficial `mongodb`** (sin ODM) | Sin schema, sin validación, sin hooks. Demasiado low-level para una squad de 5. |
| **TypeORM con MongoDB driver** | Soporte de TypeORM para Mongo es secundario; orientado a SQL. |
| **Prisma con MongoDB connector** | Prisma para Mongo es más limitado (sin transacciones complejas, sin hooks); su valor es en SQL. Lock-in fuerte con su CLI. |
| **Cambiar a Postgres + Prisma** | Discusión separada. Mongo es elegido por la flexibilidad del campo `datosFormulario` per producto. |

## Migración a futuro

Si el dominio madura y los datos son altamente relacionales (auditoría cross-aggregate, reporting complejo), considerar:
- Dual-write a Postgres para reporting (sin cambiar el escritura primario).
- Migración completa a Postgres + Prisma cuando los costos de operar Mongo + reporting separado superen el beneficio.

Decisión revisable cada **2 trimestres**.
