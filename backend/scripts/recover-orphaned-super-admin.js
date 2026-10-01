const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArguments(args) {
  const options = { confirmed: args.includes('--confirm-orphan-recovery'), email: '' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = String(args[index] || '');
    if (argument.startsWith('--email=')) options.email = argument.slice('--email='.length).trim();
    else if (argument === '--email' && args[index + 1]) options.email = String(args[index + 1]).trim();
  }
  if (options.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email)) {
    throw new Error('A valid --email value is required.');
  }
  return options;
}

async function main(args = process.argv.slice(2), env = process.env) {
  console.info('Orphaned Super Admin recovery command.');
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  if (!options.confirmed || !options.email) {
    console.error('Refusing to run without explicit confirmation and a valid --email value.');
    process.exitCode = 2;
    return;
  }

  try {
    const { recoverOrphanedSuperAdmin } = require('../modules/platform-admin/recover-orphaned-super-admin.service');
    await recoverOrphanedSuperAdmin({ env: { ...env, INITIAL_SUPER_ADMIN_EMAIL: options.email }, logger: console });
  } catch (error) {
    console.error(`Super Admin recovery failed: ${String(error.message || 'Recovery failed.')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main, parseArguments };
