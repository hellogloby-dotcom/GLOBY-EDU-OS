const crypto = require('crypto');

describe('production JWT configuration', () => {
  const keys = ['NODE_ENV', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
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

  function setValidSecrets() {
    process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
  }

  test('fails when the production access secret is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');

    expect(() => require('../auth.config')).toThrow(/JWT_ACCESS_SECRET is required in production/);
  });

  test('fails when the production refresh secret is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');

    expect(() => require('../auth.config')).toThrow(/JWT_REFRESH_SECRET is required in production/);
  });

  test.each([
    ['JWT_ACCESS_SECRET', 'dev_access_secret_replace_me'],
    ['JWT_REFRESH_SECRET', 'demo-refresh-password'],
  ])('rejects a development/default/demo value for %s', (key, value) => {
    process.env.NODE_ENV = 'production';
    setValidSecrets();
    process.env[key] = value;

    expect(() => require('../auth.config')).toThrow(new RegExp(`${key} must not use`));
  });

  test('fails when production access and refresh secrets are identical', () => {
    process.env.NODE_ENV = 'production';
    const secret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_ACCESS_SECRET = secret;
    process.env.JWT_REFRESH_SECRET = secret;

    expect(() => require('../auth.config')).toThrow(/must be distinct in production/);
  });

  test('accepts valid distinct production secrets', () => {
    process.env.NODE_ENV = 'production';
    setValidSecrets();

    const config = require('../auth.config');

    expect(config.jwt.accessTokenSecret).toBe(process.env.JWT_ACCESS_SECRET);
    expect(config.jwt.refreshTokenSecret).toBe(process.env.JWT_REFRESH_SECRET);
    expect(config.jwt.accessTokenExpiresIn).toBe('15m');
    expect(config.jwt.refreshTokenExpiresIn).toBe('30d');
  });

  test('preserves the existing development and test defaults', () => {
    process.env.NODE_ENV = 'development';
    const developmentConfig = require('../auth.config');
    expect(developmentConfig.jwt.accessTokenSecret).toBe('dev_access_secret_replace_me');
    expect(developmentConfig.jwt.refreshTokenSecret).toBe('dev_refresh_secret_replace_me');

    jest.resetModules();
    process.env.NODE_ENV = 'test';
    const testConfig = require('../auth.config');
    expect(testConfig.jwt.accessTokenSecret).toBe('dev_access_secret_replace_me');
    expect(testConfig.jwt.refreshTokenSecret).toBe('dev_refresh_secret_replace_me');
    expect(testConfig.bcrypt.saltRounds).toBe(4);
  });
});