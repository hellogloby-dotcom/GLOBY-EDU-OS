// auth.config.js
// Centralized configuration for authentication-related settings.
// Keep secrets in environment variables; this file provides defaults for development.

const DEVELOPMENT_JWT_SECRETS = new Set([
  'dev_access_secret_replace_me',
  'dev_refresh_secret_replace_me',
]);
const UNSAFE_JWT_SECRET_PATTERN = /(?:^|[^a-z0-9])(?:dev(?:elopment)?|test|demo|default|sample|example|placeholder|replace(?:[_ -]?me)?|change[_ -]?me|password|secret)(?:$|[^a-z0-9])/i;

function assertProductionJwtConfiguration(env = process.env) {
  const accessSecret = String(env.JWT_ACCESS_SECRET || '').trim();
  const refreshSecret = String(env.JWT_REFRESH_SECRET || '').trim();

  if (!accessSecret) {
    throw new Error('[auth.config] JWT_ACCESS_SECRET is required in production.');
  }
  if (!refreshSecret) {
    throw new Error('[auth.config] JWT_REFRESH_SECRET is required in production.');
  }
  if (DEVELOPMENT_JWT_SECRETS.has(accessSecret.toLowerCase()) || UNSAFE_JWT_SECRET_PATTERN.test(accessSecret)) {
    throw new Error('[auth.config] JWT_ACCESS_SECRET must not use a development, default, demo, or placeholder value.');
  }
  if (DEVELOPMENT_JWT_SECRETS.has(refreshSecret.toLowerCase()) || UNSAFE_JWT_SECRET_PATTERN.test(refreshSecret)) {
    throw new Error('[auth.config] JWT_REFRESH_SECRET must not use a development, default, demo, or placeholder value.');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('[auth.config] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct in production.');
  }
}

if (process.env.NODE_ENV === 'production') {
  assertProductionJwtConfiguration();
}

module.exports = {
  jwt: {
    // In production, prefer RS256 keys and store them securely (KMS, vault).
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_replace_me',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_replace_me',
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || (process.env.NODE_ENV === 'test' ? '4' : '12'), 10),
  },
  tokens: {
    // Email token TTL in minutes
    emailTokenMinutes: parseInt(process.env.EMAIL_TOKEN_MINUTES || '60', 10),
  },
};
