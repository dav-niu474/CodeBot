import { PrismaClient } from '@prisma/client'
import path from 'path'

// Dynamically resolve database path for both dev and standalone deployment
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl) {
    // If it's already an absolute path, use as-is
    if (path.isAbsolute(envUrl.replace('file:', ''))) {
      return envUrl
    }
  }
  // Resolve relative to project root
  const dbPath = path.join(process.cwd(), 'db', 'custom.db')
  return `file:${dbPath}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db