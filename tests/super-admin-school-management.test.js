const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

describe('Super Admin school directory filters', () => {
  let scenarios;

  beforeAll(() => {
    const helperUrl = pathToFileURL(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'utils', 'school-management-filters.mjs')).href;
    const script = `
      import { getAdminSchoolStatus, getAdminSchoolStatuses, matchesAdminSchoolFilter } from ${JSON.stringify(helperUrl)};
      const beta = { name: 'Beta School', schoolId: 'school-beta-2', subscriptionStatus: 'Expired', schoolStatus: 'active' };
      const alpha = { name: 'Alpha School', schoolId: 'GLB-ALPHA-1', subscriptionStatus: 'trial', schoolStatus: 'active' };
      const searchableBeta = 'Beta School school-beta-2 expired';
      const searchableAlpha = 'Alpha School GLB-ALPHA-1 trial';
      process.stdout.write(JSON.stringify({
        betaStatus: getAdminSchoolStatus(beta),
        statuses: getAdminSchoolStatuses([beta, alpha, { subscriptionStatus: 'pending-review' }]),
        byName: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), 'Beta School'),
        byId: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), 'school-beta-2'),
        noMatch: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), 'missing school'),
        cleared: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), ''),
        combinedMatch: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), 'beta', 'expired'),
        combinedMismatch: matchesAdminSchoolFilter(searchableBeta, getAdminSchoolStatus(beta), 'beta', 'active'),
        otherSchool: matchesAdminSchoolFilter(searchableAlpha, getAdminSchoolStatus(alpha), 'alpha', 'trial'),
      }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'School filter helper failed.');
    scenarios = JSON.parse(result.stdout);
  });

  it('searches case-insensitively by school name and ID', () => {
    expect(scenarios.byName).toBe(true);
    expect(scenarios.byId).toBe(true);
  });

  it('returns no-match for an unknown query and restores rows when cleared', () => {
    expect(scenarios.noMatch).toBe(false);
    expect(scenarios.cleared).toBe(true);
  });

  it('filters by the displayed lifecycle status and composes search with status', () => {
    expect(scenarios.betaStatus).toBe('expired');
    expect(scenarios.combinedMatch).toBe(true);
    expect(scenarios.combinedMismatch).toBe(false);
    expect(scenarios.otherSchool).toBe(true);
  });

  it('offers standard and data-backed status options', () => {
    expect(scenarios.statuses).toEqual(expect.arrayContaining(['active', 'trial', 'expired', 'suspended', 'pending-review']));
  });

  it('wires existing directory rows to combined in-place search and status filtering', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');

    expect(mainSource).toContain("document.querySelectorAll('#school-directory-rows [data-school-id]')");
    expect(mainSource).toContain('matchesAdminSchoolFilter(');
    expect(mainSource).toContain("document.getElementById('school-directory-empty')");
    expect(adminSource).toContain('getAdminSchoolStatuses(schools)');
    expect(adminSource).toContain('data-school-status="${status}"');
  });

  it('uses the existing details API result to open the school details modal', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const viewHandler = adminSource.match(/if \(action === 'view'\) \{([\s\S]*?)\n      \} else if \(action === 'edit'\)/)?.[1] || '';

    expect(adminSource).toContain('fetchSchoolDetails } from \'../api/school.js\'');
    expect(viewHandler).toContain('const schoolResult = await fetchSchoolDetails(token, schoolId);');
    expect(viewHandler).toContain('schoolResult.data?.status === \'ok\' ? schoolResult.data.school : null');
    expect(viewHandler).toContain("document.getElementById('school-details-content').innerHTML = renderSchoolDetailsModal(school);");
    expect(viewHandler).toContain('detailsModal.classList.remove');
  });

  it('requires explicit confirmation before calling the existing activation service', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const activateStart = adminSource.indexOf("const activateButton = document.getElementById('security-activate-school');");
    const usersStart = adminSource.indexOf("if (normalizedSection === 'users')", activateStart);
    const securityHandler = adminSource.slice(activateStart, usersStart);

    expect(securityHandler).toContain('if (!confirm(`Activate school ${school.name || school.schoolName || schoolId}? It will regain platform access.`)) return;');
    expect(securityHandler.indexOf('if (!confirm(')).toBeLessThan(securityHandler.indexOf('await activateAdminSchool('));
  });

  it('preserves create/edit required fields, existing API methods, and cancel controls', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const createForm = adminSource.match(/function renderCreateSchoolModal\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
    const editForm = adminSource.match(/function renderEditSchoolModal\(school\) \{([\s\S]*?)\n\}/)?.[1] || '';
    const createHandler = adminSource.match(/function attachSchoolCreateForm\(token, onSuccess\) \{([\s\S]*?)\n\}/)?.[1] || '';
    const editHandler = adminSource.match(/function attachSchoolEditForm\(token, schoolId, onSuccess\) \{([\s\S]*?)\n\}/)?.[1] || '';
    const schoolActions = adminSource.match(/\/\/ School Row Action Buttons[\s\S]*?\/\/ Create school form handler/)?.[0] || '';

    expect(createForm.match(/required/g)).toHaveLength(4);
    expect(createForm).toContain('id="school-modal-cancel"');
    expect(editForm).toContain('name="schoolName"');
    expect(editForm).toContain('name="headName"');
    expect(editForm).toContain('name="headEmail"');
    expect(editForm).toContain('name="subscriptionPlan"');
    expect(editForm).toContain('id="school-modal-cancel"');
    expect(createHandler).toContain("fetch('/api/v1/schools'");
    expect(createHandler).toContain("method: 'POST'");
    expect(editHandler).toContain("method: 'PUT'");
    expect(schoolActions.match(/addEventListener\('click', closeModal\)/g).length).toBeGreaterThanOrEqual(2);
    expect(schoolActions).toContain("if (document.getElementById('school-modal-cancel'))");
  });
});