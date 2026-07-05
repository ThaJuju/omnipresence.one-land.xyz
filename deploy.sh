#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "==> Build web..."
pnpm --filter web build

STANDALONE="apps/web/.next/standalone"
ENGINE=$(find node_modules/.pnpm -name "libquery_engine-debian-openssl-3.0.x.so.node" | grep "\.prisma/client" | head -1)

echo "==> Copy static assets..."
# Le postbuild crée déjà un symlink vers .next/static ; ne copier que s'il est absent
if [ ! -e "$STANDALONE/apps/web/.next/static" ]; then
  cp -r apps/web/.next/static "$STANDALONE/apps/web/.next/static"
fi

echo "==> Copy Prisma engine..."
cp "$ENGINE" "$STANDALONE/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/" 2>/dev/null || true
cp "$ENGINE" "$STANDALONE/apps/web/.next/server/"
mkdir -p "$STANDALONE/apps/web/.prisma/client"
cp "$ENGINE" "$STANDALONE/apps/web/.prisma/client/"

echo "==> Restart web..."
pm2 restart discordpanel-web

echo "==> Done!"
pm2 list
