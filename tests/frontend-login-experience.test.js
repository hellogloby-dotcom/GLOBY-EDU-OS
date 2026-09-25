/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

describe('login experience', () => {
  it('renders the required school authority, teacher, and student login fields while preserving the secure-session option', () => {
    const loginSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'login.js'), 'utf8');

    expect(loginSource).toContain('School Authority');
    expect(loginSource).toContain('Teacher');
    expect(loginSource).toContain('Student');
    expect(loginSource).toContain('id="super-admin-portal"');
    expect(loginSource).toContain('School ID');
    expect(loginSource).toContain('Teacher ID');
    expect(loginSource).toContain('Student ID');
    expect(loginSource).not.toContain('Student name');
    expect(loginSource).not.toContain('Teacher name');
    expect(loginSource).not.toContain('School Name');
    expect(loginSource).toContain('Keep me signed in on this device.');
    expect(loginSource).toContain('Google Sign In');
  });

  it('keeps responsive navigation and footer content from forcing tablet overflow', () => {
    const navbarSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'navbar.js'), 'utf8');
    const footerSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'footer.js'), 'utf8');

    expect(navbarSource).toContain('xl:flex');
    expect(navbarSource).toContain('xl:hidden');
    expect(footerSource).toContain('flex flex-wrap gap-x-3 gap-y-2');
  });

  it('invalidates stale route renders and clears authentication state on logout', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');
    const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'sw.js'), 'utf8');

    expect(mainSource).toContain('let routeGeneration = 0;');
    expect(mainSource).toContain('if (navigationId !== routeGeneration) return;');
    expect(mainSource).toContain("localStorage.removeItem('globyedu_accessToken');");
    expect(mainSource).toContain("localStorage.removeItem('globyedu_userRole');");
    expect(mainSource).toContain("profile.email = localStorage.getItem('globyedu_userEmail') || profile.email || '';");
    expect(serviceWorkerSource).toContain("const CACHE_NAME = 'globyedu-pwa-v7';");
    expect(serviceWorkerSource).toContain("if (/\\.(?:css|js)$/.test(requestUrl.pathname))");
  });

  it('serializes student profile uploads to the school record instead of only local storage', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain("localStorage.setItem('globyedu_profilePhoto', remoteUrl);");
    expect(mainSource).toContain('updateSchoolEntity(token, schoolId, \'students\', studentId, {');
    expect(mainSource).toContain('profilePhoto: remoteUrl');
  });

  it('blocks protected cross-role and school/admin hash routes when a different authenticated role is active', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain("const authenticatedRole = getUserRole();");
    expect(mainSource).toContain("if (authenticatedRole !== 'school_authority' && authenticatedRole !== 'super_admin' && !getPlatformAdminFlag())");
    expect(mainSource).toContain("if (role && authenticatedRole && authenticatedRole !== role)");
    expect(mainSource).toContain("location.hash = redirectPath;");
    expect(mainSource).toContain("location.hash = '#/role/student';");
  });

  it('returns each authenticated role to its matching dashboard', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain("if (platformAdmin || role === 'platform_admin' || role === 'super_admin') return '#/admin/overview';");
    expect(mainSource).toContain("if (role === 'teacher' || role === 'student') return `#/role/${role}`;");
    expect(mainSource).toContain("location.hash = getDashboardPathForRole(getUserRole(), getPlatformAdminFlag());");
    expect(mainSource).toContain("location.hash = getDashboardPathForRole(roleFromResponse, roleFromResponse === 'platform_admin');");
  });
});
