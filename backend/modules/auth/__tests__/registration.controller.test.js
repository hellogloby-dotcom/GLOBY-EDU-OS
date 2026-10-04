const express = require('express');

jest.mock('../../school/school.service', () => ({ createSchool: jest.fn() }));
jest.mock('../auth.service', () => ({ login: jest.fn() }));
jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: jest.fn(),
  createUser: jest.fn(),
  generateEmailVerificationLink: jest.fn(),
}));
jest.mock('../../../firebase.data', () => ({ isFirebaseDataConfigured: jest.fn() }));
jest.mock('../../../config/app-url.config', () => ({ getAppUrl: jest.fn() }));
jest.mock('../utils/email', () => ({ sendEmail: jest.fn(), verificationTemplate: jest.fn(), resetTemplate: jest.fn() }));

const schoolService = require('../../school/school.service');
const authService = require('../auth.service');
const firebaseAdmin = require('../../../firebase.admin');
const firebaseData = require('../../../firebase.data');
const { getAppUrl } = require('../../../config/app-url.config');
const { sendEmail } = require('../utils/email');
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
    firebaseData.isFirebaseDataConfigured.mockReturnValue(false);
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(false);
    firebaseAdmin.createUser.mockResolvedValue({ uid: 'firebase-user-test' });
    firebaseAdmin.generateEmailVerificationLink.mockResolvedValue('https://auth.example.test/verify');
    getAppUrl.mockReturnValue('https://app.example.test');
    sendEmail.mockResolvedValue({ ok: true });
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

  test('missing APP_URL prevents Firebase registration before creating the school', async () => {
    const email = `app-url-${Date.now()}@example.test`;
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(true);
    getAppUrl.mockImplementation(() => {
      throw new Error('APP_URL is required in production.');
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(503);
    expect(result.body.code).toBe('REGISTRATION_VERIFICATION_SETUP_FAILED');
    expect(schoolService.createSchool).not.toHaveBeenCalled();
    expect(firebaseAdmin.createUser).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[auth.register] School signup failed', {
      phase: 'firebase.configuration',
      errorName: 'Error',
    });
  });

  test('Firebase signup returns pending verification without issuing a session', async () => {
    const email = `verified-${Date.now()}@example.test`;
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(true);
    schoolService.createSchool.mockResolvedValue({
      schoolId: 'GLB-2026-VERIFICATION',
      trialEndsAt: new Date('2026-10-08T00:00:00.000Z'),
      headAccount: { username: email, password: 'ValidPassword!1' },
    });

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(202);
    expect(result.body).toMatchObject({
      status: 'pending_verification',
      requiresEmailVerification: true,
      schoolId: 'GLB-2026-VERIFICATION',
      tenantId: 'GLB-2026-VERIFICATION',
      verificationEmail: email,
    });
    expect(result.body.accessToken).toBeUndefined();
    expect(result.body.user).toBeUndefined();
    expect(firebaseAdmin.createUser).toHaveBeenCalledWith({
      email,
      password: 'ValidPassword!1',
      displayName: 'Test Authority',
    });
    expect(sendEmail).toHaveBeenCalled();
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('Firebase Auth creation failure cannot report registration success', async () => {
    const email = `auth-failed-${Date.now()}@example.test`;
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(true);
    schoolService.createSchool.mockResolvedValue({ schoolId: 'GLB-2026-PARTIAL' });
    firebaseAdmin.createUser.mockRejectedValue(Object.assign(new Error('private auth detail'), { code: 'auth/internal-error' }));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(503);
    expect(result.body).toMatchObject({ status: 'error', code: 'REGISTRATION_VERIFICATION_SETUP_FAILED' });
    expect(result.body.message).toMatch(/workspace was created.*contact support before retrying/i);
    expect(result.body.accessToken).toBeUndefined();
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('verification email delivery failure cannot report registration success', async () => {
    const email = `mail-failed-${Date.now()}@example.test`;
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
    firebaseAdmin.isFirebaseConfigured.mockReturnValue(true);
    schoolService.createSchool.mockResolvedValue({ schoolId: 'GLB-2026-MAIL-PARTIAL' });
    sendEmail.mockResolvedValue({ ok: false, reason: 'BREVO_NOT_CONFIGURED' });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(503);
    expect(result.body.code).toBe('REGISTRATION_VERIFICATION_SETUP_FAILED');
    expect(result.body.accessToken).toBeUndefined();
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('fallback signup reports success only after creating a real session', async () => {
    const email = `fallback-${Date.now()}@example.test`;
    schoolService.createSchool.mockResolvedValue({
      schoolId: 'GLB-2026-FALLBACK',
      trialEndsAt: new Date('2026-10-08T00:00:00.000Z'),
      headAccount: { username: email, password: 'ValidPassword!1' },
    });
    authService.login.mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: { id: 'fallback-user', email, roles: ['school_head'] },
    });

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ status: 'ok', schoolId: 'GLB-2026-FALLBACK', tenantId: 'GLB-2026-FALLBACK' });
    expect(result.body.accessToken).toBe('test-access-token');
    expect(result.body.user.role).toBe('school_head');
  });

  test('keeps the public error generic while logging only safe failure metadata', async () => {
    const email = `firestore-${Date.now()}@example.test`;
    const failure = Object.assign(new Error('private diagnostic detail must not be logged'), {
      code: 'permission-denied',
      registrationOperation: 'tenant.write',
    });
    schoolService.createSchool.mockRejectedValue(failure);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await postRegistration(createRegistrationPayload(email));

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ status: 'error', message: 'We could not create your school account right now. Please try again.' });
    expect(error).toHaveBeenCalledWith('[auth.register] School signup failed', {
      phase: 'school.create',
      operation: 'tenant.write',
      errorName: 'Error',
      errorCode: 'permission-denied',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('private diagnostic detail');
  });

  test('returns a conflict instead of a generic server error for an existing school registration', async () => {
    schoolService.createSchool.mockRejectedValue(Object.assign(
      new Error('Existing registration'),
      { code: 'SCHOOL_REGISTRATION_EXISTS', registrationOperation: 'owner.lookup' },
    ));

    const result = await postRegistration(createRegistrationPayload(`existing-${Date.now()}@example.test`));

    expect(result.response.status).toBe(409);
    expect(result.body).toEqual({
      status: 'error',
      message: 'A school registration for this authority email already exists. Please contact support before retrying.',
    });
  });
});