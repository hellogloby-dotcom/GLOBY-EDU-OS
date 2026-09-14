const fs = require('fs');
const path = require('path');

describe('school authority workspace', () => {
  it('keeps the sidebar focused on the required school-authority modules', () => {
    const sidebarSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'sidebar.js'), 'utf8');

    expect(sidebarSource).toContain('Dashboard');
    expect(sidebarSource).toContain('Profile');
    expect(sidebarSource).toContain('Students');
    expect(sidebarSource).toContain('Teachers');
    expect(sidebarSource).toContain('Attendance');
    expect(sidebarSource).toContain('Finance & Billing');
    expect(sidebarSource).toContain('Examination & Grading');
    expect(sidebarSource).toContain('Announcements');
    expect(sidebarSource).toContain('Notifications');
    expect(sidebarSource).toContain('Messaging');
    expect(sidebarSource).toContain('Reports');
    expect(sidebarSource).toContain('Settings');
  });

  it('renders the full quick-action set on the dashboard overview', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');

    expect(dashboardSource).toContain('Create Announcement');
    expect(dashboardSource).toContain('Send Message');
    expect(dashboardSource).toContain('Create Class');
    expect(dashboardSource).toContain('Generate Report');
    expect(dashboardSource).toContain('Add Student');
    expect(dashboardSource).toContain('Add Teacher');
  });

  it('routes school-authority messages navigation to the canonical workspace section', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain("if (id === 'messages') {");
    expect(mainSource).toContain("location.hash = '#/school/messages';");
  });

  it('preserves the selected school-authority section when refreshing summary state', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain("renderSchoolDashboardPage(section, navigationId);");
    expect(mainSource).toContain("SchoolDashboardPage(summary, normalizedSection, sectionData)");
    expect(mainSource).not.toContain("loadSchoolSummary(section);");
  });

  it('loads the live school summary and entity data before rendering the authority dashboard', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(mainSource).toContain('const summaryResult = await fetchSchoolSummary(token, schoolId);');
    expect(mainSource).toContain("const normalizedSection = normalizeSchoolSection(section);");
    expect(mainSource).toContain('currentSchoolStudents');
    expect(mainSource).toContain('currentSchoolTeachers');
  });

  it('offers the requested teacher management fields and curriculum coverage', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');
    const actionsSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'utils', 'school-dashboard-actions.cjs'), 'utf8');

    expect(mainSource).not.toContain('National ID / Passport');
    expect(mainSource).toContain("id === 'classes'");
    expect(mainSource).toContain("location.hash = '#/school/classes'");
    expect(mainSource).toContain('RME');
    expect(mainSource).toContain("{ label: 'Nursery 1', value: 'Nursery 1' }");
    expect(mainSource).toContain('[1, 2, 3, 4, 5, 6].map');
    expect(mainSource).toContain('[1, 2, 3].map((level) => ({ label: `JHS ${level}`, value: `JHS ${level}` }))');
    expect(mainSource).toContain('[1, 2, 3].map((level) => ({ label: `SHS ${level}`, value: `SHS ${level}` }))');
    expect(mainSource).toContain('Principal');
    expect(mainSource).not.toContain('Is house master?');
    expect(mainSource).toContain("showAdminForm('Register teacher'");
    expect(mainSource).toContain("{ name: 'gender', label: 'Gender', type: 'select'");
    expect(mainSource).toContain("{ name: 'dateOfBirth', label: 'Date of birth (optional)'");
    expect(mainSource).toContain("{ name: 'profilePhoto', label: 'Profile photo', type: 'file'");
    expect(actionsSource).not.toContain('payload.signature = data.signature');
  });

  it('renders school settings controls as dropdowns', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');

    expect(dashboardSource).toContain('id="school-settings-theme"');
    expect(dashboardSource).toContain('id="school-settings-colours"');
    expect(dashboardSource).toContain('id="school-settings-email"');
    expect(dashboardSource).toContain('id="school-settings-sms"');
    expect(dashboardSource).toContain('id="school-settings-messaging"');
    expect(dashboardSource).toContain('id="school-settings-analytics"');
    expect(dashboardSource).toContain('<select');
    expect(dashboardSource).not.toContain('id="school-settings-theme" value=');
  });
});
