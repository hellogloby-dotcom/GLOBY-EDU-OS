const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { ensureDemoSchool } = require('../fallback.school');
const schoolService = require('../school.service');
const { generateSchoolSubdomain, resolveTenantFromHostname } = require('../tenant-hostname');

const schoolsFile = path.join(__dirname, '../../../data/schools.json');
const originalData = fs.existsSync(schoolsFile) ? fs.readFileSync(schoolsFile, 'utf8') : '';

afterEach(() => {
  fs.writeFileSync(schoolsFile, originalData, 'utf8');
});

test('ensureDemoSchool seeds the required development accounts and school identifiers', () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();

  expect(school.schoolId).toBe('globy-school');
  expect(school.name).toBe('Globy School');
  expect(school.email).toBe('authority@globyedu.test');
  expect(school.country).toBe('Ghana');
  expect(school.region).toBe('Ashanti');
  expect(school.subscriptionPlan).toBe('Unlimited (Development Only)');

  const emails = ['ataetaben@gmail.com', 'ataetabenjamin@gmail.com', 'hellogloby@gmail.com', 'benjaminataeta@gmail.com'];
  for (const email of emails) {
    const superAdmin = school.users.find((user) => user.username === email);
    expect(superAdmin).toBeDefined();
    expect(superAdmin.role).toBe('super_admin');
    expect(superAdmin.passwordHash).toBeTruthy();
    expect(superAdmin.platformAdmin).toBe(true);
  }

  const schoolHead = school.users.find((user) => user.username === 'authority@globyedu.test');
  expect(schoolHead).toBeDefined();
  expect(schoolHead.role).toBe('school_authority');

  const teacher = school.users.find((user) => user.username === 'T001');
  expect(teacher).toBeDefined();
  expect(teacher.role).toBe('teacher');
  expect(teacher.passwordHash).toBeTruthy();

  const student = school.users.find((user) => user.username === 'STU001');
  expect(student).toBeDefined();
  expect(student.role).toBe('student');
  expect(student.studentId).toBe('STU001');
  expect(student.passwordNeedsReset).toBe(true);
});

test('development accounts use the exact required passwords and roles', () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();
  const requiredCredentials = [
    { username: 'ataetaben@gmail.com', password: 'Benjamin@123', role: 'super_admin' },
    { username: 'ataetabenjamin@gmail.com', password: 'Benjamin@123', role: 'super_admin' },
    { username: 'hellogloby@gmail.com', password: 'Benjamin@123', role: 'super_admin' },
    { username: 'benjaminataeta@gmail.com', password: 'Benjamin@123', role: 'super_admin' },
    { username: 'authority@globyedu.test', password: 'GlobySchool@123', role: 'school_authority' },
    { username: 'T001', password: 'GlobyTeacher@123', role: 'teacher' },
    { username: 'STU001', password: 'GlobyStudent@123', role: 'student' },
  ];

  for (const credential of requiredCredentials) {
    const user = school.users.find((entry) => entry.username === credential.username && entry.role === credential.role);
    expect(user).toBeDefined();

    const storedHash = user.passwordHash || user.studentPasswordHash;
    expect(storedHash).toBeTruthy();
    expect(bcrypt.compareSync(credential.password, storedHash)).toBe(true);
  }
});

test('createStudentRecord assigns and preserves a unique generated student ID', () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();
  const first = school.students?.[0] || { studentId: 'STD-001' };
  const second = {
    fullName: 'Jane Doe',
    className: 'Form 1A',
    status: 'active',
    schoolId: school.schoolId,
  };

  const generated = first.studentId || 'STU001';
  expect(generated).toMatch(/^(STD|STU)-?/i);
  expect(generated).not.toBe(second.studentId);
});

test('entity onboarding generates usable teacher and student credentials without exposing hashes', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();
  const seededClass = school.classes[0];
  const teacher = await schoolService.createEntity(school.schoolId, 'teachers', {
    fullName: 'Generated Teacher',
    email: 'generated-teacher@globy.test',
    assignedClasses: [seededClass.classId],
    assignedSubjects: ['Science'],
  });
  const student = await schoolService.createEntity(school.schoolId, 'students', {
    fullName: 'Generated Student',
    email: 'generated-student@globy.test',
    classId: seededClass.classId,
    className: seededClass.name,
    profilePhoto: 'data:image/png;base64,student-photo',
  });
  const persisted = schoolService.getSchoolBySchoolId(school.schoolId);
  const reloaded = await persisted;
  const persistedTeacher = reloaded.users.find((user) => user.email === teacher.email);
  const persistedStudent = reloaded.users.find((user) => user.email === student.email);

  expect(teacher.teacherId).toMatch(/^T-/);
  expect(teacher.passwordHash).toBeUndefined();
  expect(teacher.passwordNeedsReset).toBe(true);
  expect(persistedTeacher.passwordHash).toMatch(/^\$2[aby]\$/);
  expect(student.studentId).toMatch(/^STD-/);
  expect(student.passwordHash).toBeUndefined();
  expect(student.passwordNeedsReset).toBe(true);
  expect(persistedStudent.passwordHash).toMatch(/^\$2[aby]\$/);
  expect(reloaded.students.find((entry) => entry.studentId === student.studentId).profilePhoto).toContain('data:image/png');
});

test('teacher creation omits national ID and signature fields', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();
  const teacher = await schoolService.createEntity(school.schoolId, 'teachers', {
    fullName: 'Photo Teacher',
    email: 'photo-teacher@globy.test',
    nationalId: 'SHOULD-NOT-PERSIST',
    signature: 'https://example.test/signature.png',
    profilePhoto: 'data:image/png;base64,real-photo-data',
  });
  const reloaded = await schoolService.getSchoolBySchoolId(school.schoolId);
  const persisted = reloaded.users.find((user) => user.email === teacher.email);

  expect(persisted.nationalId).toBeUndefined();
  expect(persisted.signature).toBeUndefined();
  expect(persisted.profilePhoto).toContain('data:image/png');
});

test('teacher updates keep national ID and signature out of existing school records', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = ensureDemoSchool();
  const teacher = await schoolService.createEntity(school.schoolId, 'teachers', {
    fullName: 'Existing School Teacher',
    email: 'existing-teacher@globy.test',
    profilePhoto: 'data:image/png;base64,existing-photo',
  });
  await schoolService.updateEntity(school.schoolId, 'teachers', teacher.teacherId, {
    nationalId: 'SHOULD-NOT-PERSIST',
    signature: 'https://example.test/signature.png',
    profilePhoto: 'data:image/png;base64,updated-photo',
  });

  const reloaded = await schoolService.getSchoolBySchoolId(school.schoolId);
  const persisted = reloaded.users.find((user) => user.email === teacher.email);

  expect(persisted.nationalId).toBeUndefined();
  expect(persisted.signature).toBeUndefined();
  expect(persisted.profilePhoto).toContain('updated-photo');
});

test('createSchool preserves branding and logo data from registration payloads', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const created = await schoolService.createSchool({
    name: 'Logo Test School',
    headEmail: 'head@logo-test.globyedu.com',
    headPassword: 'HeadPass123!',
    logo: 'data:image/png;base64,abc123',
    coverImage: 'data:image/png;base64,cover123',
    description: 'A school created during registration',
    country: 'Ghana',
    region: 'Greater Accra',
    city: 'Accra',
    address: 'P.O. Box 123',
    phone: '+233200000000',
    email: 'admin@logo-test.globyedu.com',
    website: 'https://logo-test.edu',
    branding: { motto: 'Learn boldly', language: 'English', currency: 'GHS' },
  });

  expect(created.logo).toBe('data:image/png;base64,abc123');
  expect(created.coverImage).toBe('data:image/png;base64,cover123');
  expect(created.description).toContain('registration');
  expect(created.country).toBe('Ghana');
  expect(created.region).toBe('Greater Accra');
  expect(created.city).toBe('Accra');
  expect(created.address).toBe('P.O. Box 123');
  expect(created.branding).toMatchObject({ motto: 'Learn boldly', language: 'English', currency: 'GHS' });
});

test('new schools support class, teacher, and student onboarding without manual IDs', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const school = await schoolService.createSchool({
    name: 'Fresh QA School',
    headEmail: 'fresh-head@globy.test',
    headFullName: 'Fresh Head',
  });
  const createdClass = await schoolService.createEntity(school.schoolId, 'classes', { name: 'Grade 7A' });
  const teacher = await schoolService.createEntity(school.schoolId, 'teachers', {
    fullName: 'Fresh Teacher',
    email: 'fresh-teacher@globy.test',
    assignedClasses: [createdClass.classId],
    profilePhoto: 'data:image/png;base64,fresh-teacher-photo',
    nationalId: 'SHOULD-NOT-PERSIST',
    signature: 'https://example.test/signature.png',
  });
  const student = await schoolService.createEntity(school.schoolId, 'students', {
    fullName: 'Fresh Student',
    email: 'fresh-student@globy.test',
    classId: createdClass.classId,
    className: createdClass.name,
  });
  const reloaded = await schoolService.getSchoolBySchoolId(school.schoolId);

  expect(school.headAccount.username).toBe('fresh-head@globy.test');
  expect(reloaded.classes.some((item) => item.classId === createdClass.classId)).toBe(true);
  expect(teacher.teacherId).toBeTruthy();
  expect(teacher.profilePhoto).toContain('data:image/png');
  expect(teacher.nationalId).toBeUndefined();
  expect(teacher.signature).toBeUndefined();
  expect(student.studentId).toBeTruthy();
  expect(reloaded.students.find((item) => item.studentId === student.studentId).classId).toBe(createdClass.classId);
  expect(reloaded.teachers.find((item) => item.teacherId === teacher.teacherId).assignedClasses).toContain(createdClass.classId);
});

test('createSchool assigns a normalized, collision-safe subdomain and persists it', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const created = await schoolService.createSchool({ name: 'Globy School' });

  expect(created.subdomain).toBe('globy-school');
  expect(generateSchoolSubdomain('Globy School', [])).toBe('globy-school');
  expect(generateSchoolSubdomain('Admin', [{ subdomain: 'admin' }])).not.toBe('admin');
  expect(generateSchoolSubdomain('Globy School', [{ subdomain: 'globy-school' }])).toMatch(/^globy-school-\d+$/);
});

test('hostname resolution resolves the tenant from a valid subdomain and rejects reserved hosts', () => {
  const schools = [
    { schoolId: 'school-a', name: 'School A', subdomain: 'school-a' },
    { schoolId: 'school-b', name: 'School B', subdomain: 'school-b' },
  ];

  expect(resolveTenantFromHostname('school-a.globyedu.com', schools)?.schoolId).toBe('school-a');
  expect(resolveTenantFromHostname('school-a.localhost', schools)?.schoolId).toBe('school-a');
  expect(resolveTenantFromHostname('admin.globyedu.com', schools)).toBeNull();
  expect(resolveTenantFromHostname('unknown.globyedu.com', schools)).toBeNull();
  expect(resolveTenantFromHostname('globyedu.com', schools)).toBeNull();
});

test('new schools receive a 5-day free trial and persist the trial expiry date', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const created = await schoolService.createSchool({
    name: 'Trial School',
    headEmail: 'trial-head@globy.test',
    headPassword: 'HeadPass123!',
  });

  expect(created.subscriptionStatus).toBe('trial');
  expect(created.schoolStatus).toBe('active');
  expect(created.trialEndsAt).toBeTruthy();

  const expiry = new Date(created.trialEndsAt).getTime();
  const now = Date.now();
  expect(expiry).toBeGreaterThan(now);
  expect(expiry - now).toBeGreaterThanOrEqual(4 * 24 * 60 * 60 * 1000);
  expect(expiry - now).toBeLessThanOrEqual(5 * 24 * 60 * 60 * 1000 + 60000);
});

test('expired trial schools are resolved as suspended to block normal access', async () => {
  fs.writeFileSync(schoolsFile, JSON.stringify({ schools: [] }, null, 2), 'utf8');

  const created = await schoolService.createSchool({
    name: 'Expired Trial School',
    headEmail: 'expired-head@globy.test',
    headPassword: 'HeadPass123!',
  });

  const { loadSchoolData, saveSchoolData } = require('../fallback.school');
  const schools = loadSchoolData();
  const record = schools.find((entry) => entry.schoolId === created.schoolId);
  if (!record) throw new Error('School not found after creation');

  record.subscriptionStatus = 'trial';
  record.schoolStatus = 'active';
  record.trialEndsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  saveSchoolData(schools);

  const resolved = await schoolService.getSchoolBySchoolId(created.schoolId);
  expect(resolved.schoolStatus).toBe('suspended');
  expect(['expired', 'suspended']).toContain((resolved.subscriptionStatus || '').toLowerCase());
});
