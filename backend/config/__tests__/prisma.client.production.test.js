describe('production datastore selection', () => {
  const originalEnvironment = {};
  const environmentKeys = ['NODE_ENV', 'DATABASE_URL', 'DATA_STORE_MODE', 'FIREBASE_PROJECT_ID', 'USE_REAL_DATABASE', 'RENDER_SERVICE_ID'];

  beforeEach(() => {
    environmentKeys.forEach((key) => {
      originalEnvironment[key] = process.env[key];
      delete process.env[key];
    });
    jest.resetModules();
  });

  afterEach(() => {
    environmentKeys.forEach((key) => {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    });
    jest.resetModules();
  });

  test('fails closed in production unless Firebase is explicitly selected', () => {
    process.env.NODE_ENV = 'production';

    expect(() => require('../prisma.client')).toThrow(/Production requires DATA_STORE_MODE=firebase/);
  });

  test('does not select SQL as the production datastore when DATABASE_URL is present', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://unused';

    expect(() => require('../prisma.client')).toThrow(/Production requires DATA_STORE_MODE=firebase/);
  });

  test('fails closed on Render when NODE_ENV is missing', () => {
    process.env.RENDER_SERVICE_ID = 'render-service';

    expect(() => require('../prisma.client')).toThrow(/Production requires DATA_STORE_MODE=firebase/);
  });

  test('fails closed on Render when DATA_STORE_MODE is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER_SERVICE_ID = 'render-service';

    expect(() => require('../prisma.client')).toThrow(/Production requires DATA_STORE_MODE=firebase/);
  });

  test('selects Firebase directly without creating a JSON stub', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATA_STORE_MODE = 'firebase';

    expect(require('../prisma.client')).toBeNull();
  });

  test('keeps explicit local JSON selection outside production on the existing stub path', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATA_STORE_MODE = 'json';

    expect(require('../prisma.client').__stub).toBe(true);
  });
});