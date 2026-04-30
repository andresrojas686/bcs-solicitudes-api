/**
 * Seed script: pobla la base con solicitudes de muestra en distintos estados
 * para que el evaluador vea datos al abrir el frontend sin tener que crearlos.
 *
 * Uso: pnpm seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import {
  SOLICITUD_COLLECTION,
  SolicitudSchema,
  type SolicitudDocument,
} from '../src/modules/solicitudes/infrastructure/persistence/solicitud.schema';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'bcs-solicitudes';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI no configurada en .env');
  process.exit(1);
}

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const SAMPLES: SolicitudDocument[] = [
  {
    _id: `sol_seed_${nanoid(8)}`,
    cliente: { tipoDoc: 'CC', numDoc: '1111111111' },
    productoCodigo: 'AHO-001',
    estado: 'DRAFT',
    datosFormulario: { montoInicial: 500_000 },
    historicoEstados: [
      {
        estadoAnterior: 'DRAFT',
        estadoNuevo: 'DRAFT',
        actor: 'usr_asesor_001',
        motivo: 'Creación de solicitud (seed)',
        timestamp: minutesAgo(60),
      },
    ],
    correlationId: 'seed-001',
    idempotencyKey: `seed-${nanoid(8)}`,
    pendienteEnvioCore: false,
    createdAt: minutesAgo(60),
    updatedAt: minutesAgo(60),
    version: 0,
  },
  {
    _id: `sol_seed_${nanoid(8)}`,
    cliente: { tipoDoc: 'CC', numDoc: '1111111111' },
    productoCodigo: 'TC-001',
    estado: 'IN_REVIEW',
    datosFormulario: { ingresosMensuales: 4_000_000, cupoSolicitado: 8_000_000, tipoEmpleo: 'EMPLEADO' },
    historicoEstados: [
      { estadoAnterior: 'DRAFT', estadoNuevo: 'DRAFT', actor: 'usr_asesor_001', motivo: 'Creación', timestamp: minutesAgo(45) },
      { estadoAnterior: 'DRAFT', estadoNuevo: 'IN_REVIEW', actor: 'usr_asesor_001', motivo: 'Enviada a revisión', timestamp: minutesAgo(40) },
    ],
    correlationId: 'seed-002',
    idempotencyKey: `seed-${nanoid(8)}`,
    pendienteEnvioCore: false,
    createdAt: minutesAgo(45),
    updatedAt: minutesAgo(40),
    version: 1,
  },
  {
    _id: `sol_seed_${nanoid(8)}`,
    cliente: { tipoDoc: 'CC', numDoc: '2222222222' },
    productoCodigo: 'AHO-001',
    estado: 'APPROVED',
    datosFormulario: { montoInicial: 1_000_000, sucursalPreferida: 'NORTE' },
    historicoEstados: [
      { estadoAnterior: 'DRAFT', estadoNuevo: 'DRAFT', actor: 'usr_asesor_001', motivo: 'Creación', timestamp: minutesAgo(30) },
      { estadoAnterior: 'DRAFT', estadoNuevo: 'IN_REVIEW', actor: 'usr_asesor_001', motivo: 'Enviada a revisión', timestamp: minutesAgo(25) },
      { estadoAnterior: 'IN_REVIEW', estadoNuevo: 'APPROVED', actor: 'usr_super_001', motivo: 'Cliente cumple política', timestamp: minutesAgo(20) },
    ],
    correlationId: 'seed-003',
    idempotencyKey: `seed-${nanoid(8)}`,
    pendienteEnvioCore: false,
    createdAt: minutesAgo(30),
    updatedAt: minutesAgo(20),
    version: 2,
  },
  {
    _id: `sol_seed_${nanoid(8)}`,
    cliente: { tipoDoc: 'CC', numDoc: '1111111111' },
    productoCodigo: 'LI-001',
    estado: 'FINALIZED',
    datosFormulario: { monto: 15_000_000, plazoMeses: 36, destino: 'EDUCACION', ingresosMensuales: 5_000_000 },
    historicoEstados: [
      { estadoAnterior: 'DRAFT', estadoNuevo: 'DRAFT', actor: 'usr_asesor_001', motivo: 'Creación', timestamp: minutesAgo(120) },
      { estadoAnterior: 'DRAFT', estadoNuevo: 'IN_REVIEW', actor: 'usr_asesor_001', motivo: 'Enviada a revisión', timestamp: minutesAgo(115) },
      { estadoAnterior: 'IN_REVIEW', estadoNuevo: 'APPROVED', actor: 'usr_super_001', motivo: 'Score crediticio OK', timestamp: minutesAgo(100) },
      { estadoAnterior: 'APPROVED', estadoNuevo: 'FINALIZED', actor: 'usr_super_001', motivo: 'Apertura confirmada por Core', timestamp: minutesAgo(95) },
    ],
    correlationId: 'seed-004',
    idempotencyKey: `seed-${nanoid(8)}`,
    numeroProducto: 'BCS-SEED12345',
    pendienteEnvioCore: false,
    createdAt: minutesAgo(120),
    updatedAt: minutesAgo(95),
    version: 3,
  },
];

(async () => {
  console.log(`🌱 Seeding bcs-solicitudes-api · DB: ${DB_NAME}`);
  await mongoose.connect(MONGODB_URI!, { dbName: DB_NAME });

  const Solicitud = mongoose.model<SolicitudDocument>(SOLICITUD_COLLECTION, SolicitudSchema);

  // Limpia solo las solicitudes de seed previas para no contaminar datos manuales
  const deleted = await Solicitud.deleteMany({ correlationId: /^seed-/ });
  console.log(`  Removidas ${deleted.deletedCount} solicitudes seed previas`);

  for (const s of SAMPLES) {
    await Solicitud.create(s);
    console.log(`  ✓ ${s.estado.padEnd(10)} · ${s.productoCodigo} · ${s._id}`);
  }

  console.log(`\n✅ Seed completado: ${SAMPLES.length} solicitudes creadas`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('❌ Seed falló:', err);
  process.exit(1);
});
