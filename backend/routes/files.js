const express = require('express');
const authMiddleware = require('../modules/auth/middleware/auth.middleware');
const firebaseData = require('../firebase.data');
const {
  uploadSchoolFile,
  createSchoolFileSignedUrl,
  isR2Configured,
  getSchoolFilePublicUrl,
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

    if (firebaseData.isFirebaseDataConfigured()) {
      const file = firebaseData.getStorageBucket().file(`tenants/${scopedPath}`);
      await file.save(req.body, { contentType: req.get('content-type') || 'application/octet-stream', resumable: false, validation: 'md5' });
    } else {
      if (process.env.NODE_ENV === 'production' && isR2Configured() && !getSchoolFilePublicUrl(scopedPath)) {
        return res.status(503).json({ status: 'error', message: 'Configure CLOUDFLARE_R2_PUBLIC_URL so uploaded school images remain available after signed URLs expire.' });
      }
      if (process.env.NODE_ENV === 'production' && !isR2Configured()) {
        return res.status(503).json({ status: 'error', message: 'Storage is not configured for production. Configure Firebase Storage or Cloudflare R2.' });
      }
      await uploadSchoolFile(scopedPath, req.body, {
        contentType: req.get('content-type') || 'application/octet-stream',
        upsert: false,
      });
    }

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
    if (process.env.NODE_ENV === 'production' && !firebaseData.isFirebaseDataConfigured() && !isR2Configured()) {
      return res.status(503).json({ status: 'error', message: 'Storage is not configured for production. Configure Firebase Storage or Cloudflare R2.' });
    }
    const publicUrl = !firebaseData.isFirebaseDataConfigured() ? getSchoolFilePublicUrl(scopedPath) : null;
    const signedUrl = publicUrl || (firebaseData.isFirebaseDataConfigured()
      ? (await firebaseData.getStorageBucket().file(`tenants/${scopedPath}`).getSignedUrl({ action: 'read', expires: Date.now() + expiresIn * 1000 }))[0]
      : await createSchoolFileSignedUrl(scopedPath, expiresIn));
    return res.json({ status: 'ok', url: signedUrl, expiresIn: publicUrl ? null : expiresIn, persistent: Boolean(publicUrl) });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
