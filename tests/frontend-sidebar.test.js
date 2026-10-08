const fs = require('fs');
const path = require('path');

describe('authenticated dashboard shell', () => {
  it('does not render an extra sidebar inside the admin page content', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    expect(adminSource).not.toContain('renderSidebar(');
    expect(adminSource).not.toContain('renderAdminTopbar(');
    expect(adminSource).toContain('Super Admin Control Panel');
  });

  it('keeps the authenticated mobile drawer and responsive content within the viewport', () => {
    const shellSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'app-shell.js'), 'utf8');
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'styles.css'), 'utf8');

    expect(shellSource).toContain('h-dvh w-[min(88vw,20rem)]');
    expect(shellSource).toContain('data-app-shell-content');
    expect(shellSource).toContain('aria-controls="app-sidebar"');
    expect(adminSource).toContain('data-admin-page');
    expect(styles).toMatch(/\[data-admin-page\]\s+table\s*\{[^}]*min-width:\s*720px;/);
    expect(styles).toMatch(/\[data-app-shell-content\],\s*\[data-admin-page\]\s*\{[^}]*min-width:\s*0;/);
  });

  it('includes privacy masking and super-admin-only section guards', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    expect(adminSource).toContain('maskSensitiveValue');
    expect(adminSource).toContain('SUPER_ADMIN_ONLY_SECTIONS');
    expect(adminSource).toContain('renderRestrictedAccessNotice');
    expect(adminSource).toContain('data-sensitive-field');
  });

  it('routes each core super-admin module to its working renderer', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    expect(adminSource).toContain("if (normalizedSection === 'analytics') return renderAnalytics(summary, schools);");
    expect(adminSource).toContain("if (normalizedSection === 'settings') return renderPlatformSettings();");
    expect(adminSource).toContain("if (normalizedSection === 'backups') return renderBackups();");
    expect(adminSource).toContain("if (normalizedSection === 'security') return renderSecurity();");
  });
});
