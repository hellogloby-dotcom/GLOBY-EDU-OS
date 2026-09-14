const base = 'http://localhost:4000';
const adminEmail = 'ataetaben@gmail.com';
const adminPassword = 'Benjamin@123';
const testSchoolName = `Test School ${Date.now()}`;

async function doRequest(path, options = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  try {
    console.log('--- LOGIN SUPER ADMIN ---');
    const login = await doRequest('/api/v1/auth/platform-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminEmail, password: adminPassword }),
    });
    console.log(JSON.stringify(login, null, 2));
    if (!login.ok) return;
    const token = login.data.accessToken || login.data.token;

    console.log('\n--- GET SUMMARY ---');
    const summary = await doRequest('/api/v1/schools/summary', { headers: { Authorization: `Bearer ${token}` } });
    console.log(JSON.stringify(summary, null, 2));

    console.log('\n--- CREATE SCHOOL ---');
    const headEmail = `head-${Date.now()}@testschool.com`;
    const headPassword = 'TestHead@123';
    const create = await doRequest('/api/v1/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: testSchoolName,
        description: 'Created during integration test',
        schoolStatus: 'active',
        subscriptionStatus: 'trial',
        headEmail,
        headFullName: 'Test Head',
        headPassword,
      }),
    });
    console.log(JSON.stringify(create, null, 2));
    const schoolId = create.data.school?.schoolId || create.data.schoolId;
    console.log('schoolId', schoolId);
    if (!schoolId) return;

    console.log('\n--- SEARCH SCHOOLS ---');
    const search = await doRequest(`/api/v1/schools?search=${encodeURIComponent(testSchoolName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(search, null, 2));

    console.log('\n--- UPDATE SCHOOL ---');
    const update = await doRequest(`/api/v1/schools/${encodeURIComponent(schoolId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `${testSchoolName} Updated` }),
    });
    console.log(JSON.stringify(update, null, 2));

    console.log('\n--- VIEW SCHOOL DETAILS ---');
    const view = await doRequest(`/api/v1/schools/${encodeURIComponent(schoolId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(view, null, 2));

    console.log('\n--- SCHOOL HEAD LOGIN ---');
    const headUsername = create.data.school?.headAccount?.username || headEmail;
    const headPasswordUsed = create.data.school?.headAccount?.password || headPassword;
    const headLogin = await doRequest('/api/v1/auth/school-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, username: headUsername, password: headPasswordUsed }),
    });
    console.log(JSON.stringify(headLogin, null, 2));

    console.log('\n--- SUSPEND SCHOOL ---');
    const suspend = await doRequest(`/api/v1/schools/${encodeURIComponent(schoolId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(suspend, null, 2));

    console.log('\n--- SCHOOL HEAD LOGIN AFTER SUSPEND ---');
    const headLoginAfterSuspend = await doRequest('/api/v1/auth/school-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, username: headUsername, password: headPasswordUsed }),
    });
    console.log(JSON.stringify(headLoginAfterSuspend, null, 2));

    console.log('\n--- ACTIVATE SCHOOL ---');
    const activate = await doRequest(`/api/v1/schools/${encodeURIComponent(schoolId)}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(activate, null, 2));

    console.log('\n--- SCHOOL HEAD LOGIN AFTER ACTIVATE ---');
    const headLoginAfterActivate = await doRequest('/api/v1/auth/school-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, username: headUsername, password: headPasswordUsed }),
    });
    console.log(JSON.stringify(headLoginAfterActivate, null, 2));

    console.log('\n--- SUMMARY AFTER CRUD ---');
    const summaryAfter = await doRequest('/api/v1/schools/summary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(summaryAfter, null, 2));
  } catch (err) {
    console.error(err);
  }
})();
