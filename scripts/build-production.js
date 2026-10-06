const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const marketingRoot = path.join(projectRoot, 'frontend', 'marketing');
const outputRoot = path.join(projectRoot, 'dist', 'frontend');
const generatedCssPath = path.join(outputRoot, 'src', 'styles.generated.css');
const tailwindCliPath = path.join(projectRoot, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');

function removeOutput() {
  fs.rmSync(path.join(projectRoot, 'dist'), { recursive: true, force: true });
}

function copyMarketingApp() {
  fs.cpSync(marketingRoot, outputRoot, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });
}

function writeFirebaseConfig() {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  };
  const configDirectory = path.join(outputRoot, 'config');
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(configDirectory, 'firebase.js'),
    `globalThis.__GLOBYEDU_FIREBASE_CONFIG__ = ${JSON.stringify(config)};\n`,
    'utf8'
  );
}

function buildCss() {
  execFileSync(process.execPath, [
    tailwindCliPath,
    '-i', 'src/styles.css',
    '-o', path.relative(marketingRoot, generatedCssPath),
    '--config', 'tailwind.config.js',
  ], { cwd: marketingRoot, stdio: 'inherit' });
}

function validateOutput() {
  const requiredFiles = [
    path.join(outputRoot, 'index.html'),
    path.join(outputRoot, 'src', 'main.js'),
    generatedCssPath,
    path.join(outputRoot, 'config', 'firebase.js'),
    path.join(outputRoot, 'manifest.json'),
    path.join(outputRoot, 'sw.js'),
  ];
  requiredFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error(`Missing production asset: ${path.relative(projectRoot, filePath)}`);
    }
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, 'manifest.json'), 'utf8'));
  if (manifest.name !== 'GlobyEdu OS' || manifest.short_name !== 'GlobyEdu') {
    throw new Error('Production manifest is missing the GlobyEdu app name.');
  }
  manifest.icons.forEach((icon) => {
    if (!icon.src.startsWith('/') || icon.src.includes('..')) {
      throw new Error(`Invalid production app icon path: ${icon.src}`);
    }
    const iconPath = path.join(outputRoot, icon.src.slice(1));
    if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
      throw new Error(`Missing production app icon: ${icon.src}`);
    }
    const imageHeader = fs.readFileSync(iconPath);
    const width = imageHeader.readUInt32BE(16);
    const height = imageHeader.readUInt32BE(20);
    const expectedSize = Number.parseInt(icon.sizes.split('x')[0], 10);
    if (width !== expectedSize || height !== expectedSize) {
      throw new Error(`Production app icon dimensions do not match manifest: ${icon.src}`);
    }
  });

  const html = fs.readFileSync(path.join(outputRoot, 'index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(outputRoot, 'sw.js'), 'utf8');
  const metadataLinks = [...html.matchAll(/<link\b[^>]*>/gi)].map(([link]) => link);
  metadataLinks.forEach((link) => {
    if (!/rel=["'](?:icon|apple-touch-icon)["']/i.test(link)) return;
    const href = link.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !href.startsWith('/')) throw new Error(`Invalid production icon link: ${link}`);
    const assetPath = path.join(outputRoot, href.slice(1));
    if (!fs.existsSync(assetPath) || fs.statSync(assetPath).size === 0) {
      throw new Error(`Missing production document icon: ${href}`);
    }
  });
  manifest.icons.forEach((icon) => {
    if (!serviceWorker.includes(icon.src)) {
      throw new Error(`Service worker does not precache the app icon: ${icon.src}`);
    }
  });

  const javascriptFiles = [];
  const visit = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.name.endsWith('.js')) javascriptFiles.push(entryPath);
    });
  };
  visit(path.join(outputRoot, 'src'));
  javascriptFiles.forEach((filePath) => {
    const frontendSourceRoot = `${path.join(outputRoot, 'src')}${path.sep}`;
    if (filePath.startsWith(frontendSourceRoot)) {
      execFileSync(process.execPath, ['--input-type=module', '--check'], {
        input: fs.readFileSync(filePath),
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      return;
    }
    execFileSync(process.execPath, ['--check', filePath], { stdio: 'inherit' });
  });
}

removeOutput();
copyMarketingApp();
writeFirebaseConfig();
buildCss();
validateOutput();
console.log(`Production frontend built at ${path.relative(projectRoot, outputRoot)}`);
console.log('Backend deployment: run backend/server.js with production environment variables.');
