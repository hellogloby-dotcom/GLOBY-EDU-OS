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
  ];
  requiredFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error(`Missing production asset: ${path.relative(projectRoot, filePath)}`);
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
