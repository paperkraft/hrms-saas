import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString = process.env.DATABASE_URL;

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: 20, // Max connection limit per pool instance
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Fast-fail connection wait (5s) instead of hanging infinitely
  });

const adapter = new PrismaPg(pool);

const prisma =
  globalForPrisma.prisma && 'driveStarredItem' in globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}

export default prisma;