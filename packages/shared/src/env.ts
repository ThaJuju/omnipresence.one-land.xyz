import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  WEB_PORT: z.coerce.number().default(3000),
  BOT_HTTP_PORT: z.coerce.number().default(3001),
  BOT_INTERNAL_SECRET: z.string().min(32),
  SUPERADMIN_DISCORD_ID: z.string().min(1),
  UPLOADS_DIR: z.string().default('./uploads'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) return {} as Env
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Variables d\'environnement manquantes ou invalides:')
    for (const [field, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${field}: ${(errors as string[]).join(', ')}`)
    }
    process.exit(1)
  }
  return result.data
}

export const env = parseEnv()
