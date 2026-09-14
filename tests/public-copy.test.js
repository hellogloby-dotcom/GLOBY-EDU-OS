const fs = require('fs');
const path = require('path');

describe('public marketing copy', () => {
  it('does not use AI language in the public experience', () => {
    const files = [
      path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'main.js'),
      path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'hero.js'),
      path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'components', 'features.js'),
      path.join(__dirname, '..', 'frontend', 'marketing', 'src', 'pages', 'school-dashboard.js'),
    ];

    const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n').toLowerCase();

    expect(combined).not.toMatch(/ai tutor|ai-powered|ai assistant|ai web|ai-powered insights/);
  });
});
