// role.middleware.js
// Guard that checks whether the current user has at least one of the allowed roles.

function roleGuard(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.user;
    const normalizedRoles = Array.isArray(user?.roles)
      ? user.roles
      : typeof user?.roles === 'string'
        ? [user.roles]
        : [];

    if (!user || normalizedRoles.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const has = normalizedRoles.some((r) => allowedRoles.includes(String(r).trim().toLowerCase()));
    if (!has) {
      return res.status(403).json({ status: 'error', message: 'Insufficient role.' });
    }
    return next();
  };
}

module.exports = { roleGuard };
