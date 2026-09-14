// auth.js
// Lightweight frontend API wrapper for auth endpoints.
// This file performs client-side requests to the backend auth routes.

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function getJson(url, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function studentLogin(schoolId, email, password, options = {}) {
  const payload = {
    schoolId,
    username: email,
    password,
    loginType: 'student',
    schoolName: options.schoolName || '',
    studentName: options.studentName || '',
    className: options.studentClass || '',
  };
  return postJson('/api/v1/auth/school-login', payload);
}

export async function teacherLogin(schoolId, email, password, options = {}) {
  const payload = {
    schoolId: schoolId || '',
    username: email,
    password,
    loginType: 'teacher',
    schoolName: options.schoolName || '',
    teacherName: options.teacherName || '',
  };
  return postJson('/api/v1/auth/school-login', payload);
}

export async function schoolAuthorityLogin(schoolId, email, password) {
  const payload = {
    schoolId,
    username: email,
    password,
    loginType: 'school_authority',
  };
  return postJson('/api/v1/auth/school-login', payload);
}

export async function schoolLogin(email, password, schoolId) {
  const payload = { schoolId, username: email, password, loginType: 'school' };
  return postJson('/api/v1/auth/login', payload);
}

export async function firebaseLogin(idToken, schoolId, platformAdmin = false) {
  return postJson('/api/v1/auth/firebase-login', { idToken, schoolId, platformAdmin });
}

export async function platformAdminLogin(email, password) {
  const payload = { username: email, password };
  return postJson('/api/v1/auth/platform-login', payload);
}

export async function forgotPassword(email, loginType = 'school') {
  return postJson('/api/v1/auth/forgot-password', { email, loginType });
}

export async function sendFirebasePasswordReset(email) {
  const payload = { email };
  return postJson('/api/v1/auth/forgot-password', payload);
}

export async function confirmFirebasePasswordReset(oobCode, newPassword) {
  return postJson('/api/v1/auth/reset-password', { token: oobCode, password: newPassword });
}

export async function changePassword(accessToken, oldPassword, newPassword) {
  return postJsonWithToken('/api/v1/auth/change-password', { oldPassword, newPassword }, accessToken);
}

async function postJsonWithToken(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function register(schoolName, adminName, email, phone, country, password) {
  // Accept either a single payload object or the legacy argument list for compatibility.
  let payload;
  if (typeof schoolName === 'object') {
    payload = schoolName;
  } else {
    payload = { schoolName, head: { fullName: adminName, email }, phone, country, headPassword: password };
  }
  return postJson('/api/v1/auth/register', payload);
}

export async function fetchSchoolSummary(token, schoolId) {
  return getJson(`/api/v1/schools/${encodeURIComponent(schoolId)}/summary`, token);
}
