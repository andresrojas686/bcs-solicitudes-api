/**
 * Tests de integración: use cases de Solicitudes ↔ Mongoose ↔ mongodb-memory-server.
 * No tocan Atlas; cada test arranca/destruye una DB en memoria.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  SOLICITUD_COLLECTION,
  SolicitudSchema,
  type SolicitudDocument,
} from '../../src/modules/solicitudes/infrastructure/persistence/solicitud.schema';
import { SolicitudMongoRepository } from '../../src/modules/solicitudes/infrastructure/persistence/solicitud.mongo.repository';
import { CrearSolicitudUseCase } from '../../src/modules/solicitudes/application/use-cases/crear-solicitud.usecase';
import { TransicionarSolicitudUseCase } from '../../src/modules/solicitudes/application/use-cases/transicionar-solicitud.usecase';
import { ConsultarSolicitudUseCase } from '../../src/modules/solicitudes/application/use-cases/consultar-solicitud.usecase';
import { isOk, isErr } from '../../src/shared/kernel/result';
import { InvalidStateTransitionError } from '../../src/modules/solicitudes/domain/value-objects/estado-solicitud.vo';
import { SolicitudNotFoundError } from '../../src/shared/kernel/domain-error';

// Fake metrics service that no-ops; we don't test prom-client here.
const fakeMetrics = {
  recordSolicitudCreada: jest.fn(),
  recordCambioEstado: jest.fn(),
  startCoreRequest: jest.fn(() => () => undefined),
} as unknown as ConstructorParameters<typeof CrearSolicitudUseCase>[1];

describe('Solicitudes — integración (Mongo en memoria)', () => {
  let mongo: MongoMemoryServer;
  let repo: SolicitudMongoRepository;
  let crear: CrearSolicitudUseCase;
  let consultar: ConsultarSolicitudUseCase;
  let transicionar: TransicionarSolicitudUseCase;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'bcs-test' });
    const Model = mongoose.model<SolicitudDocument>(SOLICITUD_COLLECTION, SolicitudSchema);
    repo = new SolicitudMongoRepository(Model);
    crear = new CrearSolicitudUseCase(repo, fakeMetrics);
    consultar = new ConsultarSolicitudUseCase(repo);
    transicionar = new TransicionarSolicitudUseCase(repo, fakeMetrics);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.collection(SOLICITUD_COLLECTION).deleteMany({});
  });

  describe('CrearSolicitudUseCase', () => {
    it('crea una solicitud nueva en estado DRAFT y la persiste', async () => {
      const result = await crear.execute({
        cliente: { tipoDoc: 'CC', numDoc: '1111111111' },
        productoCodigo: 'AHO-001',
        correlationId: 'int-test-1',
        actor: 'usr_test_001',
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.estado.value).toBe('DRAFT');
      expect(result.value.id).toMatch(/^sol_/);
      expect(result.value.historicoEstados).toHaveLength(1);

      // Persisted: re-fetch
      const found = await repo.buscarPorId(result.value.id);
      expect(found).not.toBeNull();
      expect(found!.estado.value).toBe('DRAFT');
    });

    it('respeta la idempotencia: misma key devuelve la misma solicitud', async () => {
      const input = {
        cliente: { tipoDoc: 'CC' as const, numDoc: '1111111111' },
        productoCodigo: 'AHO-001',
        correlationId: 'int-test-idem',
        idempotencyKey: 'idem-abc-123',
        actor: 'usr_test_001',
      };
      const r1 = await crear.execute(input);
      const r2 = await crear.execute(input);
      expect(isOk(r1) && isOk(r2)).toBe(true);
      if (isOk(r1) && isOk(r2)) {
        expect(r1.value.id).toBe(r2.value.id);
      }
      // Solo hay UN documento en la colección
      const count = await mongoose.connection.collection(SOLICITUD_COLLECTION).countDocuments();
      expect(count).toBe(1);
    });
  });

  describe('TransicionarSolicitudUseCase', () => {
    it('flujo completo DRAFT → IN_REVIEW → APPROVED actualiza historial', async () => {
      const created = await crear.execute({
        cliente: { tipoDoc: 'CC', numDoc: '1111111111' },
        productoCodigo: 'TC-001',
        correlationId: 'int-test-flow',
        actor: 'usr_asesor_001',
      });
      if (!isOk(created)) throw new Error('failed to create');
      const id = created.value.id;

      // DRAFT → IN_REVIEW
      const r1 = await transicionar.execute({
        id,
        target: 'APPROVED', // intentional skip — should fail
        actor: 'usr_super_001',
      });
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) {
        expect(r1.error).toBeInstanceOf(InvalidStateTransitionError);
      }

      // Real flow needs IN_REVIEW first
      // (uso transicionar con target='IN_REVIEW' no soportado por este use case
      // — se hace por PATCH en producción. Aquí actualizamos directo via repo.)
      const draft = await repo.buscarPorId(id);
      draft!.transicionar('IN_REVIEW', 'usr_asesor_001', 'Test');
      await repo.guardar(draft!);

      const r2 = await transicionar.execute({ id, target: 'APPROVED', actor: 'usr_super_001', motivo: 'OK' });
      expect(isOk(r2)).toBe(true);
      if (!isOk(r2)) return;
      expect(r2.value.estado.value).toBe('APPROVED');
      expect(r2.value.historicoEstados.length).toBe(3);
    });
  });

  describe('ConsultarSolicitudUseCase', () => {
    it('devuelve SolicitudNotFoundError cuando el id no existe', async () => {
      const result = await consultar.execute('sol_doesnotexist');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(SolicitudNotFoundError);
      }
    });
  });
});
