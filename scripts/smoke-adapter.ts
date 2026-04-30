/**
 * Smoke test del MulesoftAdapter contra bcs-core-mock.
 * Requiere que el mock esté corriendo en http://localhost:4001 (`pnpm dev` en bcs-core-mock).
 *
 * Uso: pnpm exec tsx scripts/smoke-adapter.ts
 *
 * Valida:
 *   - Caso feliz: cliente 1111111111 → ok
 *   - Filtrado por KYC: cliente 2222222222 → 1 producto elegible
 *   - Reintentos: cliente 3333333333 → 503 dos veces, luego 201 (axios-retry)
 *   - 404 mapeado a CoreBankingNotFoundError
 *   - 422 mapeado a CoreBankingBusinessError
 */
import { MulesoftAdapter } from '../src/modules/solicitudes/infrastructure/core-banking/mulesoft.adapter';
import { isOk, isErr } from '../src/shared/kernel/result';
import {
  CoreBankingBusinessError,
  CoreBankingNotFoundError,
} from '../src/shared/kernel/domain-error';

const adapter = new MulesoftAdapter({
  baseUrl: process.env.CORE_MOCK_URL ?? 'http://localhost:4001',
  timeoutMs: 5000,
  maxRetries: 3,
  allowedHosts: ['localhost:4001', 'api.mulesoft.bcs.co'],
});

const tests: Array<{ name: string; run: () => Promise<void> }> = [];

function test(name: string, run: () => Promise<void>) {
  tests.push({ name, run });
}

function expect(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`Expectation failed: ${msg}`);
}

const cid = (suffix: string) => `smoke-${Date.now()}-${suffix}`;

test('1. Cliente 1111111111 (KYC APROBADO) — happy path', async () => {
  const result = await adapter.consultarCliente('CC', '1111111111', cid('1'));
  expect(isOk(result), 'expected ok');
  if (!isOk(result)) return;
  expect(result.value.kycStatus === 'APROBADO', 'kycStatus should be APROBADO');
  expect(result.value.nombres === 'Ana María', `nombres: ${result.value.nombres}`);
});

test('2. Cliente 4444444444 → 404 mapeado a CoreBankingNotFoundError', async () => {
  const result = await adapter.consultarCliente('CC', '4444444444', cid('2'));
  expect(isErr(result), 'expected err');
  if (!isErr(result)) return;
  expect(
    result.error instanceof CoreBankingNotFoundError,
    `expected NotFoundError, got ${result.error.constructor.name}`,
  );
});

test('3. Productos elegibles 2222222222 (KYC PENDIENTE) → solo ahorros', async () => {
  const result = await adapter.consultarProductosElegibles('CC', '2222222222', cid('3'));
  expect(isOk(result), 'expected ok');
  if (!isOk(result)) return;
  expect(result.value.length === 1, `expected 1 product, got ${result.value.length}`);
  expect(result.value[0].tipo === 'CUENTA_AHORROS', `expected CUENTA_AHORROS, got ${result.value[0].tipo}`);
});

test('4. Productos elegibles 1111111111 (KYC APROBADO) → 3 productos', async () => {
  const result = await adapter.consultarProductosElegibles('CC', '1111111111', cid('4'));
  expect(isOk(result), 'expected ok');
  if (!isOk(result)) return;
  expect(result.value.length === 3, `expected 3 products, got ${result.value.length}`);
});

test('5. Apertura producto 3333333333 → axios-retry recupera tras 2x 503', async () => {
  const idemKey = `smoke-retry-${Date.now()}`; // unique to ensure mock counter resets
  const result = await adapter.solicitarApertura({
    cliente: { tipoDoc: 'CC', numDoc: '3333333333' },
    productoCodigo: 'AHO-001',
    idempotencyKey: idemKey,
    correlationId: cid('5'),
  });
  expect(isOk(result), `expected ok after retries (got: ${isErr(result) ? result.error.message : 'unknown'})`);
  if (!isOk(result)) return;
  expect(result.value.numeroProducto.startsWith('BCS-'), `numeroProducto: ${result.value.numeroProducto}`);
  expect(result.value.estado === 'ACTIVO', `estado: ${result.value.estado}`);
});

test('6. Apertura producto 5555555555 → 422 mapeado a CoreBankingBusinessError', async () => {
  const result = await adapter.solicitarApertura({
    cliente: { tipoDoc: 'CC', numDoc: '5555555555' },
    productoCodigo: 'TC-001',
    idempotencyKey: `smoke-422-${Date.now()}`,
    correlationId: cid('6'),
  });
  expect(isErr(result), 'expected err');
  if (!isErr(result)) return;
  expect(
    result.error instanceof CoreBankingBusinessError,
    `expected BusinessError, got ${result.error.constructor.name}`,
  );
});

test('7. Abandonar solicitud SOL-123 → ok', async () => {
  const result = await adapter.abandonarSolicitud('SOL-123', cid('7'));
  expect(isOk(result), 'expected ok');
});

(async () => {
  console.log(`\n🔥 Smoke MulesoftAdapter ↔ bcs-core-mock (${tests.length} tests)\n`);
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    const start = Date.now();
    try {
      await t.run();
      const ms = Date.now() - start;
      console.log(`  ✓ ${t.name}  (${ms} ms)`);
      passed++;
    } catch (e) {
      const ms = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ ${t.name}  (${ms} ms)`);
      console.log(`    ${msg}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
