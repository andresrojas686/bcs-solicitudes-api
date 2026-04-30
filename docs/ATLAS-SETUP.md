# Setup de MongoDB Atlas (free tier M0) — paso a paso

Este documento es la guía única que debes seguir para conectar el backend a MongoDB Atlas. Tiempo estimado: **~5 minutos**.

> **¿Por qué Atlas y no Docker?** Para esta prueba elegimos Atlas porque (1) tu disco C: está ajustado y Docker añadiría 2-3 GB, (2) tu hardware ya tiene WSL2 pero queríamos cero virtualización, (3) Atlas es el sabor de Mongo más realista para producción y muestra criterio de Líder Técnico al evaluador.

---

## 1. Crear cuenta en Atlas (1 min)

1. Abre https://cloud.mongodb.com/
2. Si ya tienes cuenta Google/GitHub, usa SSO. Si no, regístrate con email.
3. Acepta términos. Cuando pida "What is your goal?", elige **Build a new app** (es lo más cercano a la prueba).

---

## 2. Crear el cluster M0 free (2 min)

1. En el dashboard, click **+ Create** o **Build a Database**.
2. Elige el plan **M0 — Free** (debe estar marcado como `$0/forever`).
3. **Provider**: AWS (más estable para free tier).
4. **Region**: la más cercana geográficamente. Para Colombia: `N. Virginia (us-east-1)` suele dar la mejor latencia desde la región andina.
5. **Cluster Name**: `bcs-solicitudes-cluster` (puedes dejar el default `Cluster0`, no afecta).
6. Click **Create Deployment**. Atlas tarda 1-3 minutos en provisionar.

---

## 3. Crear usuario de base de datos (1 min)

Mientras se crea el cluster, Atlas te muestra un wizard "Connect to Cluster":

1. **Username**: `bcs-app`
2. **Password**: genera una segura (usa el botón **Autogenerate Secure Password** y **cópiala antes de cerrar la ventana** — no la verás otra vez).
3. Click **Create User**.

> ⚠️ **Si la contraseña tiene caracteres especiales** (`@`, `:`, `/`, `?`, `#`, `[`, `]`), tendrás que URL-encodearla cuando la pegues en `MONGODB_URI`. Para evitarlo, regenérala hasta que sea solo alfanumérica + algún `_` o `-`.

---

## 4. Configurar Network Access (1 min)

1. En la barra lateral izquierda, click **Network Access** (sección **Security**).
2. Click **+ ADD IP ADDRESS**.
3. Para desarrollo local **y** que el evaluador pueda probar desde su máquina:
   - Click **ALLOW ACCESS FROM ANYWHERE** → escribe descripción `Prueba técnica BCS — abierto temporalmente`.
   - Esto agrega `0.0.0.0/0`.
4. Click **Confirm**.

> ⚠️ En un entorno productivo real **nunca** abriríamos `0.0.0.0/0`. Lo correcto sería allowlist de IPs corporativas, VPN o VPC peering. Documentado en el README como trade-off conocido.

---

## 5. Obtener el connection string (1 min)

1. Vuelve a **Database** en la barra lateral.
2. En tu cluster, click **Connect**.
3. Elige **Drivers**.
4. Driver: **Node.js**, Version: **6.7 or later**.
5. Copia el connection string. Se ve así:
   ```
   mongodb+srv://bcs-app:<password>@bcs-solicitudes-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=bcs-solicitudes-cluster
   ```
6. **Reemplaza `<password>` con la contraseña real** que generaste en el paso 3.
7. **Añade el nombre de la base de datos** entre el `/` y el `?`. El string queda así:
   ```
   mongodb+srv://bcs-app:TU_PASSWORD@bcs-solicitudes-cluster.xxxxx.mongodb.net/bcs-solicitudes?retryWrites=true&w=majority&appName=bcs-solicitudes-cluster
   ```

---

## 6. Pegar en `.env` del backend

```bash
cd bcs-solicitudes-api
cp .env.example .env
# Abre .env y pega el connection string en MONGODB_URI
```

Edita `MONGODB_URI` y `MONGODB_DB_NAME=bcs-solicitudes`.

---

## 7. Verificar conexión

Cuando el backend esté implementado (B2), correrás:

```bash
pnpm install
pnpm dev
# luego en otra terminal:
curl http://localhost:3000/health/ready
```

La respuesta debe ser:
```json
{
  "status": "ok",
  "info": {
    "mongo": { "status": "up" },
    "core-mock": { "status": "up" }
  }
}
```

Si `mongo` aparece `down`, los problemas más comunes son:
1. Password mal copiada o no URL-encodeada → revisa el string.
2. IP no autorizada → vuelve a Network Access y confirma `0.0.0.0/0` o agrega tu IP actual.
3. Nombre de base de datos faltante en el path → debe ser `/bcs-solicitudes` antes del `?`.

---

## 8. Inspeccionar datos (opcional)

Para ver tus colecciones desde la web sin instalar nada:

1. En Atlas, sección **Database** → click **Browse Collections** en tu cluster.
2. Verás `bcs-solicitudes` con todas las colecciones (`solicitudes`, `idempotency_keys`, `eventos_auditoria`, etc.) cuando empiecen a recibir datos.

---

## Resumen de lo que tendrás al final

- ✅ Cluster M0 corriendo (gratis, sin tarjeta).
- ✅ Usuario `bcs-app` con permisos `readWrite` sobre `bcs-solicitudes`.
- ✅ Network Access abierto temporalmente para la prueba.
- ✅ Connection string en tu `.env` local.

Total invertido: ~5 minutos. Volveremos a este documento si surge cualquier problema de conectividad.
