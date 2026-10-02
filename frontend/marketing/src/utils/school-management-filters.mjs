export function getAdminSchoolStatus(school = {}) {
  for (const value of [school.subscriptionStatus, school.schoolStatus, school.status]) {
    const status = String(value || '').trim().toLowerCase();
    if (status) return status;
  }
  return 'inactive';
}

export function getAdminSchoolStatuses(schools = []) {
  const statuses = new Set(['active', 'trial', 'expired', 'suspended']);
  schools.forEach((school) => statuses.add(getAdminSchoolStatus(school)));
  return [...statuses];
}

export function matchesAdminSchoolFilter(searchableText, schoolStatus, searchTerm = '', selectedStatus = '') {
  const search = String(searchTerm || '').trim().toLowerCase();
  const status = String(schoolStatus || '').trim().toLowerCase();
  const selected = String(selectedStatus || '').trim().toLowerCase();
  return (!search || String(searchableText || '').toLowerCase().includes(search))
    && (!selected || status === selected);
}