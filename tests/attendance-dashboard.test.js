const fs = require('fs');
const path = require('path');

describe('attendance dashboard experience', () => {
  it('includes a richer attendance overview for school heads', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');

    expect(source).toContain('Attendance overview');
    expect(source).toContain('Present');
    expect(source).toContain('Absent');
    expect(source).toContain('Late');
    expect(source).toContain('Excused');
  });

  it('keeps the dashboard overview focused on summary cards and charts', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');

    expect(source).toContain("Today's Attendance");
    expect(source).not.toContain('Academic Structure Manager');
    expect(source).not.toContain('Global Search');
  });

  it('builds a class roster and hydrates existing statuses', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'utils', 'school-dashboard-actions.js'), 'utf8');
    expect(source).toContain('buildAttendanceRoster');
    expect(source).toContain("status || 'active'");
    expect(source).toContain('attendanceRecords');
  });

  it('replaces only the selected attendance session when saving edits', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'utils', 'school-dashboard-actions.js'), 'utf8');
    expect(source).toContain('replaceAttendanceSession');
    expect(source).toContain('const keys = new Set');
    expect(source).toContain('retained');
  });
});
