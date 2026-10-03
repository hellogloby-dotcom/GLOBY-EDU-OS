const express = require('express');

jest.mock('../../school/school.service', () => ({ createSchool: jest.fn() }));
jest.mock('../auth.service', () => ({ login: jest.fn() }));
jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: jest.fn(),
  createUser: jest.fn(),
  generateEmailVerificationLink: jest.fn(),
}));
jest.mock('../../../config/app-url.config', () => ({ getAppUrl: jest.fn() }));
jest.mock('../utils/email', () => ({ sendEmail: jest.fn(), verificationTemplate: jest.fn() }));

const schoolService = require('../../school/school.service');
const authService = require('../auth.service');
const firebaseAdmin = require('../../../firebase.admin');
const { getAppUrl } = require('../../../config/app-url.config');
const authRouter = require('../auth.controller');

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  return app.listen(0);
}

function createRegistrationPayload(email) {
  return {
    schoolName: `Registration Diagnostics ${Date.now()}`,
    country: 'Ghana',
    phone: '+233200000001',
    head: {
      fullName: 'Test Authority',
      email,
      phone: '+233200000002',
      password: 'ValidPassword!1',
      confirmPassword: 'ValidPassword!1',
    },
    agreements: { terms: true, privacy: true },
  };
}

describe('public registration controller diagnostics', () => {
  let server;

  beforeAll(() => {
    server = createTestServer();
  });

  afterAll(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function postRegistration(payload) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { response, body: await response.json() };
  }

  test('missing APP_URL in the optional email hook does not turn a created school into a failed signup', async () => {
    const email = `app-url-${Date.now()}@example.test`;
    schoolService.createSchool.mockResolvedValue({
      schoolId: 'GLB-2026-DIAGNOSTIC',
      trialEndsAt: new Date('2026-10-08T00:00:00.000Z'),
      headAccount: { username: email, password: 'ValidPassword!1' },
    });
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(true);
    getAppUrl.mockImplementation(() => {
      throw new Error('APP_URL is required in production.');
    });
    authService.login.mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: { id: 'GLB-2026-DIAGNOSTIC:user', email, roles: ['school_authority'] },
    });
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ status: 'ok', schoolId: 'GLB-2026-DIAGNOSTIC', tenantId: 'GLB-2026-DIAGNOSTIC' });
    expect(firebaseAdmin.createUser).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('[auth.register] Optional Firebase Auth hook failed', {
      phase: 'firebase.auth-hook',
      errorName: 'Error',
    });
    expect(error).not.toHaveBeenCalled();
  });

  test('keeps the public error generic while logging only safe failure metadata', async () => {
    const email = `firestore-${Date.now()}@example.test`;
    const failure = Object.assign(new Error('private diagnostic detail must not be logged'), { code: 'permission-denied' });
    schoolService.createSchool.mockRejectedValue(failure);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ status: 'error', message: 'We could not create your school account right now. Please try again.' });
    expect(error).toHaveBeenCalledWith('[auth.register] School signup failed', {
      phase: 'school.create',
      errorName: 'Error',
      errorCode: 'permission-denied',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('private diagnostic detail');
  });
});