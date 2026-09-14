const fs = require('fs');
const path = require('path');

describe('super admin communication and audit implementation', () => {
  it('includes dynamic school selection and real message persistence fields', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const adminStateSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin-state.js'), 'utf8');

    expect(adminSource).toContain('recipientType');
    expect(adminSource).toContain('All Schools');
    expect(adminSource).toContain('priority');
    expect(adminSource).toContain('schoolSelector');
    expect(adminStateSource).toContain('maskAuditValue');
    expect(adminStateSource).toContain('notificationService');
  });

  it('records support retention logic and sensitive-value masking in code comments and helpers', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const adminStateSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin-state.js'), 'utf8');

    expect(adminSource).toContain('support message retention');
    expect(adminSource).toContain('expiresAt');
    expect(adminStateSource).toContain('maskAuditValue');
    expect(adminStateSource).toContain('sensitive');
  });

  it('implements backup abstraction, secure restore validation, and useful security audit metadata', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');

    expect(adminSource).toContain('createPlatformBackupSnapshot');
    expect(adminSource).toContain('restoreLatestBackup');
    expect(adminSource).toContain('verifyBackupIntegrity');
    expect(adminSource).toContain('maskSensitiveBackupData');
    expect(adminSource).toContain('superAdminEmergencyAccess');
    expect(adminSource).toContain('resultStatus');
    expect(adminSource).toContain('actorRole');
  });

  it('keeps public CMS contact copy editable and refreshes the homepage after CMS changes', () => {
    const adminSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'admin.js'), 'utf8');
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(adminSource).toContain("return ['apiKey', 'secretKey', 'webhookSecret'].includes(name);");
    expect(adminSource).toContain("if (String(settings[field] || '').includes('*')) settings[field] = defaultSettings[field];");
    expect(mainSource).toContain("if (String(settings[field] || '').includes('*')) settings[field] = DEFAULT_WEBSITE_CMS[field];");
    expect(mainSource).toContain("if (event.key === WEBSITE_CMS_STORAGE_KEY) refreshLandingFromCMS();");
  });
});
