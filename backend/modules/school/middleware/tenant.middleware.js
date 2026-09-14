// tenant.middleware.js
// Enforce tenant isolation: ensure the authenticated user belongs to the requested school
// or is a super_admin. Attach tenant context to the request.

const { roleGuard } = require('../../auth/middleware/role.middleware');
const prisma = require('../../../config/prisma.client');
const schoolService = require('../school.service');
const {
  loadSchoolData,
} = require('../fallback.school');

async function tenantMiddleware(req, res, next) {
  try {
    const user = req.user;
    const requestedSchoolId = req.params.schoolId || req.body.schoolId;

    if (!user) return res.status(401).json({ status: 'error', message: 'Authentication required' });

    if (user.passwordNeedsReset === true && req.path !== '/change-password') {
      return res.status(403).json({ status: 'error', code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your temporary password before continuing.' });
    }

    const roles = Array.isArray(user?.roles)
      ? user.roles
      : typeof user?.roles === 'string'
        ? [user.roles]
        : [];

    // Super admin bypass
    if (roles.some((role) => String(role).trim().toLowerCase() === 'super_admin')) return next();

    if (!requestedSchoolId) {
      return res.status(400).json({ status: 'error', message: 'School ID is required' });
    }

    if (prisma && prisma.__stub) {
      const schools = loadSchoolData();
      const school = schools.find((entry) => entry.schoolId === requestedSchoolId);
      if (!school) return res.status(404).json({ status: 'error', message: 'School not found' });
      if (schoolIdMismatch(user, requestedSchoolId)) {
        return res.status(403).json({ status: 'error', message: 'Tenant mismatch' });
      }
      const resolved = schoolService.resolveSchoolLifecycleStatus(school);
      if (resolved.schoolStatus !== 'active') {
        return res.status(403).json({ status: 'error', message: 'This school is suspended or its trial has expired.' });
      }
      req.tenant = resolved;
      return next();
    }

    // Ensure the user's tenant matches requested school
    const tenant = await prisma.tenant.findUnique({ where: { schoolId: requestedSchoolId } }).catch(() => null);
    if (!tenant) return res.status(404).json({ status: 'error', message: 'School not found' });

    if (tenant.id !== user.tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant mismatch' });
    }

    const resolvedTenant = schoolService.resolveSchoolLifecycleStatus(tenant);
    if (resolvedTenant.schoolStatus !== 'active') {
      return res.status(403).json({ status: 'error', message: 'This school is suspended or its trial has expired.' });
    }

    // Attach tenant info for downstream handlers
    req.tenant = resolvedTenant;
    return next();
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Tenant check failed' });
  }
}

function schoolIdMismatch(user, requestedSchoolId) {
  return !user.tenantId || user.tenantId !== requestedSchoolId;
}

module.exports = tenantMiddleware;
