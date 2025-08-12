import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('./data.db'),
  CRON: z.string().default('0 * * * *'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

// TODO: add more env variables as needed
