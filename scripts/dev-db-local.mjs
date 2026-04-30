#!/usr/bin/env node
/**
 * Fallback offline: arranca un MongoDB en memoria (mongodb-memory-server) en :27017.
 * Útil para presentación sin internet o si Atlas falla.
 *
 * Uso:
 *   1. En una terminal: `pnpm dev:db:local` (este script)
 *   2. En otra terminal: cambia MONGODB_URI=mongodb://127.0.0.1:27017/bcs-solicitudes en .env
 *   3. Arranca el resto: `pnpm dev`
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = 27017;
const DB_NAME = 'bcs-solicitudes';

async function main() {
  console.log(`[dev:db:local] Arrancando mongodb-memory-server en puerto ${PORT}...`);
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: DB_NAME },
  });
  const uri = server.getUri();
  console.log(`[dev:db:local] MongoDB en memoria escuchando.`);
  console.log(`[dev:db:local] MONGODB_URI sugerido para tu .env:`);
  console.log(`               ${uri.replace(/\/$/, '')}/${DB_NAME}`);
  console.log(`[dev:db:local] Ctrl+C para apagar.`);

  const shutdown = async () => {
    console.log(`\n[dev:db:local] Apagando...`);
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[dev:db:local] Error:', err);
  process.exit(1);
});
