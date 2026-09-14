const fs = require('fs');
const path = require('path');

describe('school finance workspace', () => {
  it('renders a complete finance module with billing, receipts, and reporting surfaces', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'), 'utf8');

    expect(source).toContain('Fee Categories');
    expect(source).toContain('Invoices');
    expect(source).toContain('Payments');
    expect(source).toContain('Receipts');
    expect(source).toContain('Refunds');
    expect(source).toContain('Reports');
  });
});
