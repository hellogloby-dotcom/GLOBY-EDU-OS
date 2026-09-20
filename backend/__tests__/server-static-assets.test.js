const http = require('http');
const { app } = require('../server');

function request(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `${baseUrl}${pathname}`,
      {
        agent: false,
        headers: {
          Connection: 'close',
        },
      },
      (res) => {
        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            if (res.socket && !res.socket.destroyed) {
              res.socket.destroy();
            }
          } catch (error) {
            // no-op; the test is complete once the response is drained
          }

          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );

    req.on('error', reject);
  });
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
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  test('serves production JS and service worker assets without stale-cache headers', async () => {
    const rootIndex = await request(baseUrl, '/');
    expect(rootIndex.status).toBe(200);
    expect(rootIndex.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    const mainJs = await request(baseUrl, '/src/main.js');
    expect(mainJs.status).toBe(200);
    expect(mainJs.headers['content-type']).toMatch(/javascript/i);
    expect(mainJs.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    const legacyMainJs = await request(baseUrl, '/marketing/src/main.js');
    expect(legacyMainJs.status).toBe(200);
    expect(legacyMainJs.headers['content-type']).toMatch(/javascript/i);

    const swJs = await request(baseUrl, '/sw.js');
    expect(swJs.status).toBe(200);
    expect(swJs.headers['content-type']).toMatch(/javascript/i);
    expect(swJs.headers['cache-control']).toMatch(/no-store|must-revalidate/i);

    const missingAsset = await request(baseUrl, '/main.js');
    expect(missingAsset.status).toBe(404);
  });
});
