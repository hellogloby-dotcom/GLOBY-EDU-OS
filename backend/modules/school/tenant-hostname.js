const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'help',
  'support',
  'login',
  'mail',
  'platform',
  'school',
  'globyedu',
  'localhost',
]);

function normalizeSchoolSubdomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'school';
}

function generateSchoolSubdomain(name, existingSchools = []) {
  const base = normalizeSchoolSubdomain(name || 'school');
  const reserved = RESERVED_SUBDOMAINS.has(base) || base === 'globyedu';
  let candidate = reserved ? `school-${base}` : base;
  const seen = new Set((Array.isArray(existingSchools) ? existingSchools : []).map((entry) => normalizeSchoolSubdomain(entry?.subdomain || entry?.schoolSlug || entry?.slug)).filter(Boolean));

  if (reserved) {
    seen.add(base);
  }

  let suffix = 1;
  while (seen.has(candidate) || RESERVED_SUBDOMAINS.has(candidate) || candidate === 'globyedu') {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function resolveTenantFromHostname(hostname, schools = []) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return null;

  const withoutPort = host.replace(/:\d+$/, '');
  if (!withoutPort || withoutPort === 'localhost' || withoutPort === '127.0.0.1') return null;

  const parts = withoutPort.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const isLocalhost = parts[parts.length - 1] === 'localhost';
  const isGlobyDomain = parts[parts.length - 2] === 'globyedu' && parts[parts.length - 1] === 'com';

  if (!isLocalhost && !isGlobyDomain) {
    return null;
  }

  const candidate = isLocalhost
    ? parts[0]
    : parts.slice(0, -2).join('.') || parts[0];

  if (!candidate || candidate === 'www') return null;

  const normalizedCandidate = normalizeSchoolSubdomain(candidate);
  if (RESERVED_SUBDOMAINS.has(normalizedCandidate) || normalizedCandidate === 'globyedu') {
    return null;
  }

  const school = (Array.isArray(schools) ? schools : []).find((entry) => {
    const subdomain = normalizeSchoolSubdomain(entry?.subdomain || entry?.schoolSlug || entry?.slug || '');
    const schoolId = normalizeSchoolSubdomain(entry?.schoolId || '');
    return subdomain === normalizedCandidate || schoolId === normalizedCandidate;
  });

  return school || null;
}

module.exports = {
  RESERVED_SUBDOMAINS,
  normalizeSchoolSubdomain,
  generateSchoolSubdomain,
  resolveTenantFromHostname,
};
