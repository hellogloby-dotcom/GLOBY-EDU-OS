export function getAdminSchoolStatus(school = {}) {
  for (const value of [school.schoolStatus, school.status]) {
    const status = String(value || '').trim().toLowerCase();
    if (status) return ['trial', 'expired'].includes(status) && !school.schoolStatus ? 'active' : status;
  }
  const subscriptionStatus = String(school.subscriptionStatus || '').trim().toLowerCase();
  if (['suspended', 'inactive', 'blocked', 'disabled'].includes(subscriptionStatus)) return 'suspended';
  if (['active', 'trial', 'expired', 'paid'].includes(subscriptionStatus)) return 'active';
  return 'inactive';
}

export function getAdminSchoolSubscriptionStatus(school = {}) {
  const status = String(school.subscriptionStatus || (['trial', 'expired'].includes(String(school.status || '').trim().toLowerCase()) ? school.status : '')).trim().toLowerCase();
  return status || 'unknown';
}

export function getAdminSchoolStatuses(schools = []) {
  const statuses = new Set(['active', 'trial', 'expired', 'suspended']);
  schools.forEach((school) => {
    statuses.add(getAdminSchoolStatus(school));
    const subscriptionStatus = getAdminSchoolSubscriptionStatus(school);
    if (subscriptionStatus !== 'unknown') statuses.add(subscriptionStatus);
  });
  return [...statuses];
}

export function matchesAdminSchoolFilter(searchableText, schoolStatus, searchTerm = '', selectedStatus = '', subscriptionStatus = '') {
  const search = String(searchTerm || '').trim().toLowerCase();
  const status = String(schoolStatus || '').trim().toLowerCase();
  const selected = String(selectedStatus || '').trim().toLowerCase();
  const subscription = String(subscriptionStatus || '').trim().toLowerCase();
  return (!search || String(searchableText || '').toLowerCase().includes(search))
    && (!selected || status === selected || subscription === selected);
}