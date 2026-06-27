/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@repo/db', '@repo/shared'],
  images: {
    domains: ['cdn.discordapp.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pdfkit'],
    outputFileTracingIncludes: {
      '/**': ['../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/*.node'],
    },
  },
}

export default nextConfig
