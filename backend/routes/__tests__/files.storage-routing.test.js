const express = require('express');

jest.mock('../../modules/auth/middleware/auth.middleware', () => (req, res, next) => {
  req.user = { tenantId: 'school-a', roles: ['school_authority'] };
  next();
});

jest.mock('../../firebase.data', () => ({
  isFirebaseDataConfigured: jest.fn(() => true),
  getStorageBucket: jest.fn(),
}));

jest.mock('../../lib/supabaseClient', () => ({
  uploadSchoolFile: jest.fn(async () => {}),
  createSchoolFileSignedUrl: jest.fn(async () => 'https://signed.example.test/file'),
  isR2Configured: jest.fn(() => true),
  getSchoolFilePublicUrl: jest.fn(() => null),
}));

const firebaseData = require('../../firebase.data');
const storage = require('../../lib/supabaseClient');
const fileRoutes = require('../files');

describe('production file storage routing', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    jest.clearAllMocks();
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
    storage.isR2Configured.mockReturnValue(true);
    storage.getSchoolFilePublicUrl.mockReturnValue(null);
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  async function runRequest(method, url, body) {
    const app = express();
    app.use('/files', fileRoutes);
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    try {
      return await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'image/png' } : {},
        body,
      });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }

  test('does not use Firebase Storage for production uploads without a persistent R2 URL', async () => {
    const response = await runRequest('POST', '/files/upload?filename=students/photo.png', Buffer.from('image'));

    expect(response.status).toBe(503);
    expect(firebaseData.getStorageBucket).not.toHaveBeenCalled();
    expect(storage.uploadSchoolFile).not.toHaveBeenCalled();
  });

  test('does not use Firebase Storage for production retrieval when R2 is configured', async () => {
    const response = await runRequest('GET', '/files/students/photo.png');

    expect(response.status).toBe(200);
    expect(firebaseData.getStorageBucket).not.toHaveBeenCalled();
    expect(storage.createSchoolFileSignedUrl).toHaveBeenCalledWith('school-a/students/photo.png', 3600);
  });

  test('fails closed when R2 is unavailable even if Firebase Storage is configured', async () => {
    storage.isR2Configured.mockReturnValue(false);

    const response = await runRequest('GET', '/files/students/photo.png');

    expect(response.status).toBe(503);
    expect(firebaseData.getStorageBucket).not.toHaveBeenCalled();
  });
});