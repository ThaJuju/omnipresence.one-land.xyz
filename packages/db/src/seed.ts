import { prisma } from './index'

async function main() {
  console.log('Seed skipped in production — no default data needed.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
