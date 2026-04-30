#!/usr/bin/env node
/**
 * Verifica conectividad a MongoDB Atlas usando el MONGODB_URI del .env.
 * Uso: pnpm exec node scripts/check-atlas.mjs
 *
 * Sale con código:
 *   0 = conexión OK
 *   1 = MONGODB_URI faltante o malformado
 *   2 = error de conexión / autenticación
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? 'bcs-solicitudes';

if (!uri || uri.includes('CHANGE_ME')) {
  console.error('❌ MONGODB_URI no está configurado en .env');
  console.error('   Edita bcs-solicitudes-api/.env y pega tu connection string de Atlas.');
  process.exit(1);
}

// Validación básica de formato sin exponer la password
const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
console.log('🔍 Probando conexión a:');
console.log(`   ${masked}`);
console.log(`   Base de datos: ${dbName}`);
console.log('');

const start = Date.now();

try {
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const adminDb = mongoose.connection.db.admin();
  const ping = await adminDb.ping();
  const buildInfo = await adminDb.buildInfo();
  const elapsed = Date.now() - start;

  console.log('✅ Conexión exitosa');
  console.log(`   Latencia inicial: ${elapsed} ms`);
  console.log(`   Mongo version:    ${buildInfo.version}`);
  console.log(`   Ping ok:          ${ping.ok === 1}`);

  // Listar colecciones (debe estar vacío en cluster nuevo)
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`   Colecciones:      ${collections.length === 0 ? '(ninguna todavía)' : collections.map((c) => c.name).join(', ')}`);

  await mongoose.disconnect();
  console.log('\n👍 Atlas listo para el desarrollo. Continuamos con B1.');
  process.exit(0);
} catch (err) {
  const elapsed = Date.now() - start;
  console.error(`\n❌ Error de conexión (tras ${elapsed} ms):`);
  console.error(`   ${err.name}: ${err.message}`);
  console.error('');
  console.error('Causas comunes:');
  console.error('  1. Password mal copiada o no URL-encodeada (revisa caracteres especiales).');
  console.error('  2. Network Access en Atlas no permite tu IP — agrega 0.0.0.0/0 temporalmente.');
  console.error('  3. Falta el nombre de DB en el path: ...mongodb.net/bcs-solicitudes?...');
  console.error('  4. Cluster aún provisionando (puede tardar 1-3 min al crearlo).');
  await mongoose.disconnect().catch(() => {});
  process.exit(2);
}
