const baseUrl = process.env.GLOBY_API_URL || process.env.API_URL || 'https://api.globyedu.com';
const adminUsername = process.env.SUPER_ADMIN_EMAIL || 'ataetaben@gmail.com';
const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Benjamin@123';

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      i += 1;
    } else {
      values[key] = true;
    }
  }
  return values;
}

async function doRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text };
  }
  return { status: response.status, ok: response.ok, data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schoolName = args.name || args.school || args['school-name'] || 'Synthetic School';
  const headEmail = args['head-email'] || args.email || 'head@globyedu.com';
  const headPassword = args['head-password'] || args.password || 'HeadPass@123';
  const headFullName = args['head-full-name'] || args['full-name'] || 'School Head';

  console.log(`Logging in to ${baseUrl} as ${adminUsername}...`);
  const loginResponse = await doRequest(`${baseUrl}/api/v1/auth/platform-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });

  if (!loginResponse.ok) {
    console.error('Platform admin login failed:', JSON.stringify(loginResponse.data, null, 2));
    process.exitCode = 1;
    return;
  }

  const token = loginResponse.data.accessToken || loginResponse.data.token;
  if (!token) {
    console.error('No access token received from platform login response.');
    console.error(JSON.stringify(loginResponse.data, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`Creating school: ${schoolName}`);
  const createResponse = await doRequest(`${baseUrl}/api/v1/schools`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: schoolName,
      description: 'Synthetic school created by the GlobyEdu OS admin workflow.',
      schoolStatus: 'active',
      subscriptionStatus: 'trial',
      headEmail,
      headFullName,
      headPassword,
    }),
  });

  console.log(JSON.stringify(createResponse, null, 2));
  if (!createResponse.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('School creation failed:', error);
  process.exitCode = 1;
});
