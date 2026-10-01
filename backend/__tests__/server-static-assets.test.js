const { app } = require('../server');

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: 'HEAD', headers: { connection: 'close' }, ...options });
  await response.body?.cancel();
  return { status: response.status, headers: Object.fromEntries(response.headers) };
}

describe('production static asset caching', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30000);

  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  test('serves production JS and service worker assets without stale-cache headers', async () => {
    const [rootIndex, mainJs, legacyMainJs, swJs, heroImage, missingAsset] = await Promise.all([
      request(baseUrl, '/'),
      request(baseUrl, '/marketing/src/main.js'),
      request(baseUrl, '/src/main.js'),
      request(baseUrl, '/sw.js'),
      request(baseUrl, '/src/assets/images/homepage/homepage-students-classroom.jpg'),
      request(baseUrl, '/main.js'),
    ]);
    expect(rootIndex.status).toBe(200);
    expect(rootIndex.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    expect(mainJs.status).toBe(200);
    expect(mainJs.headers['content-type']).toMatch(/javascript/i);
    expect(mainJs.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    expect(legacyMainJs.status).toBe(200);
    expect(legacyMainJs.headers['content-type']).toMatch(/javascript/i);

    expect(swJs.status).toBe(200);
    expect(swJs.headers['content-type']).toMatch(/javascript/i);
    expect(swJs.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    expect(heroImage.status).toBe(200);
    expect(heroImage.headers['content-type']).toMatch(/image\//i);

    expect(missingAsset.status).toBe(404);
  });

  test('redirects direct admin routes to root hash routes', async () => {
    const [adminLogin, adminDashboard] = await Promise.all([
      request(baseUrl, '/admin/login', { redirect: 'manual' }),
      request(baseUrl, '/admin/schools', { redirect: 'manual' }),
    ]);

    expect(adminLogin.status).toBe(302);
    expect(adminLogin.headers.location).toBe('/#/platform-admin');
    expect(adminDashboard.status).toBe(302);
    expect(adminDashboard.headers.location).toBe('/#/admin/schools');
  });

  test('production request logs include safe metadata but redact query and credential values', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';

    try {
      const response = await fetch(`${baseUrl}/api/v1/health?access_token=query-token-marker&password=query-password-marker`, {
        headers: {
          Authorization: 'Bearer authorization-header-marker',
          Cookie: 'session=cookie-secret-marker',
        },
      });
      await response.body?.cancel();

      expect(response.status).toBe(200);
      expect(log).toHaveBeenCalledTimes(1);
      const entry = log.mock.calls[0][0];
      expect(entry).toContain('GET /api/v1/health 200');
      expect(entry).toMatch(/\d+\.\dms$/);
      expect(entry).not.toContain('query-token-marker');
      expect(entry).not.toContain('query-password-marker');
      expect(entry).not.toContain('authorization-header-marker');
      expect(entry).not.toContain('cookie-secret-marker');
    } finally {
      log.mockRestore();
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
