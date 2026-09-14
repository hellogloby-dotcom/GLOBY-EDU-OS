jest.mock('firebase-admin', () => {
  const mockInitializeApp = jest.fn();
  const mockApplicationDefault = jest.fn(() => ({ type: 'application-default' }));

  return {
    apps: [],
    initializeApp: mockInitializeApp,
    credential: {
      applicationDefault: mockApplicationDefault,
    },
    __mockInitializeApp: mockInitializeApp,
    __mockApplicationDefault: mockApplicationDefault,
  };
});

describe('firebase admin ADC configuration', () => {
  beforeEach(() => {
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.FIREBASE_PROJECT_ID = 'demo-project';
    jest.clearAllMocks();
  });

  test('uses Application Default Credentials when service account env vars are absent', () => {
    const firebaseAdmin = require('../firebase.admin');
    const adminLib = require('firebase-admin');

    const app = firebaseAdmin.getFirebaseAdmin();

    expect(app).toBeTruthy();
    expect(adminLib.__mockApplicationDefault).toHaveBeenCalledTimes(1);
    expect(adminLib.__mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'demo-project',
        credential: { type: 'application-default' },
      })
    );
  });
});
