import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ALLOWED_ORIGINS: z.string().trim().min(1),
  DATABASE_URL: z.string().trim().url(),
  DIRECT_URL: z.string().trim().url(),
  JWT_SECRET: z.string().trim().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1),
});
