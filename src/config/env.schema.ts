import { z } from 'zod';

/**
 * Schema for environment variables. Validated at startup; the process exits
 * with a clear error if any required var is missing or malformed.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // MongoDB Atlas
  MONGODB_URI: z.string().min(20).startsWith('mongodb', {
    message: 'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string',
  }),
  MONGODB_DB_NAME: z.string().default('bcs-solicitudes'),

  // Mock Mulesoft / Core Banking
  CORE_MOCK_URL: z.string().url().default('http://localhost:4001'),
  CORE_BANKING_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CORE_BANKING_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  // Auth
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters in non-prod, 32+ in prod')
    .refine(
      (s) => process.env.NODE_ENV !== 'production' || s.length >= 32,
      'JWT_SECRET must be ≥32 chars in production',
    ),
  JWT_EXPIRES_IN: z.string().default('15m'),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof envSchema>;

/** Validates `process.env` and returns the typed config (fail-fast). */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment variables:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}
