// auth.config.js
// Centralized configuration for authentication-related settings.
// Keep secrets in environment variables; this file provides defaults for development.

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
