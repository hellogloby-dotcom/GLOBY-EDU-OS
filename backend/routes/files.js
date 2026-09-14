const express = require('express');
const authMiddleware = require('../modules/auth/middleware/auth.middleware');
const {
  uploadSchoolFile,
  createSchoolFileSignedUrl,
} = require('../lib/supabaseClient');

const router = express.Router();
const MAX_SIGNED_URL_SECONDS = 60 * 60;

function getTenantFolder(req) {
  const tenantId = req.user?.tenantId || req.user?.schoolId;
  if (!tenantId) return null;

  const folder = String(tenantId).trim();
  return /^[A-Za-z0-9_-]+$/.test(folder) ? folder : null;
}

function normalizeRelativePath(value) {
  const filePath = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!filePath || filePath.includes('\0') || filePath.split('/').some((segment) => !segment || segment === '..')) {
    return null;
  }
  return filePath;
}

function getScopedFilePath(req, requestedPath) {
  const tenantFolder = getTenantFolder(req);
  const relativePath = normalizeRelativePath(requestedPath);
  if (!tenantFolder || !relativePath) return null;
  return `${tenantFolder}/${relativePath}`;
}

router.post('/upload', authMiddleware, express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  try {
    const filename = normalizeRelativePath(req.query.filename);
    const scopedPath = getScopedFilePath(req, filename);
    if (!scopedPath || !req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ status: 'error', message: 'A non-empty file body and valid filename are required.' });
    }

    await uploadSchoolFile(scopedPath, req.body, {
      contentType: req.get('content-type') || 'application/octet-stream',
      upsert: false,
    });

    return res.status(201).json({
      status: 'ok',
      path: filename,
      tenantId: req.user.tenantId || req.user.schoolId,
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/*', authMiddleware, async (req, res) => {
  try {
    const scopedPath = getScopedFilePath(req, req.params[0]);
    if (!scopedPath) {
      return res.status(400).json({ status: 'error', message: 'A valid file path is required.' });
    }

    const expiresIn = Math.min(
      Math.max(Number(req.query.expiresIn) || MAX_SIGNED_URL_SECONDS, 1),
      MAX_SIGNED_URL_SECONDS
    );
    const signedUrl = await createSchoolFileSignedUrl(scopedPath, expiresIn);
    return res.json({ status: 'ok', url: signedUrl, expiresIn });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
