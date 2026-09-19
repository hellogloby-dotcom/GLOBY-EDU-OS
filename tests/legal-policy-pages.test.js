const fs = require('fs');
const path = require('path');

describe('public legal policy experience', () => {
  const legalPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'legal.js');
  const mainPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js');
  const footerPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'footer.js');
  const registerPath = path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'register-wizard.js');

  test('defines all public policy pages with effective dates', () => {
    const source = fs.readFileSync(legalPath, 'utf8');
    expect(source).toContain("title: 'Privacy Policy'");
    expect(source).toContain("title: 'Terms of Service'");
    expect(source).toContain("title: 'Cookie Policy'");
    expect(source).toContain("title: 'Payment & Refund Policy'");
    expect(source).toContain('14 calendar days');
    expect(source).toContain('Effective date');
  });

  test('routes and links every policy from public navigation surfaces', () => {
    const main = fs.readFileSync(mainPath, 'utf8');
    const footer = fs.readFileSync(footerPath, 'utf8');
    const register = fs.readFileSync(registerPath, 'utf8');
    const legal = fs.readFileSync(legalPath, 'utf8');
    expect(main).toContain("current === 'legal' || current.startsWith('legal/')");
    for (const policy of ['privacy', 'terms', 'cookies', 'payments']) {
      expect(legal).toContain('#/legal/${policyKey}');
      expect(footer).toContain(`legal/${policy}`);
    }
    expect(register).toContain('#/legal/terms');
    expect(register).toContain('#/legal/privacy');
  });
});