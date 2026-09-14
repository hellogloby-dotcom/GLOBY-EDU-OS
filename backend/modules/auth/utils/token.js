// token.js
// Helper functions for creating/verifying JWTs and hashing token strings for storage.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../../config/auth.config');

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessTokenSecret, {
    expiresIn: config.jwt.accessTokenExpiresIn,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshTokenSecret, {
    expiresIn: config.jwt.refreshTokenExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessTokenSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshTokenSecret);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
