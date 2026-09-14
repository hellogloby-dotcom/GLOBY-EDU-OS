const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

describe('marketing frontend syntax', () => {
  it('parses the marketing entrypoint without syntax errors', () => {
    const entryPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
    const result = spawnSync(process.execPath, ['--check', entryPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('includes searchable country and image upload fields for the completed school profile flow', () => {
    const entryPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
    const source = fs.readFileSync(entryPath, 'utf8');

    expect(source).toContain('profile-country');
    expect(source).toContain('list="profile-country-options"');
    expect(source).toContain('profile-stamp-file');
    expect(source).toContain('profile-principal-signature-file');
  });

  it('supports academic JSON export and import for the academic management workflow', () => {
    const entryPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
    const source = fs.readFileSync(entryPath, 'utf8');

    expect(source).toContain("exportType === 'academic'");
    expect(source).toContain("importType === 'academic'");
    expect(source).toContain("record.recordType || record.type || 'academic-years'");
  });

  it('persists the school identity returned by role-specific login flows', () => {
    const entryPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
    const source = fs.readFileSync(entryPath, 'utf8');

    expect(source).toContain("const resolvedSchoolId = schoolId || response.data.schoolId || response.data.response?.schoolId || ''");
    expect(source).toContain("localStorage.setItem('globyedu_schoolId', resolvedSchoolId)");
  });

  it('adds the polished public contact block and validated CMS logo upload flow', () => {
    const entryPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
    const adminPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js');
    const mainSource = fs.readFileSync(entryPath, 'utf8');
    const adminSource = fs.readFileSync(adminPath, 'utf8');

    expect(mainSource).toContain('bg-gradient-to-br from-white via-slate-50 to-sky-50/60');
    expect(adminSource).toContain('Please choose a valid image file for the website logo.');
    expect(adminSource).toContain('Logo uploads must be 2MB or smaller for the best performance.');
  });
});
