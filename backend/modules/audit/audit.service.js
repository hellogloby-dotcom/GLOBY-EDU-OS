const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../../config/prisma.client');

const AUDIT_FILE = path.join(__dirname, '../../data/audit-logs.json');
const SENSITIVE_KEY = /password|hash|token|secret|api[_-]?key|oauth|credential|private/i;
const SENSITIVE_VALUE = /^\$2[aby]\$|^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function sanitizeValue(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeValue(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  if (typeof value === 'string' && (SENSITIVE_KEY.test(value) || SENSITIVE_VALUE.test(value))) return '[REDACTED]';
  return value;
}

function safeMetadata(metadata = {}) {
  const sanitized = sanitizeValue(metadata);
  return sanitized && typeof sanitized === 'object' ? sanitized : {};
}

function getRequestContext(req) {
  return {
    ipAddress: req?.ip || req?.socket?.remoteAddress || null,
    userAgent: req?.get?.('user-agent') || null,
  };
}

function loadFallbackLogs() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    return Array.isArray(parsed.logs) ? parsed.logs : [];
  } catch (error) {
    return [];
  }
}

function saveFallbackLogs(logs) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify({ logs: logs.slice(-2000) }, null, 2), 'utf8');
}

async function recordAuditEvent(event = {}) {
  const metadata = safeMetadata({ ...(event.metadata || {}), ...getRequestContext(event.req) });
  const record = {
    id: event.id || crypto.randomUUID(),
    actorId: event.actorId || null,
    actorRole: event.actorRole || null,
    tenantId: event.tenantId || null,
    action: String(event.action || 'unknown'),
    resourceType: event.resourceType || event.resource || null,
    resourceId: event.resourceId || null,
    success: event.success !== false,
    metadata,
    createdAt: new Date().toISOString(),
  };

  try {
    if (prisma && !prisma.__stub && prisma.auditLog?.create) {
      await prisma.auditLog.create({
        data: {
          id: record.id,
          actorId: record.actorId,
          actorRole: record.actorRole,
          tenantId: record.tenantId,
          action: record.action,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          success: record.success,
          metadata: record.metadata,
        },
      });
    } else {
      saveFallbackLogs([...loadFallbackLogs(), record]);
    }
  } catch (error) {
    // Audit persistence must not take down the business request.
  }
  return record;
}

async function listAuditEvents({ tenantId, isSuperAdmin = false, limit = 100 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (prisma && !prisma.__stub && prisma.auditLog?.findMany) {
    return prisma.auditLog.findMany({
      where: isSuperAdmin || !tenantId ? (isSuperAdmin ? {} : { tenantId }) : { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
  return loadFallbackLogs()
    .filter((entry) => isSuperAdmin || entry.tenantId === tenantId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, take);
}

module.exports = { recordAuditEvent, listAuditEvents, safeMetadata };