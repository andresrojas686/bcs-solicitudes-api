#!/usr/bin/env node
/**
 * Orquestación dev: arranca Nest (puerto :3000) + bcs-core-mock (puerto :4001) en paralelo.
 * Usa concurrently para colorear logs y matar todo con Ctrl+C.
 */
import concurrently from 'concurrently';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '..');
const mockDir = resolve(apiDir, '..', 'bcs-core-mock');

if (!existsSync(mockDir)) {
  console.error(`[dev] No se encontró bcs-core-mock en: ${mockDir}`);
  console.error(`[dev] Asegúrate de que los 3 repos estén como carpetas hermanas.`);
  process.exit(1);
}

const { result } = concurrently(
  [
    {
      name: 'api',
      command: 'pnpm run start:dev',
      cwd: apiDir,
      prefixColor: 'cyan',
    },
    {
      name: 'mock',
      command: 'pnpm dev',
      cwd: mockDir,
      prefixColor: 'magenta',
    },
  ],
  {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 0,
  }
);

result.then(
  () => process.exit(0),
  () => process.exit(1)
);
