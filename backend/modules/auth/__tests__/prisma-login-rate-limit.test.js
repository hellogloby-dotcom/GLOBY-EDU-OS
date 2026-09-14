const express = require('express');

jest.mock('../auth.service', () => ({
  login: jest.fn(async (schoolId, username, password) => {
    if (password !== 'ValidPassword!1') {
      throw new Error('Invalid credentials');
    }
    return {
      accessToken: `access-${schoolId}-${username}`,
      refreshToken: `refresh-${schoolId}-${username}`,
      user: { id: `${schoolId}:${username}`, email: username, roles: ['school_authority'] },
    };
  }),
}));

const authRouter = require('../auth.controller');

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  return app.listen(0);
}

async function postLogin(port, body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

describe('Prisma login rate limiting', () => {
  let server;

  beforeAll(() => {
    server = createTestServer();
  });

  afterAll(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  test('valid Prisma login succeeds', async () => {
    const result = await postLogin(server.address().port, {
      schoolId: 'prisma-valid-school',
      username: 'authority@prisma.test',
      password: 'ValidPassword!1',
    });

    expect(result.response.status).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.user.roles).toContain('school_authority');
  });

  test('repeated failed Prisma logins are eventually rate limited', async () => {
    const credentials = {
      schoolId: 'prisma-brute-force-school',
      username: 'attacker@prisma.test',
      password: 'WrongPassword!1',
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await postLogin(server.address().port, credentials);
      expect(result.response.status).toBe(401);
    }

    const blocked = await postLogin(server.address().port, credentials);
    expect(blocked.response.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many failed/i);
  });

  test('a successful Prisma login clears earlier failures for that key', async () => {
    const credentials = {
      schoolId: 'prisma-recovery-school',
      username: 'authority@recovery.test',
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await postLogin(server.address().port, { ...credentials, password: 'WrongPassword!1' });
      expect(failed.response.status).toBe(401);
    }

    const success = await postLogin(server.address().port, { ...credentials, password: 'ValidPassword!1' });
    expect(success.response.status).toBe(200);

    const laterFailure = await postLogin(server.address().port, { ...credentials, password: 'WrongPassword!1' });
    expect(laterFailure.response.status).toBe(401);
  });

  test('rate-limit keys remain isolated by tenant and username', async () => {
    const first = { schoolId: 'prisma-isolation-a', username: 'same@prisma.test', password: 'WrongPassword!1' };
    const second = { schoolId: 'prisma-isolation-b', username: 'same@prisma.test', password: 'ValidPassword!1' };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await postLogin(server.address().port, first);
    }

    const allowed = await postLogin(server.address().port, second);
    expect(allowed.response.status).toBe(200);
  });
});
