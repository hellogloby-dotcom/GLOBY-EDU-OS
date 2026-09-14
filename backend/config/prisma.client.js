// prisma.client.js
// Lightweight wrapper for Prisma Client. If Prisma is not installed yet,
// this module falls back to a stub to avoid runtime crashes during incremental migration.

let prisma = null;
try {
  // eslint-disable-next-line global-require
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (err) {
  // Prisma not installed yet - provide stub methods used by the auth module.
  prisma = {
    __stub: true,
    user: {
      findUnique: async () => null,
      create: async () => null,
    },
    tenant: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    refreshToken: {
      create: async () => null,
      findFirst: async () => null,
      update: async () => null,
    },
    auditLog: {
      create: async () => null,
      findMany: async () => [],
    },
    $disconnect: async () => {},
  };
}

module.exports = prisma;
