const fs = require('fs')
const path = require('path')

function loadEnv(filePath) {
  const env = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const envVars = loadEnv('/var/www/blackmdt/.env')

module.exports = {
  apps: [
    {
      name: 'discordpanel-web',
      cwd: '/var/www/blackmdt/apps/web/.next/standalone/apps/web',
      script: 'node',
      args: 'server.js',
      env: { ...envVars, PORT: 3003 },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
    {
      name: 'discordpanel-bot',
      cwd: '/var/www/blackmdt/apps/bot',
      script: 'node',
      args: 'dist/apps/bot/src/index.js',
      env: envVars,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
}
