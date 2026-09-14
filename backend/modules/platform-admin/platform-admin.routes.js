const express = require('express');
const router = express.Router();
const authMiddleware = require('../auth/middleware/auth.middleware');
const { roleGuard } = require('../auth/middleware/role.middleware');
const platformAdminService = require('./platform-admin.service');
const { recordAuditEvent } = require('../audit/audit.service');

async function auditPlatformAdminAction(req, action, resourceId, success = true) {
  await recordAuditEvent({
    req,
    actorId: req.user?.userId,
    actorRole: req.user?.roles?.[0],
    action,
    resourceType: 'platform_admin',
    resourceId,
    success,
  });
}

function platformAdminGuard(req, res, next) {
  const user = req.user;
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : typeof user?.roles === 'string'
      ? [user.roles]
      : [];
  const hasSuperAdminRole = roles.some((role) => String(role).trim().toLowerCase() === 'super_admin');

  if (!user || !hasSuperAdminRole || user.platformAdmin !== true) {
    return res.status(403).json({ status: 'error', message: 'Platform administrator access required.' });
  }
  return next();
}

// Only active platform super admins may manage other platform administrators.
router.use(authMiddleware, roleGuard(['super_admin']), platformAdminGuard);

router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const admins = await platformAdminService.listPlatformAdmins(search);
    return res.json({ status: 'ok', platformAdmins: admins });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const admin = await platformAdminService.createPlatformAdmin(payload);
    await auditPlatformAdminAction(req, 'platform_admin.created', admin.username || admin.email);
    return res.status(201).json({ status: 'ok', platformAdmin: admin });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.put('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const updates = req.body || {};
    const admin = await platformAdminService.updatePlatformAdmin(email, updates);
    await auditPlatformAdminAction(req, 'platform_admin.updated', email);
    return res.json({ status: 'ok', platformAdmin: admin });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.delete('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const admin = await platformAdminService.removePlatformAdmin(email);
    await auditPlatformAdminAction(req, 'platform_admin.deleted', email);
    return res.json({ status: 'ok', platformAdmin: admin });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/:email/reset-password', async (req, res) => {
  try {
    const email = req.params.email;
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ status: 'error', message: 'Password is required.' });
    }
    const admin = await platformAdminService.resetPlatformAdminPassword(email, password);
    await auditPlatformAdminAction(req, 'platform_admin.password_reset', email);
    return res.json({ status: 'ok', platformAdmin: admin });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
