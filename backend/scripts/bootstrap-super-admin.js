const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function redact(message, values) {
  let safe = String(message || 'Bootstrap failed.');
  values.filter(Boolean).forEach((value) => {
    safe = safe.split(String(value)).join('[REDACTED]');
  });
  return safe.replace(/(private key|secret|password|token)\s*[:=]\s*[^\s,;]+/ig, '$1=[REDACTED]');
}

async function main() {
  console.info('Initial Super Admin bootstrap command.');
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without the explicit --confirm flag.');
    process.exitCode = 2;
    return;
  }

  const secretValues = [
    process.env.INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET,
    process.env.INITIAL_SUPER_ADMIN_PASSWORD,
    process.env.FIREBASE_PRIVATE_KEY,
    process.env.FIREBASE_CLIENT_EMAIL,
  ];
  try {
    const { bootstrapFirstSuperAdmin } = require('../modules/platform-admin/bootstrap-super-admin.service');
    await bootstrapFirstSuperAdmin({ logger: console });
  } catch (error) {
    console.error(`Bootstrap failed: ${redact(error.message, secretValues)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, redact };