describe('production APP_URL configuration', () => {
  const keys = ['NODE_ENV', 'APP_URL', 'RENDER_SERVICE_ID'];
  let original;

  beforeEach(() => {
    original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    keys.forEach((key) => delete process.env[key]);
    jest.resetModules();
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
    jest.resetModules();
  });

  const { getAppUrl } = require('../app-url.config');

  test('fails in production when APP_URL is missing', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getAppUrl({ NODE_ENV: 'production' })).toThrow(/APP_URL is required in production/i);
  });

  test('fails in production when APP_URL is localhost', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getAppUrl({ NODE_ENV: 'production', APP_URL: 'https://localhost:4000' })).toThrow(/APP_URL.*localhost/i);
    expect(() => getAppUrl({ NODE_ENV: 'production', APP_URL: 'http://127.0.0.1:4000' })).toThrow(/localhost|127\.0\.0\.1/i);
  });

  test('fails in production when APP_URL is non-HTTPS', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getAppUrl({ NODE_ENV: 'production', APP_URL: 'http://app.example.com' })).toThrow(/HTTPS/i);
  });

  test('accepts a valid HTTPS APP_URL in production', () => {
    process.env.NODE_ENV = 'production';

    expect(getAppUrl({ NODE_ENV: 'production', APP_URL: 'https://app.example.com' })).toBe('https://app.example.com');
  });

  test('preserves the existing development localhost fallback behavior', () => {
    process.env.NODE_ENV = 'development';

    expect(getAppUrl({ NODE_ENV: 'development' })).toBe('http://localhost:4000');
    expect(getAppUrl({ NODE_ENV: 'development', APP_URL: 'http://localhost:4000' })).toBe('http://localhost:4000');
  });
});
