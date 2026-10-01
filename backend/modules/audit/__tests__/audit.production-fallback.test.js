const fs = require('fs');

jest.mock('../../../firebase.data', () => ({
  isFirebaseDataConfigured: () => true,
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({ set: jest.fn(async () => { throw new Error('simulated durable store failure'); }) }),
    }),
  }),
}));

jest.mock('../../../config/prisma.client', () => null);

const { recordAuditEvent } = require('../audit.service');

describe('production audit persistence', () => {
  const originalEnvironment = {};

  beforeAll(() => {
    ['NODE_ENV', 'DATA_STORE_MODE', 'RENDER_SERVICE_ID'].forEach((key) => {
      originalEnvironment[key] = process.env[key];
    });
    process.env.NODE_ENV = 'production';
    process.env.DATA_STORE_MODE = 'firebase';
    delete process.env.RENDER_SERVICE_ID;
  });

  afterAll(() => {
    Object.entries(originalEnvironment).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  test('does not fall back to local JSON or log event contents when Firestore fails', async () => {
    const writeSpy = jest.spyOn(fs, 'writeFileSync');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await recordAuditEvent({ action: 'production.audit.failure', metadata: { safeContext: 'not logged' } });

      expect(writeSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('[audit.service] Durable audit event was not persisted.');
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('not logged');
    } finally {
      writeSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});