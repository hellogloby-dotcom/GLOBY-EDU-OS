const bcrypt = require('bcrypt');
const config = require('../../config/auth.config');
const {
  loadSchoolData,
  saveSchoolData,
  findPlatformAdmins,
  createSchoolId,
  ensureDemoSchool,
} = require('../school/fallback.school');

function sanitizePlatformAdmin(user, school) {
  const { password, passwordHash, studentPasswordHash, ...safeUser } = user || {};
  return { ...safeUser, schoolId: school.schoolId, schoolName: school.name };
}

function assertStrongPassword(password) {
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(password || ''))) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
  }
}

async function listPlatformAdmins(search) {
  const schools = loadSchoolData();
  if (schools.length === 0) {
    ensureDemoSchool();
  }
  return findPlatformAdmins(loadSchoolData(), search);
}

async function createPlatformAdmin(payload) {
  const schools = loadSchoolData();
  let school = schools.find((entry) => entry.schoolId === 'globy-school');
  if (!school) {
    school = ensureDemoSchool();
  }

  if (!payload.email || !payload.fullName || !payload.password) {
    throw new Error('Email, full name, and password are required.');
  }
  assertStrongPassword(payload.password);

  const normalizedEmail = payload.email.toLowerCase();
  const existing = (school.users || []).find((user) => user.username.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error('A platform administrator with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(payload.password, config.bcrypt.saltRounds);
  const adminUser = {
    username: normalizedEmail,
    passwordHash,
    role: 'super_admin',
    grade: 'N/A',
    fullName: payload.fullName,
    status: payload.status || 'active',
    emailVerified: true,
    platformAdmin: true,
    permissions: payload.permissions || ['platform.manage', 'schools.manage'],
  };

  if (!Array.isArray(school.users)) {
    school.users = [];
  }
  school.users.push(adminUser);
  saveSchoolData(schools);
  return sanitizePlatformAdmin(adminUser, school);
}

async function findPlatformAdmin(email) {
  const schools = loadSchoolData();
  for (const school of schools) {
    const user = (school.users || []).find(
      (entry) => entry.username.toLowerCase() === email.toLowerCase() && entry.platformAdmin === true
    );
    if (user) {
      return { user, school };
    }
  }
  return null;
}

async function updatePlatformAdmin(email, updates) {
  const schools = loadSchoolData();
  for (const school of schools) {
    const user = (school.users || []).find(
      (entry) => entry.username.toLowerCase() === email.toLowerCase() && entry.platformAdmin === true
    );
    if (!user) continue;

    if (updates.fullName) user.fullName = updates.fullName;
    if (typeof updates.status === 'string') user.status = updates.status;
    if (Array.isArray(updates.permissions)) user.permissions = updates.permissions;
    if (typeof updates.platformAdmin === 'boolean') user.platformAdmin = updates.platformAdmin;
    if (updates.password) {
      assertStrongPassword(updates.password);
      user.passwordHash = await bcrypt.hash(updates.password, config.bcrypt.saltRounds);
      user.passwordNeedsReset = updates.temporary !== false;
      user.passwordChangedAt = new Date().toISOString();
    }
    saveSchoolData(schools);
    return sanitizePlatformAdmin(user, school);
  }
  throw new Error('Platform administrator not found.');
}

async function removePlatformAdmin(email) {
  const schools = loadSchoolData();
  for (const school of schools) {
    const index = (school.users || []).findIndex(
      (entry) => entry.username.toLowerCase() === email.toLowerCase() && entry.platformAdmin === true
    );
    if (index !== -1) {
      const [removed] = school.users.splice(index, 1);
      saveSchoolData(schools);
      return sanitizePlatformAdmin(removed, school);
    }
  }
  throw new Error('Platform administrator not found.');
}

async function resetPlatformAdminPassword(email, newPassword) {
  assertStrongPassword(newPassword);
  const schools = loadSchoolData();
  for (const school of schools) {
    const user = (school.users || []).find(
      (entry) => entry.username.toLowerCase() === email.toLowerCase() && entry.platformAdmin === true
    );
    if (user) {
      user.passwordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
      user.passwordNeedsReset = true;
      user.passwordChangedAt = new Date().toISOString();
      saveSchoolData(schools);
      return sanitizePlatformAdmin(user, school);
    }
  }
  throw new Error('Platform administrator not found.');
}

module.exports = {
  listPlatformAdmins,
  createPlatformAdmin,
  updatePlatformAdmin,
  removePlatformAdmin,
  resetPlatformAdminPassword,
  findPlatformAdmin,
};
