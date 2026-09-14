const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 8;
const loginFailures = new Map();

function getLoginAttemptKey({ schoolId, username, platformAdminMode }) {
  return `${platformAdminMode ? 'platform' : String(schoolId || '').trim().toLowerCase()}:${String(username || '').trim().toLowerCase()}`;
}

function isLoginRateLimited(key) {
  const attempt = loginFailures.get(key);
  if (!attempt) return false;
  if (attempt.expiresAt <= Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return attempt.count >= LOGIN_FAILURE_LIMIT;
}

function recordLoginFailure(key) {
  const now = Date.now();
  const attempt = loginFailures.get(key);
  if (!attempt || attempt.expiresAt <= now) {
    loginFailures.set(key, { count: 1, expiresAt: now + LOGIN_FAILURE_WINDOW_MS });
    return;
  }
  attempt.count += 1;
}

function clearLoginFailures(key) {
  loginFailures.delete(key);
}

module.exports = {
  getLoginAttemptKey,
  isLoginRateLimited,
  recordLoginFailure,
  clearLoginFailures,
};