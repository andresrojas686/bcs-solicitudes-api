# ADR-0003 — JWT mock con HS256 para la prueba; Keycloak/IdP corporativo en producción

* **Estado**: Aceptado (para la prueba técnica) · Reemplazable en sprint 1 productivo
* **Fecha**: 2026-04-29

## Contexto

La plataforma necesita autenticación de usuarios internos (asesores, supervisores) con roles. En producción, BCS usa un IdP corporativo (Keycloak / Auth0 / similar). Para esta prueba técnica, **integrar Keycloak excede el time-box** y desviaría el foco del backend de negocio.

## Decisión

Implementamos un **JWT mock con HS256** firmado por el backend mismo. Tres usuarios sembrados con bcrypt en memoria:
- `asesor / asesor123` (rol ASESOR)
- `supervisor / super123` (rol SUPERVISOR)
- `admin / admin123` (roles ASESOR + SUPERVISOR + ADMIN)

El flujo es indistinguible del que tendríamos con un IdP real desde el punto de vista del backend (`JwtStrategy` valida el token), por lo que el reemplazo en producción es localizable a `auth.module.ts`.

## Consecuencias

### Positivas
- Permite mostrar la **arquitectura de autorización completa** (`@Roles`, `@CurrentUser`, `JwtAuthGuard`, `RolesGuard`) sin overhead.
- Tests e2e funcionan sin dependencia externa.
- Throttler estricto en `/auth/login` ya implementado (OWASP A07).

### Negativas
- **NO LISTO PARA PRODUCCIÓN** — está documentado claramente.
- No hay rotación de secret, ni revocación de tokens, ni refresh tokens.
- Las credenciales viven en código (aunque hashed); en producción serían un IdP externo.

## Plan de migración a Keycloak (sprint 1 productivo)

1. **No cambia el backend de aplicación**, solo el módulo `auth/`.
2. Reemplazar `Credentials Provider` por validación contra Keycloak (RS256 con JWKS).
3. `JwtStrategy.secretOrKey` → `secretOrKeyProvider` con cache de JWKS.
4. Roles vienen de `realm_access.roles` o claim custom configurada en Keycloak.
5. `/auth/login` se elimina del backend; el frontend redirige a Keycloak.
6. NextAuth en frontend cambia el provider de `Credentials` a `Keycloak`.

Tiempo estimado: **2 días** de un dev senior.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Implementar OAuth completo con Keycloak local en Docker** | Excede el time-box de la prueba. |
| **Sin auth ("público")** | No demuestra las capacidades de autorización (roles, OWASP A01/A07). |
| **Auth0 hosted free** | Crear cuenta + configurar app + tenant excede el alcance. |

## Estado en producción

Este ADR queda **reemplazado por ADR-XXX (futuro): Integración con Keycloak corporativo** cuando se implemente.
