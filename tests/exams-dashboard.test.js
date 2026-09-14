const fs = require('fs');
const path = require('path');

describe('school examinations workspace', () => {
  it('renders dedicated examination and grading views for school authority', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'), 'utf8');

    expect(dashboardSource).toContain('Examinations & Grading');
    expect(dashboardSource).toContain('Create exam');
    expect(dashboardSource).toContain('Generate report card');
    expect(dashboardSource).toContain('Transcript');
    expect(dashboardSource).toContain('Search exams');
    expect(dashboardSource).toContain('Mark entry');
    expect(dashboardSource).toContain('Export PDF');
    expect(dashboardSource).toContain('grading system');
    expect(mainSource).toContain('createExamRecord');
    expect(mainSource).toContain('generateReportCard');
  });
});
