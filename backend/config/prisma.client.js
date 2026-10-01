// prisma.client.js
// Prisma is required for production. The stub remains available only for
// development and tests that intentionally exercise the JSON fallback store.

let prisma = null;
const hasDatabaseUrl = String(process.env.DATABASE_URL || '').trim().length > 0;
const firebaseDataMode = String(process.env.DATA_STORE_MODE || '').trim().toLowerCase() === 'firebase';
const isJestTest = String(process.env.NODE_ENV || '').toLowerCase() === 'test';
const isProductionRuntime = process.env.NODE_ENV === 'production' || Boolean(String(process.env.RENDER_SERVICE_ID || '').trim());
const forceRealDatabase = String(process.env.USE_REAL_DATABASE || '').trim().toLowerCase() === 'true';

if (isProductionRuntime && (process.env.NODE_ENV !== 'production' || !firebaseDataMode)) {
  throw new Error('[prisma.client] Production requires DATA_STORE_MODE=firebase; SQL and JSON fallback are disabled.');
}

if (firebaseDataMode) {
  prisma = null;
} else if (isJestTest && !forceRealDatabase) {
  prisma = {
    __stub: true,
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => null,
      update: async () => null,
      count: async () => 0,
      findMany: async () => [],
    },
    tenant: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => null,
      update: async () => null,
    },
    refreshToken: {
      create: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      update: async () => null,
      updateMany: async () => null,
    },
    emailToken: {
      create: async () => null,
      findFirst: async () => null,
      update: async () => null,
    },
    auditLog: {
      create: async () => null,
      findMany: async () => [],
    },
    userRole: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => null,
      count: async () => 0,
      deleteMany: async () => null,
      updateMany: async () => null,
    },
    $disconnect: async () => {},
  };
} else if (hasDatabaseUrl && !isJestTest) {
    try {
      // eslint-disable-next-line global-require
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }

      prisma = {
        __stub: true,
        user: {
          findUnique: async () => null,
          findFirst: async () => null,
          create: async () => null,
          update: async () => null,
          count: async () => 0,
          findMany: async () => [],
        },
        tenant: {
          findUnique: async () => null,
          findMany: async () => [],
          create: async () => null,
          update: async () => null,
        },
        refreshToken: {
          create: async () => null,
          findFirst: async () => null,
          findMany: async () => [],
          update: async () => null,
          updateMany: async () => null,
        },
        emailToken: {
          create: async () => null,
          findFirst: async () => null,
          update: async () => null,
        },
        auditLog: {
          create: async () => null,
          findMany: async () => [],
        },
        userRole: {
          findFirst: async () => null,
          findMany: async () => [],
          create: async () => null,
          count: async () => 0,
          deleteMany: async () => null,
          updateMany: async () => null,
        },
        $disconnect: async () => {},
      };
    }
  } else {
    prisma = {
      __stub: true,
      user: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async () => null,
        update: async () => null,
        count: async () => 0,
        findMany: async () => [],
      },
      tenant: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => null,
        update: async () => null,
      },
      refreshToken: {
        create: async () => null,
        findFirst: async () => null,
        findMany: async () => [],
        update: async () => null,
        updateMany: async () => null,
      },
      emailToken: {
        create: async () => null,
        findFirst: async () => null,
        update: async () => null,
      },
      auditLog: {
        create: async () => null,
        findMany: async () => [],
      },
      userRole: {
        findFirst: async () => null,
        findMany: async () => [],
        create: async () => null,
        count: async () => 0,
        deleteMany: async () => null,
        updateMany: async () => null,
      },
      $disconnect: async () => {},
    };
}

module.exports = prisma;
