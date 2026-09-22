// school.service.js
// Business logic for School core entity. Supports both Prisma-backed and fallback JSON file persistence.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../../config/prisma.client');
const config = require('../../config/auth.config');
const firebaseCore = require('../../firebase.core');
const { listPricingPlans } = require('../pricing/pricing.service');
const { generateSchoolSubdomain } = require('./tenant-hostname');
const {
  loadSchoolData,
  saveSchoolData,
  createSchoolId,
  ensureSchoolEntities,
  findSchoolBySchoolId,
  createSchoolEntity,
  updateSchoolEntity,
  deleteSchoolEntity,
  searchSchoolEntities,
  createTeacherRecord,
  createStudentRecord,
  ensureWorkspaceCollections,
  normalizeWorkspaceMessage,
  normalizeSupportTicket,
} = require('./fallback.school');

const entityConfig = {
  departments: { field: 'departments', model: 'department', idKey: 'id' },
  streams: { field: 'streams', model: 'stream', idKey: 'id' },
  subjects: { field: 'subjects', model: 'subject', idKey: 'id' },
  'academic-years': { field: 'academicYears', model: 'academicYear', idKey: 'id' },
  academicYears: { field: 'academicYears', model: 'academicYear', idKey: 'id' },
  terms: { field: 'terms', model: 'term', idKey: 'id' },
  semesters: { field: 'semesters', model: 'semester', idKey: 'id' },
  classes: { field: 'classes', model: 'class', idKey: 'id' },
  teachers: { field: 'teachers', roleName: 'teacher', idKey: 'email' },
  students: { field: 'students', roleName: 'student', idKey: 'email' },
};

const TEACHER_ASSIGNABLE_CLASSES = new Set([
  'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
  'JHS 1', 'JHS 2', 'JHS 3',
  'SHS 1', 'SHS 2', 'SHS 3',
]);

function normalizeTeacherAssignedClasses(value) {
  const classes = normalizeArray(value);
  return classes;
}

function normalizeEntityType(entityType) {
  const mapping = {
    departments: 'departments',
    streams: 'streams',
    subjects: 'subjects',
    'academic-years': 'academicYears',
    academicYears: 'academicYears',
    terms: 'terms',
    semesters: 'semesters',
    classes: 'classes',
    teachers: 'teachers',
    students: 'students',
  };
  return mapping[entityType] || null;
}

function getEntityModel(entityType) {
  const configEntry = entityConfig[entityType];
  return configEntry ? configEntry.model : null;
}

function getEntityIdKey(entityType, usePrisma = false) {
  if (entityType === 'classes') {
    return usePrisma ? 'id' : 'classId';
  }
  if (entityType === 'students') {
    return usePrisma ? 'email' : 'studentId';
  }
  if (entityType === 'teachers') {
    return usePrisma ? 'email' : 'username';
  }
  return 'id';
}

async function loadTenantWithRelations(schoolId) {
  return prisma.tenant.findUnique({
    where: { schoolId },
    include: {
      departments: true,
      streams: true,
      subjects: true,
      academicYears: true,
      terms: true,
      semesters: true,
      classes: true,
      users: true,
    },
  });
}

async function findOrCreateRole(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Role name is required');
  }
  return prisma.role.upsert({
    where: { name: normalized },
    update: {},
    create: {
      name: normalized,
      description: `${normalized.charAt(0).toUpperCase() + normalized.slice(1)} role`,
    },
  });
}

function splitFullName(fullName) {
  const value = String(fullName || '').trim();
  if (!value) return { firstName: null, lastName: null };
  const parts = value.split(/\s+/);
  return {
    firstName: parts.slice(0, -1).join(' ') || parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : null,
  };
}

function generateTeacherId() {
  return `TCH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getUserRoleList(actor = {}) {
  const roles = Array.isArray(actor.roles) ? actor.roles : [];
  return roles.map((role) => String(role).trim().toLowerCase()).filter(Boolean);
}

function hasSchoolAuthorityRole(actor = {}) {
  const roles = getUserRoleList(actor);
  return roles.some((role) => ['super_admin', 'school_authority', 'school_head'].includes(role));
}

function restrictNonAuthorityUpdates(entityType, updates = {}, actor = {}) {
  if (hasSchoolAuthorityRole(actor)) return updates;
  const protectedFields = ['schoolId', 'tenantId', 'role', 'roles', 'permissions', 'classId', 'className', 'assignedClasses', 'assignedSubjects', 'status'];
  const sanitized = { ...updates };
  if (entityType === 'teachers' || entityType === 'students') {
    protectedFields.forEach((field) => delete sanitized[field]);
    delete sanitized.passwordHash;
    delete sanitized.studentPasswordHash;
    delete sanitized.passwordNeedsReset;
  }
  return sanitized;
}

function isTenantMatch(actor = {}, schoolId) {
  const actorSchoolId = String(actor.schoolId || actor.tenantId || '').trim();
  return !actorSchoolId || actorSchoolId === String(schoolId || '').trim();
}

function getActorClassScope(school, actor = {}) {
  const teacher = [...(Array.isArray(school.teachers) ? school.teachers : []), ...(Array.isArray(school.users) ? school.users : [])]
    .find((entry) => {
      const idValues = [entry.teacherId, entry.username, entry.email, entry.userId].filter(Boolean).map((value) => String(value).trim().toLowerCase());
      return idValues.includes(String(actor.userId || '').split(':').pop().toLowerCase()) || idValues.includes(String(actor.username || '').trim().toLowerCase());
    });

  const assignedClasses = normalizeArray(teacher?.assignedClasses || teacher?.classes || teacher?.className || teacher?.assignedClass);
  const classIdList = assignedClasses.filter((value) => typeof value === 'string').map((value) => String(value).trim().toLowerCase());
  return new Set(classIdList);
}

function resolveStudentByActor(school, actor = {}) {
  const identifier = String(actor.username || actor.userId || '').split(':').pop().trim().toLowerCase();
  const student = (Array.isArray(school.students) ? school.students : []).find((entry) => {
    const values = [entry.studentId, entry.username, entry.email, entry.id].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    return values.includes(identifier) || String(entry.fullName || '').trim().toLowerCase() === identifier;
  });
  if (student) return student;
  return (Array.isArray(school.users) ? school.users : []).find((entry) => entry.role === 'student' && [entry.username, entry.email, entry.studentId].some((value) => String(value || '').trim().toLowerCase() === identifier));
}

function normalizeAssignmentStatus(dueDate, currentStatus) {
  if (currentStatus && currentStatus !== 'assigned') return currentStatus;
  if (!dueDate) return 'assigned';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'assigned';
  return due.getTime() < Date.now() ? 'late' : 'assigned';
}

function resolveTeacherAuthorization(school, actor = {}, classId = '') {
  const roles = getUserRoleList(actor);
  if (roles.includes('school_authority') || roles.includes('super_admin')) return true;
  if (!roles.includes('teacher')) return false;

  const identifier = String(actor.username || actor.userId || '').split(':').pop().trim().toLowerCase();
  const teacher = [...(Array.isArray(school.teachers) ? school.teachers : []), ...(Array.isArray(school.users) ? school.users : [])].find((entry) => {
    const values = [entry.teacherId, entry.username, entry.email, entry.userId].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    return values.includes(identifier);
  });

  if (!teacher) return false;
  const classKey = String(classId || '').trim().toLowerCase();
  const assignedClasses = normalizeArray(teacher.assignedClasses || teacher.classes || teacher.className || teacher.assignedClass);
  const normalizedCandidates = assignedClasses.map((value) => String(value).trim().toLowerCase());
  const classMatches = (Array.isArray(school.classes) ? school.classes : []).some((entry) => {
    const currentClassId = String(entry.classId || entry.id || '').trim().toLowerCase();
    const currentName = String(entry.name || entry.className || '').trim().toLowerCase();
    return currentClassId === classKey || currentName === classKey || normalizedCandidates.includes(currentClassId) || normalizedCandidates.includes(currentName);
  });
  if (!classKey) return true;
  return classMatches || normalizedCandidates.includes(classKey) || String(teacher.teacherId || teacher.username || '').trim().toLowerCase() === classKey;
}

function resolveAssignmentOwnership(school, assignment, actor = {}) {
  const roles = getUserRoleList(actor);
  if (roles.includes('school_authority') || roles.includes('super_admin')) return true;
  if (!roles.includes('teacher')) return false;
  const actorId = String(actor.username || actor.userId || '').split(':').pop().trim().toLowerCase();
  const owner = String(assignment.teacherId || assignment.createdBy || assignment.owner || '').trim().toLowerCase();
  const teacherMatches = owner === actorId || owner === String(actor.userId || '').split(':').pop().trim().toLowerCase();
  return teacherMatches;
}

function resolveLessonOwnership(school, lesson, actor = {}) {
  const roles = getUserRoleList(actor);
  if (roles.includes('school_authority') || roles.includes('super_admin')) return true;
  if (!roles.includes('teacher')) return false;
  const actorId = String(actor.username || actor.userId || '').split(':').pop().trim().toLowerCase();
  const owner = String(lesson.teacherId || lesson.createdBy || '').trim().toLowerCase();
  return owner === actorId;
}

function resolveClassForStudent(school, actor = {}) {
  const student = resolveStudentByActor(school, actor);
  if (!student) return null;
  const classId = String(student.classId || '').trim().toLowerCase();
  const className = String(student.className || student.grade || '').trim().toLowerCase();
  return { classId, className, student };
}

function resolveStudentClassKeys(school, student) {
  const studentId = String(student?.studentId || student?.username || student?.id || '').trim().toLowerCase();
  const keys = new Set([String(student?.classId || '').trim().toLowerCase(), String(student?.className || student?.grade || '').trim().toLowerCase()].filter(Boolean));
  for (const currentClass of Array.isArray(school.classes) ? school.classes : []) {
    const roster = Array.isArray(currentClass.students) ? currentClass.students : [];
    const rosterMatch = studentId && roster.some((entry) => String(entry?.studentId || entry?.username || entry).trim().toLowerCase() === studentId);
    const studentClassName = String(student?.className || student?.grade || '').trim().toLowerCase();
    const classNameMatch = studentClassName && [currentClass.name, currentClass.className, currentClass.grade].some((value) => String(value || '').trim().toLowerCase() === studentClassName);
    if (rosterMatch || classNameMatch) {
      [currentClass.classId, currentClass.id, currentClass.name, currentClass.className, currentClass.grade].filter(Boolean).forEach((value) => keys.add(String(value).trim().toLowerCase()));
    }
  }
  return keys;
}

function ensureAcademicCollections(school) {
  if (!Array.isArray(school.assignments)) school.assignments = [];
  if (!Array.isArray(school.lessons)) school.lessons = [];
  return school;
}

function resolveSchoolLifecycleStatus(school = {}) {
  if (!school || typeof school !== 'object') {
    return school;
  }

  const normalized = { ...school };
  const schoolStatus = String(normalized.schoolStatus || normalized.status || '').trim().toLowerCase();
  const subscriptionStatus = String(normalized.subscriptionStatus || '').trim().toLowerCase();
  const manualSuspended = ['suspended', 'inactive', 'blocked', 'disabled'].includes(schoolStatus) || ['suspended', 'inactive', 'blocked', 'disabled'].includes(subscriptionStatus);
  const trialEndsAt = normalized.trialEndsAt ? new Date(normalized.trialEndsAt) : null;
  const hasExpiredTrial = Boolean(trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() <= Date.now());

  if (manualSuspended) {
    normalized.schoolStatus = 'suspended';
    normalized.subscriptionStatus = subscriptionStatus === 'expired' ? 'expired' : 'suspended';
    return normalized;
  }

  if (hasExpiredTrial && normalized.developmentOnly !== true) {
    normalized.schoolStatus = 'suspended';
    normalized.subscriptionStatus = 'expired';
    normalized.trialStatus = normalized.trialStatus || 'Expired';
    return normalized;
  }

  if (!normalized.schoolStatus && normalized.status) {
    normalized.schoolStatus = normalized.status;
  }

  if (!normalized.subscriptionStatus && normalized.schoolStatus) {
    normalized.subscriptionStatus = normalized.schoolStatus;
  }

  return normalized;
}

function buildDefaultSchoolSettings(data = {}) {
  return {
    attendanceEnabled: true,
    financeEnabled: true,
    reportsEnabled: true,
    announcementsEnabled: true,
    teacherPortalEnabled: true,
    studentPortalEnabled: true,
    messagingEnabled: true,
    aiEnabled: false,
    libraryEnabled: false,
    hostelEnabled: false,
    transportEnabled: false,
    payrollEnabled: false,
    parentPortalEnabled: false,
    currency: data.currency || 'GHS',
    language: data.language || 'English',
    timezone: data.timezone || 'UTC',
    academicCalendar: data.academicCalendar || null,
  };
}

function buildDefaultAcademicYear(tenantId, schoolName, startDate = new Date()) {
  const yearLabel = `${startDate.getFullYear()}/${startDate.getFullYear() + 1}`;
  const start = new Date(startDate.getFullYear(), 0, 1);
  const end = new Date(startDate.getFullYear() + 1, 0, 1);
  return {
    label: yearLabel,
    startDate: start,
    endDate: end,
    status: 'active',
    tenantId,
    name: `${schoolName} ${yearLabel}`,
  };
}

function collectSearchText(value, accumulator = []) {
  if (typeof value === 'string') {
    accumulator.push(value.toLowerCase());
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectSearchText(item, accumulator));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectSearchText(item, accumulator));
  }
  return accumulator;
}

function buildSearchFilter(items, search, status) {
  let filtered = Array.isArray(items) ? [...items] : [];
  if (status) {
    filtered = filtered.filter((item) => item.status === status);
  }
  if (search) {
    const lower = search.toLowerCase();
    filtered = filtered.filter((item) => {
      const textValues = collectSearchText(item);
      return textValues.some((value) => value.includes(lower));
    });
  }
  return filtered;
}

function paginate(items, page = 1, pageSize = 20) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total,
    items: items.slice(start, start + pageSize),
  };
}

async function fetchUsersByRole(tenantId, roleName) {
  return prisma.user.findMany({
    where: {
      tenantId,
      roles: {
        some: {
          role: { name: roleName },
        },
      },
    },
  });
}

function mapUserEntity(user, roleName) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const metadata = user.metadata || {};
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || null,
    middleName: metadata.middleName || null,
    lastName: user.lastName || null,
    fullName: fullName || user.email,
    gender: metadata.gender || null,
    dateOfBirth: metadata.dateOfBirth || null,
    phone: user.phone || metadata.phone || null,
    altPhone: metadata.altPhone || null,
    nationality: metadata.nationality || null,
    nationalId: metadata.nationalId || null,
    address: metadata.address || null,
    status: user.status,
    role: roleName,
    profilePhoto: user.profilePhoto || metadata.profilePhoto || null,
    signature: metadata.signature || null,
    teacherId: metadata.teacherId || null,
    employeeNumber: metadata.employeeNumber || null,
    employmentDate: metadata.employmentDate || null,
    employmentType: metadata.employmentType || null,
    department: metadata.department || null,
    position: metadata.position || null,
    qualification: metadata.qualification || null,
    yearsOfExperience: metadata.yearsOfExperience || null,
    currentAcademicYear: metadata.currentAcademicYear || null,
    currentTerm: metadata.currentTerm || null,
    assignedClasses: normalizeArray(metadata.assignedClasses),
    classId: metadata.classId || null,
    assignedSubjects: normalizeArray(metadata.assignedSubjects),
    classTeacher: metadata.classTeacher || false,
    houseMaster: metadata.houseMaster || false,
    leaveStatus: metadata.leaveStatus || null,
    pendingApproval: metadata.pendingApproval || false,
    performance: metadata.performance || {},
    activityLog: normalizeArray(metadata.activityLog),
    documents: normalizeArray(metadata.documents),
    metadata,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function createSchool(data) {
  if (firebaseCore.isFirebaseCoreMode()) {
    return createSchoolFirebase(data);
  }

  if (prisma && prisma.__stub) {
    return createSchoolFallback(data);
  }

  if (!data || !data.name) {
    throw new Error('School name is required');
  }

  const schoolId = data.schoolId || `school-${createSchoolId(data.name)}`;
  const subdomain = data.subdomain || generateSchoolSubdomain(data.name, await prisma.tenant.findMany({ select: { subdomain: true } }).catch(() => []));
  const now = new Date();
  const headEmail = (data.headEmail || `head@${schoolId}.globyedu.com`).toLowerCase();
  const headPassword = data.headPassword || `Head@${Math.random().toString(36).slice(2, 8)}`;
  const headFullName = data.headFullName || 'School Head';
  const trailEndsAt = data.trialEndsAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const payload = {
    schoolId,
    subdomain,
    name: data.name,
    country: data.country || null,
    timezone: data.timezone || null,
    branding: data.branding || null,
    subscriptionPlan: data.subscriptionPlan || '5-Day Trial',
    subscriptionStatus: data.subscriptionStatus || 'trial',
    trialEndsAt: trailEndsAt,
    expiresAt: data.expiresAt || trailEndsAt,
    status: data.schoolStatus || 'active',
    createdAt: now,
    updatedAt: now,
  };

  const tenant = await prisma.tenant.create({ data: payload }).catch((err) => {
    throw new Error('Failed to create school: ' + (err.message || err));
  });

  const defaultAcademicYear = buildDefaultAcademicYear(tenant.id, data.name, new Date());
  await prisma.academicYear.create({
    data: {
      label: defaultAcademicYear.label,
      startDate: defaultAcademicYear.startDate,
      endDate: defaultAcademicYear.endDate,
      status: defaultAcademicYear.status,
      tenant: { connect: { id: tenant.id } },
    },
  }).catch((err) => {
    throw new Error('Failed to create default academic year: ' + (err.message || err));
  });

  const defaultRoles = await Promise.all([
    findOrCreateRole('school_head'),
    findOrCreateRole('teacher'),
    findOrCreateRole('student'),
  ]);

  const { firstName, lastName } = splitFullName(headFullName);
  const passwordHash = await bcrypt.hash(headPassword, config.bcrypt.saltRounds);

  const user = await prisma.user.create({
    data: {
      email: headEmail,
      firstName,
      lastName,
      passwordHash,
      status: 'active',
      isVerified: true,
      tenant: {
        connect: { id: tenant.id },
      },
    },
  }).catch((err) => {
    throw new Error('Failed to create school head account: ' + (err.message || err));
  });

  const headRole = defaultRoles.find((role) => role.name === 'school_head');
  if (headRole) {
    await prisma.userRole.create({
      data: {
        user: { connect: { id: user.id } },
        role: { connect: { id: headRole.id } },
      },
    }).catch((err) => {
      throw new Error('Failed to assign school head role: ' + (err.message || err));
    });
  }

  const headAccount = {
    username: user.email,
    password: headPassword,
  };

  return { ...tenant, headAccount };
}

async function createSchoolFirebase(data) {
  if (!data || !data.name) throw new Error('School name is required');

  const schoolId = data.schoolId || `school-${createSchoolId(data.name)}`;
  const school = await firebaseCore.getTenant(schoolId);
  if (school) throw new Error('A school with that ID already exists');

  const now = new Date().toISOString();
  const trialEndsAt = data.trialEndsAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const subdomain = data.subdomain || generateSchoolSubdomain(data.name, []);
  const headEmail = String(data.headEmail || `head@${schoolId}.globyedu.com`).trim().toLowerCase();
  const headPassword = data.headPassword || `Head@${Math.random().toString(36).slice(2, 8)}`;
  const headFullName = data.headFullName || 'School Head';
  const tenant = await firebaseCore.saveTenant(schoolId, {
    id: schoolId,
    name: data.name,
    subdomain,
    email: data.email || headEmail,
    headName: headFullName,
    headEmail,
    description: data.description || `Tenant school created by ${data.name}`,
    country: data.country || null,
    region: data.region || null,
    city: data.city || null,
    address: data.address || null,
    phone: data.phone || null,
    branding: data.branding || null,
    subscriptionPlan: data.subscriptionPlan || '5-Day Trial',
    subscriptionStatus: data.subscriptionStatus || 'trial',
    trialEndsAt,
    expiresAt: data.expiresAt || trialEndsAt,
    schoolStatus: data.schoolStatus || 'active',
    status: data.schoolStatus || 'active',
    createdAt: now,
  }, false);

  const passwordHash = await bcrypt.hash(headPassword, config.bcrypt.saltRounds);
  await firebaseCore.saveById('users', `${schoolId}:${headEmail}`, {
    schoolId,
    tenantId: schoolId,
    username: headEmail,
    email: headEmail,
    fullName: headFullName,
    role: 'school_head',
    status: 'active',
    passwordHash,
    passwordNeedsReset: !data.headPassword,
    createdAt: now,
  }, false);
  await firebaseCore.saveById('roles', `${schoolId}:school_head`, { schoolId, name: 'school_head', permissions: ['school.manage', 'classes.manage', 'users.manage'] }, true);
  await firebaseCore.saveById('classes', `${schoolId}:class-01`, { schoolId, classId: 'class-01', name: 'Form 1', grade: data.defaultClassGrade || 'Grade 10', status: 'active', students: [] }, false);
  await firebaseCore.saveById('enrollments', `${schoolId}:${headEmail}`, { schoolId, userId: `${schoolId}:${headEmail}`, role: 'school_head', status: 'active', createdAt: now }, false);

  return { ...tenant, headAccount: { username: headEmail, password: headPassword } };
}

async function createSchoolFallback(data) {
  if (!data || !data.name) {
    throw new Error('School name is required');
  }

  const schools = loadSchoolData();
  const schoolId = data.schoolId || createSchoolId(data.name, schools);
  const subdomain = data.subdomain || generateSchoolSubdomain(data.name, schools);
  const lowerName = data.name.trim().toLowerCase();
  const existing = schools.find(
    (school) =>
      school.schoolId === schoolId || school.name.toLowerCase() === lowerName || school.subdomain === subdomain
  );
  if (existing) {
    throw new Error('A school with that name or ID already exists');
  }

  const headEmail = (data.headEmail || `head@${schoolId}.globyedu.com`).toLowerCase();
  const headFullName = data.headFullName || 'School Head';
  const headPassword = data.headPassword || `Head@${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(headPassword, config.bcrypt.saltRounds);
  const trialEndsAt = data.trialEndsAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const newSchool = {
    id: schoolId,
    schoolId,
    subdomain,
    name: data.name,
    headName: headFullName,
    headEmail,
    description: data.description || `Tenant school created by ${data.name}`,
    logo: data.logo || null,
    coverImage: data.coverImage || null,
    website: data.website || null,
    country: data.country || null,
    region: data.region || null,
    city: data.city || null,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    timezone: data.timezone || null,
    branding: data.branding || null,
    subscriptionPlan: data.subscriptionPlan || '5-Day Trial',
    subscriptionStatus: data.subscriptionStatus || 'trial',
    trialStatus: data.trialStatus || '5-Day Trial',
    trialEndsAt: trialEndsAt,
    schoolStatus: data.schoolStatus || 'active',
    academicYears: [
      {
        id: `ay-${Date.now()}`,
        label: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        endDate: new Date(new Date().getFullYear() + 1, 0, 1).toISOString(),
        status: 'active',
      },
    ],
    settings: data.settings || buildDefaultSchoolSettings(data),
    classes: data.classes || [
      {
        classId: 'class-01',
        name: 'Form 1',
        grade: data.defaultClassGrade || 'Grade 10',
        teacher: headEmail,
        students: [],
        status: 'active',
      },
    ],
    users: [
      {
        username: headEmail,
        passwordHash,
        role: 'school_head',
        grade: 'N/A',
        fullName: headFullName,
        status: 'active',
        emailVerified: true,
        platformAdmin: false,
        permissions: ['school.manage', 'classes.manage', 'users.manage'],
      },
    ],
  };

  schools.push(newSchool);
  saveSchoolData(schools);

  return {
    ...newSchool,
    headAccount: {
      username: headEmail,
      password: headPassword,
    },
  };
}

async function getSchoolById(id) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = schools.find((entry) => entry.id === id || entry.schoolId === id);
    return school || null;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id } }).catch(() => null);
  return tenant;
}

async function getSchoolBySchoolId(schoolId) {
  if (firebaseCore.isFirebaseCoreMode()) {
    const school = await firebaseCore.getSchoolAggregate(schoolId);
    return school ? resolveSchoolLifecycleStatus(school) : null;
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = schools.find((entry) => entry.schoolId === schoolId);
    if (!school) return null;
    return resolveSchoolLifecycleStatus(school);
  }
  const tenant = await prisma.tenant.findUnique({
    where: { schoolId },
    include: {
      users: {
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      },
      departments: true,
      streams: true,
      subjects: true,
      academicYears: true,
      terms: true,
      semesters: true,
      classes: true,
    },
  }).catch(() => null);
  if (!tenant) return null;

  const teachers = Array.isArray(tenant.users)
    ? tenant.users.filter((user) => Array.isArray(user.roles) ? user.roles.some((ur) => ur.role?.name === 'teacher') : false)
    : [];
  const students = Array.isArray(tenant.users)
    ? tenant.users.filter((user) => Array.isArray(user.roles) ? user.roles.some((ur) => ur.role?.name === 'student') : false)
    : [];

  const normalized = {
    ...tenant,
    teachers: teachers.map((user) => mapUserEntity(user, 'teacher')),
    students: students.map((user) => mapUserEntity(user, 'student')),
  };

  return resolveSchoolLifecycleStatus(normalized);
}

function getUserIdentifier(user = {}) {
  const userId = String(user.userId || '').trim();
  return userId.includes(':') ? userId.split(':').pop() : userId;
}

function sanitizeTeacherRecord(record = {}) {
  const { passwordHash, studentPasswordHash, password, ...safeRecord } = record;
  return safeRecord;
}

function sanitizeStudentRecord(record = {}) {
  const { passwordHash, studentPasswordHash, password, ...safeRecord } = record;
  return safeRecord;
}

function sanitizeSchoolResponse(school = {}) {
  const { users, teachers, students, ...safeSchool } = school;
  return {
    ...safeSchool,
    users: Array.isArray(users) ? users.map(sanitizeTeacherRecord) : [],
    teachers: Array.isArray(teachers) ? teachers.map(sanitizeTeacherRecord) : [],
    students: Array.isArray(students) ? students.map(sanitizeStudentRecord) : [],
  };
}

function getStudentSchoolView(school, user = {}) {
  if (!school) return null;

  const identifier = getUserIdentifier(user).toLowerCase();
  const students = Array.isArray(school.students) ? school.students : [];
  const users = Array.isArray(school.users) ? school.users : [];
  const student = [...students, ...users].find((entry) => {
    const values = [
      entry?.studentId,
      entry?.id,
      entry?.username,
      entry?.email,
      entry?.userId,
      entry?.student?.studentId,
    ];
    return values.some((value) => String(value || '').trim().toLowerCase() === identifier);
  });

  if (!student) {
    return {
      ...school,
      users: [],
      teachers: [],
      students: [],
      student: null,
      profile: null,
      classes: [],
      attendanceRecords: [],
      examRecords: [],
      examResults: [],
      announcements: [],
      messages: [],
      payments: [],
      fees: [],
      financeCategories: [],
      invoices: [],
      receipts: [],
      refunds: [],
      reports: [],
    };
  }

  const studentId = String(student.studentId || student.id || student.username || '').trim().toLowerCase();
  const className = String(student.className || student.gradeLevel || student.grade || '').trim().toLowerCase();
  const classId = String(student.classId || '').trim().toLowerCase();
  const relevantClasses = (Array.isArray(school.classes) ? school.classes : []).filter((entry) => {
    const entryClassId = String(entry.classId || entry.id || '').trim().toLowerCase();
    const entryName = String(entry.name || entry.className || '').trim().toLowerCase();
    const entryGrade = String(entry.grade || '').trim().toLowerCase();
    const classMembership = Array.isArray(entry.students) ? entry.students : [];
    const includesStudent = classMembership.some((item) => String(item).trim().toLowerCase() === studentId);
    return (!classId && !className) || entryClassId === classId || entryName === className || entryGrade === className || includesStudent || entryName.includes(className) || entryGrade.includes(className);
  });

  const attendanceRecords = (Array.isArray(school.attendanceRecords) ? school.attendanceRecords : []).filter((entry) => {
    const recordStudentId = String(entry.studentId || '').trim().toLowerCase();
    const recordClassName = String(entry.className || '').trim().toLowerCase();
    return recordStudentId === studentId || (recordClassName && className && recordClassName === className);
  });

  const examResults = (Array.isArray(school.examResults) ? school.examResults : []).filter((entry) => {
    const recordStudentId = String(entry.studentId || entry.student || '').trim().toLowerCase();
    return recordStudentId === studentId;
  });

  const announcements = (Array.isArray(school.announcements) ? school.announcements : []).filter((entry) => {
    const audience = String(entry.audience || entry.recipientType || entry.recipient || 'all').trim().toLowerCase();
    return audience === 'all' || audience === 'everyone' || audience === 'students' || audience === 'student';
  });

  const messages = (Array.isArray(school.messages) ? school.messages : []).filter((entry) => {
    const target = String(entry.recipientType || entry.audience || entry.recipient || 'all').trim().toLowerCase();
    const targetList = [target, ...(Array.isArray(entry.to) ? entry.to : [entry.to]).filter(Boolean).map((value) => String(value).trim().toLowerCase())];
    return targetList.includes('all') || targetList.includes('everyone') || targetList.includes('students') || targetList.includes('student') || targetList.includes(studentId) || targetList.includes(String(student.email || '').trim().toLowerCase()) || targetList.includes(String(student.username || '').trim().toLowerCase());
  });

  const payments = (Array.isArray(school.payments) ? school.payments : []).filter((entry) => {
    const ownerId = String(entry.studentId || entry.student || entry.userId || '').trim().toLowerCase();
    const ownerName = String(entry.studentName || entry.studentFullName || entry.fullName || '').trim().toLowerCase();
    const studentName = String(student.fullName || '').trim().toLowerCase();
    return ownerId === studentId || ownerName === studentName || String(entry.email || '').trim().toLowerCase() === String(student.email || '').trim().toLowerCase();
  });

  const sanitizedStudent = sanitizeStudentRecord(student);

  return {
    ...school,
    users: [],
    teachers: [],
    students: [],
    student: sanitizedStudent,
    profile: sanitizedStudent,
    classes: relevantClasses,
    attendanceRecords,
    examRecords: (Array.isArray(school.examRecords) ? school.examRecords : []).filter((entry) => {
      const entryClass = String(entry.className || entry.class || '').trim().toLowerCase();
      const entryStudent = String(entry.studentId || entry.student || '').trim().toLowerCase();
      return entryStudent === studentId || (entryClass && className && entryClass === className);
    }),
    examResults,
    announcements,
    messages,
    payments,
    fees: payments,
    financeCategories: [],
    invoices: [],
    receipts: (Array.isArray(school.receipts) ? school.receipts : []).filter((receipt) => payments.some((payment) => payment.receiptNumber === receipt.receiptNumber || payment.id === receipt.paymentId)),
    refunds: [],
    reports: [],
  };
}

function nextFinanceReference(items, prefix) {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d{6})$`);
  const next = (Array.isArray(items) ? items : []).reduce((highest, item) => {
    const match = String(item?.receiptNumber || item?.id || '').match(pattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(6, '0')}`;
}

async function createFeePayment(schoolId, input = {}, actor = {}) {
  if (!['school_head', 'school_authority', 'super_admin'].some((role) => (actor.roles || []).includes(role))) {
    throw new Error('You do not have permission to record fee payments.');
  }
  const school = await getSchoolBySchoolId(schoolId);
  if (!school) throw new Error('School not found');
  const requestedStudentId = String(input.studentId || '').trim().toLowerCase();
  const student = (Array.isArray(school.students) ? school.students : []).find((entry) => [entry.studentId, entry.id, entry.email].some((value) => String(value || '').trim().toLowerCase() === requestedStudentId));
  if (!student) throw new Error('A valid student from this school is required.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
  const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
  if (Number.isNaN(paymentDate.getTime())) throw new Error('Payment date is invalid.');
  const status = String(input.status || 'received').trim().toLowerCase();
  if (!new Set(['received', 'paid', 'complete', 'completed']).has(status)) throw new Error('Only successful payments can generate a receipt.');

  const payments = Array.isArray(school.payments) ? school.payments : [];
  const receipts = Array.isArray(school.receipts) ? school.receipts : [];
  const receiptNumber = nextFinanceReference(receipts, 'RCPT');
  const paymentId = nextFinanceReference(payments, 'PMT');
  const academicYear = input.academicYear || school.academicYear || school.settings?.academicYear || null;
  const term = input.term || school.currentTerm || school.settings?.term || null;
  const payment = {
    id: paymentId,
    schoolId,
    studentId: student.studentId || student.id || student.email,
    studentName: student.fullName || student.name || student.email,
    classId: student.classId || null,
    className: student.className || student.gradeLevel || student.grade || null,
    feeType: input.feeType || input.category || null,
    amount,
    paymentDate: paymentDate.toISOString(),
    paidAt: paymentDate.toISOString(),
    method: input.method || input.paymentMethod || null,
    reference: input.reference || null,
    academicYear,
    term,
    status,
    receiptNumber,
    note: input.note || '',
    recordedBy: actor.userId || null,
    createdAt: new Date().toISOString(),
  };
  const receipt = {
    receiptNumber,
    paymentId,
    schoolId,
    studentId: payment.studentId,
    student: payment.studentName,
    studentName: payment.studentName,
    className: payment.className,
    feeType: payment.feeType,
    amount,
    currency: school.currency || school.branding?.currency || school.settings?.currency || 'USD',
    paymentMethod: payment.method,
    paymentDate: payment.paymentDate,
    paidAt: payment.paidAt,
    academicYear,
    term,
    reference: payment.reference,
    status,
    authorizedBy: actor.userId || null,
    createdAt: payment.createdAt,
  };
  const updated = await updateSchool(school.id, { payments: [...payments, payment], receipts: [...receipts, receipt] });
  return { payment, receipt, school: sanitizeSchoolResponse(updated) };
}

function getTeacherSchoolView(school, user = {}) {
  if (!school) return null;
  const identifier = getUserIdentifier(user).toLowerCase();
  const teachers = Array.isArray(school.teachers) ? school.teachers : [];
  const users = Array.isArray(school.users) ? school.users : [];
  const teacher = [...teachers, ...users].find((entry) => [entry.teacherId, entry.username, entry.email, entry.userId]
    .some((value) => String(value || '').trim().toLowerCase() === identifier));
  const teacherIdentifiers = new Set([identifier, teacher?.teacherId, teacher?.username, teacher?.email]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  const assignedNames = new Set([
    ...(Array.isArray(teacher?.assignedClasses) ? teacher.assignedClasses : []),
    ...(Array.isArray(teacher?.classes) ? teacher.classes : []),
    teacher?.className,
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  const classes = (Array.isArray(school.classes) ? school.classes : []).filter((entry) => {
    const classId = String(entry.classId || entry.id || '').trim().toLowerCase();
    const classTeacher = String(entry.teacherId || entry.teacher || entry.classTeacher || '').trim().toLowerCase();
    const className = String(entry.name || entry.className || '').trim().toLowerCase();
    const grade = String(entry.grade || '').trim().toLowerCase();
    return teacherIdentifiers.has(classTeacher) || assignedNames.has(classId) || assignedNames.has(className) || assignedNames.has(grade);
  });
  const classIds = new Set(classes.map((entry) => String(entry.classId || entry.id || '').trim().toLowerCase()).filter(Boolean));
  const classNames = new Set(classes.flatMap((entry) => [entry.name, entry.className, entry.grade]).filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  assignedNames.forEach((name) => classNames.add(name));
  const students = (Array.isArray(school.students) ? school.students : []).filter((entry) => {
    const classId = String(entry.classId || '').trim().toLowerCase();
    const className = String(entry.className || entry.gradeLevel || entry.grade || '').trim().toLowerCase();
    return classIds.has(classId) || classNames.has(className);
  });
  const studentIds = new Set(students.map((entry) => String(entry.studentId || entry.id || entry.email || '').trim().toLowerCase()).filter(Boolean));
  const subjects = Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects : [];
  const subjectNames = new Set(subjects.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
  const exams = (Array.isArray(school.examRecords) ? school.examRecords : []).filter((entry) => {
    const examClass = String(entry.className || entry.class || entry.classroom || '').trim().toLowerCase();
    const examTeacher = String(entry.teacher || entry.teacherId || '').trim().toLowerCase();
    const examSubject = String(entry.subject || '').trim().toLowerCase();
    return classNames.has(examClass) || teacherIdentifiers.has(examTeacher) || (subjectNames.size > 0 && subjectNames.has(examSubject));
  });
  const results = (Array.isArray(school.examResults) ? school.examResults : []).filter((entry) => {
    const resultStudent = String(entry.studentId || entry.student || '').trim().toLowerCase();
    const resultClass = String(entry.className || entry.class || '').trim().toLowerCase();
    const resultSubject = String(entry.subject || '').trim().toLowerCase();
    return studentIds.has(resultStudent) || classNames.has(resultClass) || (subjectNames.size > 0 && subjectNames.has(resultSubject));
  });
  return {
    ...school,
    users: [],
    teachers: teacher ? [sanitizeTeacherRecord(teacher)] : [],
    classes,
    students: students.map(sanitizeTeacherRecord),
    attendanceRecords: (Array.isArray(school.attendanceRecords) ? school.attendanceRecords : []).filter((entry) => {
      const classId = String(entry.classId || '').trim().toLowerCase();
      const className = String(entry.className || '').trim().toLowerCase();
      return classIds.has(classId) || classNames.has(className);
    }),
    examRecords: exams,
    examResults: results,
    teacherProfile: teacher ? sanitizeTeacherRecord(teacher) : null,
    payments: [],
    financeCategories: [],
    invoices: [],
    receipts: [],
    refunds: [],
    reports: [],
    announcements: (Array.isArray(school.announcements) ? school.announcements : []).filter((entry) => {
      const audience = String(entry.audience || entry.recipientType || entry.recipient || 'all').trim().toLowerCase();
      return audience === 'all' || audience === 'everyone' || audience === 'teachers' || audience === 'teacher';
    }),
    messages: (Array.isArray(school.messages) ? school.messages : []).filter((entry) => {
      const target = String(entry.recipientType || entry.audience || entry.recipient || 'all').trim().toLowerCase();
      return target === 'all' || target === 'teachers' || target === 'teacher' || teacherIdentifiers.has(target);
    }),
  };
}

function updateTeacherWorkspace(school, user = {}, updates = {}) {
  const teacherView = getTeacherSchoolView(school, user);
  if (!teacherView?.teacherProfile) throw new Error('Teacher profile not found');
  const allowedStudentIds = new Set(teacherView.students.map((entry) => String(entry.studentId || entry.id || entry.email || '').trim().toLowerCase()).filter(Boolean));
  const allowedClassNames = new Set(teacherView.classes.flatMap((entry) => [entry.name, entry.className, entry.grade]).filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  const currentAttendance = Array.isArray(school.attendanceRecords) ? school.attendanceRecords : [];
  const currentResults = Array.isArray(school.examResults) ? school.examResults : [];
  if (updates.attendanceRecords !== undefined) {
    const submitted = Array.isArray(updates.attendanceRecords) ? updates.attendanceRecords : [];
    const validSubmitted = submitted.filter((entry) => {
      const studentId = String(entry.studentId || '').trim().toLowerCase();
      const className = String(entry.className || '').trim().toLowerCase();
      return allowedStudentIds.has(studentId) && allowedClassNames.has(className);
    });
    const managedKeys = new Set(validSubmitted.map((entry) => `${entry.date || ''}|${entry.className || ''}|${entry.studentId || ''}`));
    school.attendanceRecords = currentAttendance
      .filter((entry) => !managedKeys.has(`${entry.date || ''}|${entry.className || ''}|${entry.studentId || ''}`))
      .concat(validSubmitted);
  }
  if (updates.examResults !== undefined) {
    const submitted = Array.isArray(updates.examResults) ? updates.examResults : [];
    const validSubmitted = submitted.filter((entry) => {
      const studentId = String(entry.studentId || entry.student || '').trim().toLowerCase();
      const className = String(entry.className || entry.class || '').trim().toLowerCase();
      return allowedStudentIds.has(studentId) || allowedClassNames.has(className);
    });
    const managedKeys = new Set(validSubmitted.map((entry) => `${entry.student || entry.studentId || ''}|${entry.subject || ''}|${entry.exam || ''}|${entry.term || ''}|${entry.academicYear || ''}`.toLowerCase()));
    school.examResults = currentResults
      .filter((entry) => !managedKeys.has(`${entry.student || entry.studentId || ''}|${entry.subject || ''}|${entry.exam || ''}|${entry.term || ''}|${entry.academicYear || ''}`.toLowerCase()))
      .concat(validSubmitted);
  }
  if (updates.teacherProfile && typeof updates.teacherProfile === 'object') {
    const allowedFields = ['fullName', 'email', 'phone', 'department', 'position', 'qualification', 'profilePhoto'];
    const profileUpdates = Object.fromEntries(allowedFields.filter((field) => updates.teacherProfile[field] !== undefined).map((field) => [field, updates.teacherProfile[field]]));
    Object.assign(teacherView.teacherProfile, profileUpdates);
    const identifiers = [teacherView.teacherProfile.teacherId, teacherView.teacherProfile.username, teacherView.teacherProfile.email].filter(Boolean).map((value) => String(value).toLowerCase());
    [ ...(Array.isArray(school.teachers) ? school.teachers : []), ...(Array.isArray(school.users) ? school.users : []) ].forEach((entry) => {
      if ([entry.teacherId, entry.username, entry.email].some((value) => identifiers.includes(String(value || '').toLowerCase()))) Object.assign(entry, profileUpdates);
    });
  }
  return school;
}

async function updateSchool(id, updates) {
  const { city, schoolType, schoolLevel, motto, ...tenantUpdates } = updates || {};
  const existingBranding = updates?.branding && typeof updates.branding === 'object' ? updates.branding : {};
  const branding = (city !== undefined || schoolType !== undefined || schoolLevel !== undefined || motto !== undefined || Object.keys(existingBranding).length)
    ? {
        ...(updates?.branding && typeof updates.branding === 'object' ? updates.branding : {}),
        ...(city !== undefined ? { city } : {}),
        ...(schoolType !== undefined ? { schoolType } : {}),
        ...(schoolLevel !== undefined ? { schoolLevel } : {}),
        ...(motto !== undefined ? { motto } : {}),
      }
    : undefined;

  if (firebaseCore.isFirebaseCoreMode()) {
    const school = await firebaseCore.getTenant(id);
    if (!school) throw new Error('School not found');
    const updated = await firebaseCore.saveTenant(id, {
      ...tenantUpdates,
      ...(branding ? { branding } : {}),
      schoolId: id,
    });
    return resolveSchoolLifecycleStatus({ ...school, ...updated });
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const index = schools.findIndex((entry) => entry.id === id || entry.schoolId === id);
    if (index === -1) {
      throw new Error('School not found');
    }
    const school = schools[index];
    const updated = {
      ...school,
      ...tenantUpdates,
      ...(branding ? { branding } : {}),
      id: school.id || school.schoolId,
      schoolId: school.schoolId,
      updatedAt: new Date().toISOString(),
    };
    schools[index] = updated;
    saveSchoolData(schools);
    return updated;
  }

  const data = { ...tenantUpdates };
  if (branding) data.branding = branding;
  if (data.schoolId) {
    delete data.schoolId;
  }

  const updated = await prisma.tenant.update({ where: { id }, data }).catch((err) => {
    throw new Error('Failed to update school: ' + (err.message || err));
  });
  return updated;
}

function generateTemporaryPassword() {
  return `Temp!${crypto.randomBytes(9).toString('base64url')}A1`;
}

async function updateSchoolCredentials(schoolId, updates = {}) {
  const requestedEmail = updates.email === undefined ? undefined : String(updates.email).trim().toLowerCase();
  const hasPassword = typeof updates.password === 'string' && updates.password.length > 0;
  const shouldUpdatePassword = updates.updatePassword !== false;
  const temporary = updates.temporary !== false;
  const nextPassword = hasPassword ? updates.password : generateTemporaryPassword();

  if (requestedEmail !== undefined && !requestedEmail) throw new Error('School email cannot be empty.');
  if (shouldUpdatePassword && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(nextPassword)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = schools.find((entry) => entry.schoolId === schoolId);
    if (!school) throw new Error('School not found');
    const users = Array.isArray(school.users) ? school.users : [];
    const account = users.find((entry) => ['school_head', 'school_authority'].includes(String(entry.role || '').toLowerCase()));
    if (!account) throw new Error('School authority account not found');
    if (requestedEmail !== undefined) {
      const duplicate = users.find((entry) => entry !== account && String(entry.username || entry.email || '').toLowerCase() === requestedEmail);
      if (duplicate) throw new Error('That school email is already in use.');
      account.username = requestedEmail;
      account.email = requestedEmail;
      school.headEmail = requestedEmail;
      school.email = requestedEmail;
    }
    if (shouldUpdatePassword) {
      account.passwordHash = await bcrypt.hash(nextPassword, config.bcrypt.saltRounds);
      delete account.studentPasswordHash;
      account.passwordNeedsReset = temporary;
      account.passwordChangedAt = new Date().toISOString();
    }
    if (typeof updates.status === 'string' && updates.status.trim()) {
      account.status = updates.status.trim().toLowerCase();
    }
    saveSchoolData(schools);
    return {
      schoolId: school.schoolId,
      email: account.username,
      status: account.status || 'active',
      passwordNeedsReset: account.passwordNeedsReset === true,
      passwordChangedAt: account.passwordChangedAt,
      ...(shouldUpdatePassword && temporary ? { temporaryPassword: nextPassword } : {}),
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { schoolId },
    include: { users: { include: { roles: { include: { role: true } } } } },
  });
  if (!tenant) throw new Error('School not found');
  const account = (tenant.users || []).find((entry) => (entry.roles || []).some((item) => ['school_head', 'school_authority'].includes(item.role?.name)));
  if (!account) throw new Error('School authority account not found');
  const updateData = shouldUpdatePassword ? {
    passwordHash: await bcrypt.hash(nextPassword, config.bcrypt.saltRounds),
    passwordNeedsReset: temporary,
    passwordChangedAt: new Date(),
  } : {};
  if (requestedEmail !== undefined) updateData.email = requestedEmail;
  if (typeof updates.status === 'string' && updates.status.trim()) updateData.status = updates.status.trim().toLowerCase();
  const updated = await prisma.user.update({ where: { id: account.id }, data: updateData });
  return {
    schoolId: tenant.schoolId,
    email: updated.email,
    status: updated.status,
    passwordNeedsReset: updated.passwordNeedsReset === true,
    passwordChangedAt: updated.passwordChangedAt,
    ...(shouldUpdatePassword && temporary ? { temporaryPassword: nextPassword } : {}),
  };
}

async function deleteSchool(id) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const index = schools.findIndex((entry) => entry.id === id || entry.schoolId === id);
    if (index === -1) {
      throw new Error('School not found');
    }
    const school = schools[index];
    const updated = {
      ...school,
      schoolStatus: 'suspended',
      subscriptionStatus: 'suspended',
      trialStatus: 'Suspended',
      id: school.id || school.schoolId,
    };
    schools[index] = updated;
    saveSchoolData(schools);
    return updated;
  }

  const updated = await prisma.tenant.update({ where: { id }, data: { status: 'suspended', subscriptionStatus: 'suspended' } }).catch((err) => {
    throw new Error('Failed to suspend school: ' + (err.message || err));
  });
  return updated;
}

async function activateSchool(id) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const index = schools.findIndex((entry) => entry.id === id || entry.schoolId === id);
    if (index === -1) {
      throw new Error('School not found');
    }
    const school = schools[index];
    const updated = {
      ...school,
      schoolStatus: 'active',
      status: 'active',
      subscriptionStatus: school.subscriptionStatus === 'expired' || school.subscriptionStatus === 'suspended' ? 'trial' : school.subscriptionStatus || 'active',
      trialStatus: school.subscriptionStatus === 'expired' ? '5-Day Trial' : school.trialStatus || 'Active',
      trialEndsAt: school.trialEndsAt && new Date(school.trialEndsAt).getTime() > Date.now()
        ? school.trialEndsAt
        : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      id: school.id || school.schoolId,
    };
    schools[index] = updated;
    saveSchoolData(schools);
    return updated;
  }

  const updated = await prisma.tenant.update({ where: { id }, data: { status: 'active', subscriptionStatus: 'active' } }).catch((err) => {
    throw new Error('Failed to activate school: ' + (err.message || err));
  });
  return updated;
}

async function listSchools(search) {
  const keepOnlyGlobySchool = (schools) => {
    const primary = schools.filter((school) => {
      const schoolId = String(school?.schoolId || '').trim().toLowerCase();
      const name = String(school?.name || '').trim().toLowerCase();
      return schoolId === 'globy-school' || name === 'globy school';
    });
    return primary.length ? primary : schools;
  };

  const fallbackSchools = () => {
    const schools = keepOnlyGlobySchool(loadSchoolData()).map((school) => sanitizeSchoolResponse(resolveSchoolLifecycleStatus(school)));
    if (!search) return schools;
    const searchLower = String(search || '').toLowerCase();
    return schools.filter(
      (school) =>
        (school.name || '').toLowerCase().includes(searchLower) ||
        (school.schoolId || '').toLowerCase().includes(searchLower) ||
        (school.description || '').toLowerCase().includes(searchLower)
    );
  };

  if (prisma && prisma.__stub) {
    return fallbackSchools();
  }

  try {
    if (search) {
      const searchLower = String(search || '').toLowerCase();
      const tenants = keepOnlyGlobySchool(await prisma.tenant.findMany());
      return tenants.map((tenant) => sanitizeSchoolResponse(resolveSchoolLifecycleStatus(tenant))).filter(
        (tenant) =>
          (tenant.name || '').toLowerCase().includes(searchLower) ||
          (tenant.schoolId || '').toLowerCase().includes(searchLower) ||
          (tenant.description || '').toLowerCase().includes(searchLower)
      );
    }

    const tenants = keepOnlyGlobySchool(await prisma.tenant.findMany());
    return tenants.map((tenant) => sanitizeSchoolResponse(resolveSchoolLifecycleStatus(tenant)));
  } catch (error) {
    const message = String(error?.message || '');
    if (!/(Can't reach database server|database server|ECONNREFUSED|timeout|connect)/i.test(message)) {
      throw error;
    }
    return fallbackSchools();
  }
}

function countSchoolUsers(school, role) {
  if (Array.isArray(school.students) && role === 'student') return school.students.filter((entry) => String(entry.status || 'active').toLowerCase() !== 'archived').length;
  if (Array.isArray(school.teachers) && role === 'teacher') return school.teachers.filter((entry) => String(entry.status || 'active').toLowerCase() !== 'archived').length;
  return (Array.isArray(school.users) ? school.users : []).filter((user) => {
    const matchesRole = String(user.role || '').toLowerCase() === role || (Array.isArray(user.roles) && user.roles.some((entry) => String(entry.role?.name || entry.name || '').toLowerCase() === role));
    return matchesRole && String(user.status || 'active').toLowerCase() !== 'archived';
  }).length;
}

function buildGrowthSeries(items, days, dateField = 'createdAt') {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const buckets = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const date = new Date(item?.[dateField] || item?.created_at || '');
    if (Number.isNaN(date.getTime()) || date.getTime() < cutoff) return;
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Array.from(buckets.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
}

function buildPlatformAnalytics(schools, days) {
  const schoolEntities = schools.map((school) => ({ ...school, createdAt: school.createdAt }));
  const students = schools.flatMap((school) => Array.isArray(school.students) ? school.students : (school.users || []).filter((user) => String(user.role || '').toLowerCase() === 'student' || user.roles?.some((entry) => String(entry.role?.name || entry.name || '').toLowerCase() === 'student')));
  const teachers = schools.flatMap((school) => Array.isArray(school.teachers) ? school.teachers : (school.users || []).filter((user) => String(user.role || '').toLowerCase() === 'teacher' || user.roles?.some((entry) => String(entry.role?.name || entry.name || '').toLowerCase() === 'teacher')));
  return {
    days,
    schoolGrowth: buildGrowthSeries(schoolEntities, days),
    studentGrowth: buildGrowthSeries(students, days),
    teacherGrowth: buildGrowthSeries(teachers, days),
    subscriptionActivity: ['trial', 'active', 'suspended', 'expired'].map((status) => ({
      status,
      count: schools.filter((school) => String(school.subscriptionStatus || school.schoolStatus || '').toLowerCase() === status).length,
    })),
    revenue: null,
    revenueCurrency: null,
  };
}

async function getPlatformSummary({ days = 365 } = {}) {
  const analyticsDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 365;
  const fallbackSummary = () => {
    const schools = loadSchoolData().map((school) => resolveSchoolLifecycleStatus(school));
    const totalSchools = schools.length;
    const activeSchools = schools.filter((school) => ['active', 'paid'].includes((school.subscriptionStatus || school.schoolStatus || '').toLowerCase())).length;
    const trialSchools = schools.filter(
      (school) =>
        (school.subscriptionStatus || '').toLowerCase() === 'trial' ||
        (school.schoolStatus || '').toLowerCase() === 'trial'
    ).length;
    const expiredSchools = schools.filter((school) => ['expired', 'inactive', 'blocked'].includes((school.subscriptionStatus || school.schoolStatus || '').toLowerCase())).length;
    const suspendedSchools = schools.filter((school) => ['suspended', 'inactive', 'blocked'].includes((school.subscriptionStatus || school.schoolStatus || '').toLowerCase())).length;
    const totalStudents = schools.reduce((sum, school) => sum + countSchoolUsers(school, 'student'), 0);
    const totalTeachers = schools.reduce((sum, school) => sum + countSchoolUsers(school, 'teacher'), 0);
    const schoolSummaries = schools.map((school) => ({
      schoolId: school.schoolId,
      name: school.name,
      subscriptionPlan: school.subscriptionPlan,
      subscriptionStatus: school.subscriptionStatus,
      schoolStatus: school.schoolStatus,
      userCount: (school.users || []).length,
      studentCount: countSchoolUsers(school, 'student'),
      teacherCount: countSchoolUsers(school, 'teacher'),
      createdAt: school.createdAt || null,
      reports: Array.isArray(school.reports) ? school.reports : [],
    }));

    return {
      totalSchools,
      activeSchools,
      trialSchools,
      expiredSchools,
      totalStudents,
      totalTeachers,
      suspendedSchools,
      activeSubscriptions: schools.filter((school) => ['active', 'paid'].includes(String(school.subscriptionStatus || '').toLowerCase())).length,
      revenue: null,
      schools: schoolSummaries,
      analytics: buildPlatformAnalytics(schools, analyticsDays),
    };
  };

  if (prisma && prisma.__stub) {
    return fallbackSummary();
  }

  try {
    const tenants = (await prisma.tenant.findMany({ include: { users: true } })).map((tenant) => resolveSchoolLifecycleStatus(tenant));
    const totalSchools = tenants.length;
    const activeSchools = tenants.filter((tenant) => ['active', 'paid'].includes((tenant.subscriptionStatus || tenant.status || '').toLowerCase())).length;
    const trialSchools = tenants.filter(
      (tenant) => (tenant.subscriptionStatus || tenant.status || '').toLowerCase() === 'trial'
    ).length;
    const expiredSchools = tenants.filter((tenant) => ['expired', 'inactive', 'blocked'].includes((tenant.subscriptionStatus || tenant.status || '').toLowerCase())).length;
    const totalStudents = tenants.reduce(
      (sum, tenant) =>
        sum + ((tenant.users || []).filter((user) => user.roles?.some((role) => role.role?.name === 'student')).length || 0),
      0
    );
    const totalTeachers = tenants.reduce(
      (sum, tenant) =>
        sum + ((tenant.users || []).filter((user) => user.roles?.some((role) => role.role?.name === 'teacher')).length || 0),
      0
    );
    const schoolSummaries = tenants.map((tenant) => ({
      schoolId: tenant.schoolId,
      name: tenant.name,
      subscriptionPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
      schoolStatus: tenant.status,
      userCount: (tenant.users || []).length,
      studentCount: countSchoolUsers(tenant, 'student'),
      teacherCount: countSchoolUsers(tenant, 'teacher'),
      createdAt: tenant.createdAt || null,
    }));

    return {
      totalSchools,
      activeSchools,
      trialSchools,
      expiredSchools,
      totalStudents,
      totalTeachers,
      suspendedSchools: tenants.filter((tenant) => ['suspended', 'inactive', 'blocked'].includes(String(tenant.subscriptionStatus || tenant.status || '').toLowerCase())).length,
      activeSubscriptions: tenants.filter((tenant) => ['active', 'paid'].includes(String(tenant.subscriptionStatus || '').toLowerCase())).length,
      revenue: null,
      schools: schoolSummaries,
      analytics: buildPlatformAnalytics(tenants, analyticsDays),
    };
  } catch (error) {
    const message = String(error?.message || '');
    if (!/(Can't reach database server|database server|ECONNREFUSED|timeout|connect)/i.test(message)) {
      throw error;
    }
    return fallbackSummary();
  }
}

function getActiveAcademicYear(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list.find((item) => String(item.status || '').toLowerCase() === 'active') || list[0] || null;
}

function getActiveTerm(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list.find((item) => String(item.status || '').toLowerCase() === 'active') || list[0] || null;
}

function getSchoolCurrency(school = {}) {
  const brandingCurrency = String(school.branding?.currency || school.settings?.currency || school.currency || 'USD').trim();
  return brandingCurrency || 'USD';
}

function formatCurrencyValue(amount, currency = 'USD') {
  const numericValue = Number(amount || 0);
  if (!Number.isFinite(numericValue)) return `${String(currency || 'USD').trim().toUpperCase()} 0`;
  const currencyCode = String(currency || 'USD').trim().toUpperCase();
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numericValue);
  return `${currencyCode} ${formatted}`;
}

function calculateAttendanceMetrics(records = []) {
  const list = Array.isArray(records) ? records : [];
  const normalizeDateKey = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const asString = String(value).slice(0, 10);
      return asString.length === 10 ? asString : null;
    }
    return new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  };

  const validDates = list
    .map((entry) => normalizeDateKey(entry.date || entry.createdAt || entry.recordedAt || entry.submittedAt || entry.updatedAt))
    .filter(Boolean)
    .sort();

  const todayKey = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  const selectedDateKey = validDates.includes(todayKey) ? todayKey : (validDates[validDates.length - 1] || todayKey);
  const selectedEntries = list.filter((entry) => {
    const candidate = entry.date || entry.createdAt || entry.recordedAt || entry.submittedAt || entry.updatedAt;
    return normalizeDateKey(candidate) === selectedDateKey;
  });

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  selectedEntries.forEach((entry) => {
    const normalizedStatus = String(entry.status || '').trim().toLowerCase();
    if (normalizedStatus === 'present') counts.present += 1;
    else if (normalizedStatus === 'absent') counts.absent += 1;
    else if (normalizedStatus === 'late') counts.late += 1;
    else if (normalizedStatus === 'excused') counts.excused += 1;
  });

  const total = selectedEntries.length;
  const presentRatio = total ? Math.round((counts.present / total) * 100) : 0;
  return {
    total,
    counts,
    presentRatio,
    attendanceToday: total ? `${presentRatio}%` : 'No attendance recorded yet',
    trendData: list.slice(-7).map((entry) => {
      const date = entry.date || entry.createdAt || entry.recordedAt || entry.submittedAt || entry.updatedAt || new Date().toISOString();
      const parsed = new Date(date);
      const label = Number.isNaN(parsed.getTime()) ? 'Today' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const status = String(entry.status || '').trim().toLowerCase();
      const percentage = total ? Math.round(((status === 'present' ? 1 : 0) / 1) * 100) : 0;
      return { date: label, percentage: percentage || (status === 'absent' ? 0 : 100) };
    }),
  };
}

function calculateFeeCollection(payments = [], currency = 'USD') {
  const list = Array.isArray(payments) ? payments : [];
  const collected = list.filter((entry) => String(entry.status || '').toLowerCase() === 'received' || String(entry.status || '').toLowerCase() === 'paid' || String(entry.status || '').toLowerCase() === 'complete').reduce((sum, entry) => sum + Number(entry.amount || entry.total || entry.value || 0), 0);
  const outstanding = list.filter((entry) => String(entry.status || '').toLowerCase() === 'pending' || String(entry.status || '').toLowerCase() === 'unpaid' || String(entry.status || '').toLowerCase() === 'outstanding').reduce((sum, entry) => sum + Number(entry.amount || entry.total || entry.value || 0), 0);
  const partial = list.filter((entry) => String(entry.status || '').toLowerCase() === 'partial').reduce((sum, entry) => sum + Number(entry.amount || entry.total || entry.value || 0), 0);
  const total = collected + outstanding + partial || 1;
  return {
    collected,
    outstanding,
    partial,
    collectedPct: total ? Math.round((collected / total) * 100) : 0,
    outstandingPct: total ? Math.round((outstanding / total) * 100) : 0,
    partialPct: total ? Math.round((partial / total) * 100) : 0,
    collectedLabel: formatCurrencyValue(collected, currency),
    outstandingLabel: formatCurrencyValue(outstanding, currency),
    partialLabel: formatCurrencyValue(partial, currency),
  };
}

function calculateMonthlyRevenue(payments = []) {
  const list = Array.isArray(payments) ? payments : [];
  const months = Array.from({ length: 12 }, (_, index) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - index));
    return { month: d.toLocaleDateString('en-US', { month: 'short' }), revenue: 0 };
  });

  list.forEach((payment) => {
    const amount = Number(payment.amount || payment.total || payment.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const submittedAt = payment.createdAt || payment.date || payment.paidAt || payment.updatedAt;
    const date = submittedAt ? new Date(submittedAt) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const monthIndex = months.findIndex((entry) => entry.month === date.toLocaleDateString('en-US', { month: 'short' }) && date.getFullYear() === new Date().getFullYear());
    if (monthIndex >= 0) {
      months[monthIndex].revenue += amount;
    }
  });

  return months.filter((entry) => entry.revenue > 0 || months.some((month) => month.revenue > 0));
}

function deriveCompletedSetupSteps(school = {}) {
  const steps = [];
  if (school.name || school.branding || school.address || school.email) steps.push('profile');
  if (Array.isArray(school.academicYears) && school.academicYears.length) steps.push('academic_year');
  if (Array.isArray(school.terms) && school.terms.length) steps.push('term');
  if (Array.isArray(school.classes) && school.classes.length) steps.push('classes');
  if (Array.isArray(school.subjects) && school.subjects.length) steps.push('subjects');
  if (Array.isArray(school.teachers) && school.teachers.length) steps.push('teachers');
  if (Array.isArray(school.students) && school.students.length) steps.push('students');
  if (Array.isArray(school.attendanceRecords) && school.attendanceRecords.length) steps.push('attendance');
  if (Array.isArray(school.payments) && school.payments.length) steps.push('finance');
  if (Array.isArray(school.examRecords) || Array.isArray(school.examSchedules) || Array.isArray(school.gradeEntries)) steps.push('exams');
  return steps;
}

function buildDashboardSnapshot(school, schoolUsers = []) {
  const users = Array.isArray(schoolUsers) ? schoolUsers : [];
  const activeUsers = users.filter((user) => String(user.status || '').toLowerCase() === 'active');
  const teacherCount = users.filter((user) => String(user.role || '').toLowerCase() === 'teacher').length;
  const studentCount = users.filter((user) => String(user.role || '').toLowerCase() === 'student').length;
  const excludedStaffRoles = new Set(['teacher', 'student', 'school_authority', 'school_head', 'super_admin']);
  const staffCount = activeUsers.filter((user) => !excludedStaffRoles.has(String(user.role || '').toLowerCase())).length;
  const activeClasses = (school.classes || []).filter((entry) => String(entry.status || '').toLowerCase() === 'active');
  const academicYears = Array.isArray(school.academicYears) ? school.academicYears : [];
  const terms = Array.isArray(school.terms) ? school.terms : [];
  const currentAcademicYear = getActiveAcademicYear(academicYears);
  const currentTerm = getActiveTerm(terms);
  const currency = getSchoolCurrency(school);
  const attendanceMetrics = calculateAttendanceMetrics(Array.isArray(school.attendanceRecords) ? school.attendanceRecords : []);
  const feeMetrics = calculateFeeCollection(Array.isArray(school.payments) ? school.payments : [], currency);
  const recentActivities = Array.isArray(school.recentActivities) && school.recentActivities.length > 0
    ? school.recentActivities.slice(0, 5)
    : [
        { title: 'School profile updated', detail: 'The school head refreshed the tenant profile.' },
        { title: 'Academic structure prepared', detail: 'New academic structure items can be created from the dashboard.' },
        { title: 'Tenant dashboard opened', detail: 'The school head reviewed the live school overview.' },
      ];
  const upcomingEvents = Array.isArray(school.events) && school.events.length > 0
    ? school.events.slice(0, 4)
    : [
        { title: 'Term planning review', detail: 'Review class and subject coverage for the next cycle.' },
        { title: 'Parent engagement week', detail: 'Share updates and upcoming school events with families.' },
      ];

  const derivedTeacherCount = Array.isArray(school.teachers) && school.teachers.length > 0 ? school.teachers.length : teacherCount;
  const derivedStudentCount = Array.isArray(school.students) && school.students.length > 0 ? school.students.length : studentCount;

  return {
    schoolId: school.schoolId,
    name: school.name,
    schoolStatus: school.schoolStatus || school.status || 'active',
    logo: school.logo || null,
    coverImage: school.coverImage || null,
    totalUsers: activeUsers.length,
    teacherCount: derivedTeacherCount,
    studentCount: derivedStudentCount,
    staffCount,
    classCount: activeClasses.length,
    departmentCount: Array.isArray(school.departments) ? school.departments.length : 0,
    streamCount: Array.isArray(school.streams) ? school.streams.length : 0,
    subjectCount: Array.isArray(school.subjects) ? school.subjects.length : 0,
    academicYearCount: academicYears.length,
    termCount: terms.length,
    semesterCount: Array.isArray(school.semesters) ? school.semesters.length : 0,
    attendanceSummary: {
      attendanceToday: attendanceMetrics.attendanceToday,
      attendanceTrendData: attendanceMetrics.trendData,
      counts: attendanceMetrics.counts,
    },
    feesSummary: {
      collectedToday: feeMetrics.collectedLabel,
      outstanding: feeMetrics.outstandingLabel,
      partial: feeMetrics.partialLabel,
      collected: feeMetrics.collected,
      outstandingValue: feeMetrics.outstanding,
      partialValue: feeMetrics.partial,
    },
    performanceSummary: {
      aiTutorStatus: school.aiTutorStatus || 'Available',
      academicYear: currentAcademicYear ? currentAcademicYear.label || currentAcademicYear.name || currentAcademicYear.title || currentAcademicYear.id : school.academicYear || '—',
      currentTerm: currentTerm ? currentTerm.label || currentTerm.name || currentTerm.title || currentTerm.id : school.currentTerm || '—',
    },
    recentActivities,
    schoolNotices: Array.isArray(school.announcements) && school.announcements.length > 0 ? school.announcements.slice(0, 4) : recentActivities.slice(0, 4),
    upcomingEvents,
    attendanceTrendData: attendanceMetrics.trendData,
    feeCollectionData: {
      collected: feeMetrics.collected,
      outstanding: feeMetrics.outstanding,
      partial: feeMetrics.partial,
      currency,
    },
    monthlyRevenueData: calculateMonthlyRevenue(Array.isArray(school.payments) ? school.payments : []),
    completedSetupSteps: deriveCompletedSetupSteps(school),
  };
}

function applyAcademicYearWorkflow(school, createdYear, payload = {}) {
  const academicYears = Array.isArray(school.academicYears) ? school.academicYears : [];
  const previousYear = academicYears.find((item) => item.id !== createdYear.id && String(item.status || '').toLowerCase() !== 'archived') || null;
  if (previousYear) {
    previousYear.status = 'archived';
    previousYear.archivedAt = new Date().toISOString();
  }

  if (payload.promoteStudents) {
    const students = Array.isArray(school.students) ? school.students : [];
    students.forEach((student) => {
      if (student.status !== 'graduated') {
        student.status = 'active';
      }
      student.currentAcademicYear = createdYear.name || createdYear.id;
      student.gradeLevel = Number(student.gradeLevel || 0) + 1;
    });
  }

  if (payload.graduateFinalYearStudents) {
    const students = Array.isArray(school.students) ? school.students : [];
    students.forEach((student) => {
      if (String(student.gradeLevel || '').includes('12') || String(student.grade || '').includes('12')) {
        student.status = 'graduated';
      }
    });
  }

  if (payload.copySubjects && Array.isArray(school.subjects) && school.subjects.length) {
    createdYear.subjects = school.subjects.map((subject) => ({ ...subject, id: subject.id || `${subject.name || 'subject'}-${Date.now()}` }));
  }

  if (payload.copyTeachers && Array.isArray(school.teachers) && school.teachers.length) {
    createdYear.teachers = school.teachers.map((teacher) => ({ ...teacher, id: teacher.id || teacher.username || `${teacher.name || 'teacher'}-${Date.now()}` }));
  }

  if (payload.copyClassStructure && Array.isArray(school.classes) && school.classes.length) {
    createdYear.classes = school.classes.map((cls) => ({ ...cls, classId: cls.classId || `${cls.name || 'class'}-${Date.now()}` }));
  }

  return createdYear;
}

async function getEntities(schoolId, entityType, query = {}) {
  const field = normalizeEntityType(entityType);
  if (!field) {
    throw new Error('Unsupported entity type');
  }

  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 20;

  if (firebaseCore.isFirebaseCoreMode()) {
    const school = await firebaseCore.getSchoolAggregate(schoolId);
    if (!school) throw new Error('School not found');
    const items = school[field] || [];
    const filtered = buildSearchFilter(items, query.search, query.status);
    const safeItems = field === 'teachers'
      ? filtered.map(sanitizeTeacherRecord)
      : field === 'students'
        ? filtered.map(sanitizeStudentRecord)
        : filtered;
    return paginate(safeItems, page, pageSize);
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const items = school[field] || [];
    const filtered = buildSearchFilter(items, query.search, query.status);
    const safeItems = field === 'teachers'
      ? filtered.map(sanitizeTeacherRecord)
      : field === 'students'
        ? filtered.map(sanitizeStudentRecord)
        : filtered;
    return paginate(safeItems, page, pageSize);
  }

  const tenant = await loadTenantWithRelations(schoolId);
  if (!tenant) throw new Error('School not found');

  let items = [];
  if (field === 'teachers') {
    const users = await fetchUsersByRole(tenant.id, 'teacher');
    items = users.map((user) => mapUserEntity(user, 'teacher'));
  } else if (field === 'students') {
    const users = await fetchUsersByRole(tenant.id, 'student');
    items = users.map((user) => mapUserEntity(user, 'student'));
  } else {
    items = tenant[field] || [];
  }

  const filtered = buildSearchFilter(items, query.search, query.status);
  return paginate(filtered, page, pageSize);
}

async function searchEntities(schoolId, query, scope = '') {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    const scopes = scope ? scope.split(',').map((s) => s.trim()) : [];
    return searchSchoolEntities(school, query, scopes);
  }

  const tenant = await loadTenantWithRelations(schoolId);
  if (!tenant) throw new Error('School not found');

  const scopeList = scope ? scope.split(',').map((s) => s.trim()) : ['departments', 'streams', 'subjects', 'classes', 'teachers', 'students'];
  const results = [];
  const lower = String(query || '').toLowerCase();

  for (const scopeName of scopeList) {
    let items = [];
    if (scopeName === 'teachers') {
      const users = await fetchUsersByRole(tenant.id, 'teacher');
      items = users.map((user) => mapUserEntity(user, 'teacher'));
    } else if (scopeName === 'students') {
      const users = await fetchUsersByRole(tenant.id, 'student');
      items = users.map((user) => mapUserEntity(user, 'student'));
    } else {
      items = tenant[scopeName] || [];
    }

    const matching = items.filter((item) => {
      const textValues = collectSearchText(item);
      return textValues.some((value) => value.includes(lower));
    });

    results.push({ scope: scopeName, items: matching });
  }

  return results;
}

async function findUserByIdentifier(identifier, tenantId) {
  if (!identifier) return null;
  if (identifier.includes('@')) {
    return prisma.user.findUnique({ where: { email: String(identifier).toLowerCase() } });
  }
  return prisma.user.findUnique({ where: { id: identifier } });
}

async function attachUserRole(userId, roleName) {
  const role = await findOrCreateRole(roleName);
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }
  return role;
}

async function createRoleLinkedUser(tenantId, roleName, payload) {
  const email = String(payload.email || `${roleName}-${Date.now()}@${tenantId}.globyedu.com`).toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser && existingUser.tenantId !== tenantId) {
    throw new Error('User email is already assigned to another tenant');
  }

  const password = payload.password || `TempPass!${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const name = splitFullName(payload.fullName || `${payload.firstName || ''} ${payload.lastName || ''}`);
  const suppliedMetadata = { ...(payload.metadata || {}) };
  if (roleName === 'teacher') {
    delete suppliedMetadata.nationalId;
    delete suppliedMetadata.signature;
  }

  const userData = {
    email,
    firstName: payload.firstName || name.firstName,
    lastName: payload.lastName || name.lastName,
    phone: payload.phone || null,
    passwordHash,
    passwordNeedsReset: !payload.password,
    status: payload.status || 'active',
    isVerified: payload.emailVerified !== false,
    tenantId,
    profilePhoto: payload.profilePhoto || null,
    metadata: {
      ...suppliedMetadata,
      middleName: payload.middleName || (payload.metadata && payload.metadata.middleName) || null,
      gender: payload.gender || (payload.metadata && payload.metadata.gender) || null,
      dateOfBirth: payload.dateOfBirth || (payload.metadata && payload.metadata.dateOfBirth) || null,
      altPhone: payload.altPhone || (payload.metadata && payload.metadata.altPhone) || null,
      nationality: payload.nationality || (payload.metadata && payload.metadata.nationality) || null,
      nationalId: roleName === 'teacher' ? null : payload.nationalId || (payload.metadata && payload.metadata.nationalId) || null,
      address: payload.address || (payload.metadata && payload.metadata.address) || null,
      signature: roleName === 'teacher' ? null : payload.signature || (payload.metadata && payload.metadata.signature) || null,
      teacherId: payload.teacherId || (payload.metadata && payload.metadata.teacherId) || generateTeacherId(),
      studentId: payload.studentId || (payload.metadata && payload.metadata.studentId) || null,
      employeeNumber: payload.employeeNumber || (payload.metadata && payload.metadata.employeeNumber) || `EMP-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      employmentDate: payload.employmentDate || (payload.metadata && payload.metadata.employmentDate) || null,
      employmentType: payload.employmentType || (payload.metadata && payload.metadata.employmentType) || null,
      department: payload.department || (payload.metadata && payload.metadata.department) || null,
      position: payload.position || (payload.metadata && payload.metadata.position) || null,
      qualification: payload.qualification || (payload.metadata && payload.metadata.qualification) || null,
      yearsOfExperience: payload.yearsOfExperience || (payload.metadata && payload.metadata.yearsOfExperience) || null,
      currentAcademicYear: payload.currentAcademicYear || (payload.metadata && payload.metadata.currentAcademicYear) || null,
      currentTerm: payload.currentTerm || (payload.metadata && payload.metadata.currentTerm) || null,
      assignedClasses: normalizeTeacherAssignedClasses(payload.assignedClasses || (payload.metadata && payload.metadata.assignedClasses)),
      assignedSubjects: normalizeArray(payload.assignedSubjects || (payload.metadata && payload.metadata.assignedSubjects)),
      classTeacher: payload.classTeacher !== undefined ? payload.classTeacher : (payload.metadata && payload.metadata.classTeacher) || false,
      houseMaster: payload.houseMaster !== undefined ? payload.houseMaster : (payload.metadata && payload.metadata.houseMaster) || false,
      leaveStatus: payload.leaveStatus || (payload.metadata && payload.metadata.leaveStatus) || null,
      pendingApproval: payload.pendingApproval !== undefined ? payload.pendingApproval : (payload.metadata && payload.metadata.pendingApproval) || false,
      performance: payload.performance || (payload.metadata && payload.metadata.performance) || {},
      activityLog: normalizeArray(payload.activityLog || (payload.metadata && payload.metadata.activityLog)),
      documents: normalizeArray(payload.documents || (payload.metadata && payload.metadata.documents)),
    },
  };
  if (roleName === 'teacher') {
    delete userData.metadata.nationalId;
    delete userData.metadata.signature;
  }

  const user = existingUser
    ? await prisma.user.update({ where: { email }, data: userData })
    : await prisma.user.create({ data: userData });

  await attachUserRole(user.id, roleName);
  return mapUserEntity(user, roleName);
}

async function createEntity(schoolId, entityType, payload, actor = {}) {
  const field = normalizeEntityType(entityType);
  if (!field) {
    throw new Error('Unsupported entity type');
  }

  const hasExplicitActorRole = getUserRoleList(actor).length > 0;
  const authorizedManagement = hasSchoolAuthorityRole(actor) || !hasExplicitActorRole;
  if (!authorizedManagement) {
    const restrictedEntityTypes = ['teachers', 'students', 'classes', 'subjects', 'departments', 'streams', 'academicYears', 'terms', 'semesters'];
    if (restrictedEntityTypes.includes(field)) {
      throw new Error('Only School Authority can manage student, teacher, class, and academic records.');
    }
  }

  if (firebaseCore.isFirebaseCoreMode()) {
    const school = await firebaseCore.getSchoolAggregate(schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const roles = getUserRoleList(actor);
    if (roles.includes('teacher') && field !== 'students') throw new Error('Teachers can only manage students here');
    if (field === 'students' && payload.classId) {
      const classRecord = school.classes.find((item) => String(item.classId || item.id) === String(payload.classId));
      if (!classRecord) throw new Error('Class does not belong to this school');
      if (roles.includes('teacher') && !resolveTeacherAuthorization(school, actor, payload.classId)) throw new Error('Teacher is not authorized for this class');
    }

    const temporaryPassword = payload.password || `TempPass!${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, config.bcrypt.saltRounds);
    let created;
    if (field === 'teachers') {
      created = createTeacherRecord(school, { ...payload, passwordHash, passwordNeedsReset: !payload.password });
    } else if (field === 'students') {
      created = createStudentRecord(school, { ...payload, passwordHash, passwordNeedsReset: !payload.password });
    } else if (field === 'classes') {
      created = { ...payload, classId: payload.classId || `class-${Date.now()}`, schoolId, status: payload.status || 'active' };
    } else {
      created = createSchoolEntity(school, field, payload);
    }

    const collection = field === 'teachers' ? 'teachers' : field === 'students' ? 'students' : field;
    const identifier = created.teacherId || created.studentId || created.classId || created.id || `${field}-${Date.now()}`;
    const safeCreated = field === 'teachers' ? sanitizeTeacherRecord(created) : field === 'students' ? sanitizeStudentRecord(created) : created;
    await firebaseCore.saveById(collection, `${schoolId}:${identifier}`, { ...safeCreated, schoolId }, false);
    if (field === 'teachers' || field === 'students') {
      await firebaseCore.saveById('users', `${schoolId}:${created.email || created.username || identifier}`, {
        schoolId,
        tenantId: schoolId,
        username: created.username || created.email || identifier,
        email: created.email || null,
        fullName: created.fullName || payload.fullName || payload.name || 'User',
        role: field === 'teachers' ? 'teacher' : 'student',
        teacherId: created.teacherId || null,
        studentId: created.studentId || null,
        classId: created.classId || null,
        className: created.className || null,
        passwordHash,
        passwordNeedsReset: !payload.password,
        status: created.status || 'active',
      }, false);
      await firebaseCore.saveById('roles', `${schoolId}:${field === 'teachers' ? 'teacher' : 'student'}`, { schoolId, name: field === 'teachers' ? 'teacher' : 'student' }, true);
    }
    return safeCreated;
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const roles = getUserRoleList(actor);
    if (roles.includes('teacher') && field !== 'students') throw new Error('Teachers can only manage students here');
    if (field === 'classes' && payload.teacherId) {
      const teacher = school.teachers.find((item) => String(item.teacherId || item.username || item.email) === String(payload.teacherId));
      if (!teacher) throw new Error('Teacher does not belong to this school');
    }
    if (field === 'students' && payload.classId) {
      const classRecord = school.classes.find((item) => String(item.classId || item.id) === String(payload.classId));
      if (!classRecord) throw new Error('Class does not belong to this school');
      if (roles.includes('teacher') && !resolveTeacherAuthorization(school, actor, payload.classId)) {
        throw new Error('Teacher is not authorized for this class');
      }
    } else if (roles.includes('teacher')) {
      throw new Error('Class is required for teacher student creation');
    }
    let created;
    if (field === 'teachers') {
      const temporaryPassword = payload.password || `TempPass!${Math.random().toString(36).slice(2, 8)}`;
      const { nationalId, nationalIdNumber, signature, ...teacherInput } = payload;
      const teacherPayload = {
        ...teacherInput,
        passwordHash: await bcrypt.hash(temporaryPassword, config.bcrypt.saltRounds),
        passwordNeedsReset: !payload.password,
        assignedClasses: normalizeTeacherAssignedClasses(payload.assignedClasses || (payload.metadata && payload.metadata.assignedClasses)),
      };
      created = createTeacherRecord(school, teacherPayload);
      created = sanitizeTeacherRecord(created);
    } else if (field === 'students') {
      await enforceStudentLimit(school, schoolId);
      if (payload.classId) {
        const classRecord = school.classes.find((item) => String(item.classId || item.id) === String(payload.classId));
        if (!classRecord) throw new Error('Class does not belong to this school');
      }
      const temporaryPassword = payload.password || `TempPass!${Math.random().toString(36).slice(2, 8)}`;
      created = createStudentRecord(school, {
        ...payload,
        passwordHash: await bcrypt.hash(temporaryPassword, config.bcrypt.saltRounds),
        passwordNeedsReset: !payload.password,
      });
      if (!Array.isArray(school.users)) school.users = [];
      const username = payload.username || payload.email || created.studentId;
      const existingUser = school.users.find((user) => String(user.username || '').toLowerCase() === String(username).toLowerCase());
      if (existingUser) throw new Error('Student with that username or email already exists');
      school.users.push({
        username,
        email: payload.email || null,
        studentId: created.studentId,
        role: 'student',
        fullName: created.fullName || payload.name || 'Student',
        className: created.className || null,
        grade: created.grade || 'N/A',
        status: created.status || 'active',
        emailVerified: payload.emailVerified !== false,
        platformAdmin: false,
        passwordHash: created.passwordHash,
        passwordNeedsReset: created.passwordNeedsReset === true,
        permissions: ['student.view'],
      });
      const safeStudent = sanitizeStudentRecord(created);
      created = safeStudent;
    } else if (field === 'academicYears') {
      created = createSchoolEntity(school, field, {
        ...payload,
        status: payload.status || 'active',
      });
      applyAcademicYearWorkflow(school, created, payload);
    } else {
      created = createSchoolEntity(school, field, payload);
    }
    saveSchoolData(schools);
    return created;
  }

  const tenant = await prisma.tenant.findUnique({ where: { schoolId } });
  if (!tenant) throw new Error('School not found');

  if (field === 'classes' && payload.teacherId) {
    const teacher = await findUserByIdentifier(payload.teacherId, tenant.id);
    if (!teacher || teacher.tenantId !== tenant.id) throw new Error('Teacher does not belong to this school');
  }
  if (field === 'students' && payload.classId) {
    const classRecord = await prisma.class.findFirst({ where: { id: payload.classId, tenantId: tenant.id } });
    if (!classRecord) throw new Error('Class does not belong to this school');
  }

  if (field === 'teachers') {
    return createRoleLinkedUser(tenant.id, 'teacher', payload);
  }
  if (field === 'students') {
    await enforceStudentLimit(tenant, schoolId);
    return createRoleLinkedUser(tenant.id, 'student', payload);
  }

  const model = getEntityModel(entityType);
  if (!model) {
    throw new Error('Unsupported entity model');
  }

  const data = {
    ...payload,
    tenantId: tenant.id,
  };

  return prisma[model].create({ data });
}

async function enforceStudentLimit(school, schoolId) {
  const planSlug = String(school.subscriptionPlan || '').toLowerCase().replace(/(?:\s+plan|-plan)$/, '').trim();
  if (!planSlug || planSlug.includes('trial') || planSlug.includes('unlimited')) return;
  const plan = (await listPricingPlans({ activeOnly: true })).find((entry) => entry.slug === planSlug);
  if (!plan) return;
  const activeStudentCount = prisma && !prisma.__stub
    ? await prisma.user.count({ where: { tenantId: school.id || schoolId, studentId: { not: null }, status: 'active' } })
    : (Array.isArray(school.students) ? school.students : []).filter((student) => String(student.status || 'active').toLowerCase() !== 'archived').length;
  if (activeStudentCount >= plan.studentLimit) {
    throw new Error(`${plan.name} plan allows up to ${plan.studentLimit} active students. Upgrade the school plan before adding another student.`);
  }
}

async function updateEntity(schoolId, entityType, entityId, updates, actor = {}) {
  const field = normalizeEntityType(entityType);
  if (!field) {
    throw new Error('Unsupported entity type');
  }

  const actorRoles = getUserRoleList(actor);
  const hasExplicitActorRole = actorRoles.length > 0;
  if (hasExplicitActorRole && !hasSchoolAuthorityRole(actor)) {
    if (['teachers', 'students', 'classes', 'subjects', 'departments', 'streams', 'academicYears', 'terms', 'semesters'].includes(field)) {
      throw new Error('Only School Authority can update school records and assignments.');
    }
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const roles = getUserRoleList(actor);
    if (roles.includes('teacher') && field !== 'students') throw new Error('Teachers can only manage students here');
    if (roles.includes('teacher') && field === 'students') {
      const currentStudent = school.students.find((item) => [item.studentId, item.id, item.email].filter(Boolean).some((value) => String(value).toLowerCase() === String(entityId).toLowerCase()));
      if (!currentStudent) throw new Error('Entity not found');
      const currentClass = currentStudent.classId || currentStudent.className || currentStudent.grade;
      const nextClass = updates.classId || updates.className || currentClass;
      if (!resolveTeacherAuthorization(school, actor, nextClass)) throw new Error('Teacher is not authorized for this class');
      delete updates.studentId;
      delete updates.id;
      delete updates.schoolId;
      delete updates.passwordHash;
      delete updates.studentPasswordHash;
      delete updates.passwordNeedsReset;
    }
    if (field === 'classes' && updates.teacherId) {
      const teacher = school.teachers.find((item) => String(item.teacherId || item.username || item.email) === String(updates.teacherId));
      if (!teacher) throw new Error('Teacher does not belong to this school');
    }
    if (field === 'students' && updates.classId) {
      const classRecord = school.classes.find((item) => String(item.classId || item.id) === String(updates.classId));
      if (!classRecord) throw new Error('Class does not belong to this school');
    }
    const sanitizedUpdates = restrictNonAuthorityUpdates(field, updates || {}, actor);
    const { password, passwordHash, studentPasswordHash, passwordNeedsReset, ...safeUpdates } = sanitizedUpdates;
    const validatedUpdates = field === 'teachers'
      ? {
          ...safeUpdates,
          nationalId: undefined,
          nationalIdNumber: undefined,
          signature: undefined,
          assignedClasses: safeUpdates.assignedClasses || (safeUpdates.metadata && safeUpdates.metadata.assignedClasses)
            ? normalizeTeacherAssignedClasses(safeUpdates.assignedClasses || (safeUpdates.metadata && safeUpdates.metadata.assignedClasses))
            : undefined,
          metadata: safeUpdates.metadata
            ? {
                ...safeUpdates.metadata,
                nationalId: undefined,
                nationalIdNumber: undefined,
                signature: undefined,
                ...(safeUpdates.metadata.assignedClasses ? { assignedClasses: normalizeTeacherAssignedClasses(safeUpdates.metadata.assignedClasses) } : {}),
              }
            : safeUpdates.metadata,
        }
      : safeUpdates;
    const updated = updateSchoolEntity(school, field, entityId, validatedUpdates);
    if (!updated) throw new Error('Entity not found');
    if (field === 'teachers') {
      const teacherIndex = school.teachers.findIndex((item) => String(item.teacherId || item.username || item.email) === String(entityId));
      if (teacherIndex !== -1) school.teachers[teacherIndex] = { ...school.teachers[teacherIndex], ...updated };
      const userIndex = school.users.findIndex((item) => String(item.teacherId || item.username || item.email) === String(entityId));
      if (userIndex !== -1) school.users[userIndex] = { ...school.users[userIndex], ...updated };
    }
    if (field === 'students') {
      const studentIndex = school.students.findIndex((item) => [item.studentId, item.id, item.email].filter(Boolean).some((value) => String(value).toLowerCase() === String(entityId).toLowerCase()));
      if (studentIndex !== -1) school.students[studentIndex] = { ...school.students[studentIndex], ...updated };
    }
    saveSchoolData(schools);
    return updated;
  }

  const tenant = await prisma.tenant.findUnique({ where: { schoolId } });
  if (!tenant) throw new Error('School not found');

  if (field === 'teachers' || field === 'students') {
    const roleName = field === 'teachers' ? 'teacher' : 'student';
    const user = await findUserByIdentifier(entityId, tenant.id);
    if (!user || user.tenantId !== tenant.id) {
      throw new Error('Entity not found');
    }
    const sanitizedUpdates = restrictNonAuthorityUpdates(field, updates || {}, actor);
    const { password, passwordHash, studentPasswordHash, passwordNeedsReset, ...safeUpdates } = sanitizedUpdates;
    const updatesWithEmail = { ...safeUpdates };
    if (field === 'teachers') {
      delete updatesWithEmail.nationalId;
      delete updatesWithEmail.nationalIdNumber;
      delete updatesWithEmail.signature;
    }
    if (updatesWithEmail.email) {
      updatesWithEmail.email = String(updatesWithEmail.email).toLowerCase();
    }
    if (updatesWithEmail.fullName) {
      const name = splitFullName(updatesWithEmail.fullName);
      updatesWithEmail.firstName = updatesWithEmail.firstName || name.firstName;
      updatesWithEmail.lastName = updatesWithEmail.lastName || name.lastName;
      delete updatesWithEmail.fullName;
    }

    const metadata = {
      ...(user.metadata || {}),
      ...(updatesWithEmail.metadata || {}),
    };

    if (field === 'teachers') {
      delete metadata.nationalId;
      delete metadata.nationalIdNumber;
      delete metadata.signature;
    }

    if (field === 'teachers' && metadata.assignedClasses !== undefined) {
      metadata.assignedClasses = normalizeTeacherAssignedClasses(metadata.assignedClasses);
    }

    if (field === 'students') {
      if (updatesWithEmail.studentId) metadata.studentId = updatesWithEmail.studentId;
      if (updatesWithEmail.admissionNumber) metadata.admissionNumber = updatesWithEmail.admissionNumber;
      if (updatesWithEmail.className) metadata.className = updatesWithEmail.className;
      if (updatesWithEmail.classId !== undefined) metadata.classId = updatesWithEmail.classId;
      if (updatesWithEmail.gradeLevel) metadata.gradeLevel = updatesWithEmail.gradeLevel;
      if (updatesWithEmail.currentAcademicYear) metadata.currentAcademicYear = updatesWithEmail.currentAcademicYear;
      if (updatesWithEmail.currentTerm) metadata.currentTerm = updatesWithEmail.currentTerm;
      if (updatesWithEmail.guardian) metadata.guardian = updatesWithEmail.guardian;
      if (updatesWithEmail.medical) metadata.medical = updatesWithEmail.medical;
      if (updatesWithEmail.documents) metadata.documents = normalizeArray(updatesWithEmail.documents);
    }

    if (field === 'teachers') {
      if (updatesWithEmail.middleName) metadata.middleName = updatesWithEmail.middleName;
      if (updatesWithEmail.gender) metadata.gender = updatesWithEmail.gender;
      if (updatesWithEmail.dateOfBirth) metadata.dateOfBirth = updatesWithEmail.dateOfBirth;
      if (updatesWithEmail.altPhone) metadata.altPhone = updatesWithEmail.altPhone;
      if (updatesWithEmail.nationality) metadata.nationality = updatesWithEmail.nationality;
      if (updatesWithEmail.address) metadata.address = updatesWithEmail.address;
      if (updatesWithEmail.teacherId) metadata.teacherId = updatesWithEmail.teacherId;
      if (updatesWithEmail.employeeNumber) metadata.employeeNumber = updatesWithEmail.employeeNumber;
      if (updatesWithEmail.employmentDate) metadata.employmentDate = updatesWithEmail.employmentDate;
      if (updatesWithEmail.employmentType) metadata.employmentType = updatesWithEmail.employmentType;
      if (updatesWithEmail.department) metadata.department = updatesWithEmail.department;
      if (updatesWithEmail.position) metadata.position = updatesWithEmail.position;
      if (updatesWithEmail.qualification) metadata.qualification = updatesWithEmail.qualification;
      if (updatesWithEmail.yearsOfExperience) metadata.yearsOfExperience = updatesWithEmail.yearsOfExperience;
      if (updatesWithEmail.currentAcademicYear) metadata.currentAcademicYear = updatesWithEmail.currentAcademicYear;
      if (updatesWithEmail.currentTerm) metadata.currentTerm = updatesWithEmail.currentTerm;
      if (updatesWithEmail.assignedClasses) metadata.assignedClasses = normalizeTeacherAssignedClasses(updatesWithEmail.assignedClasses);
      if (updatesWithEmail.assignedSubjects) metadata.assignedSubjects = normalizeArray(updatesWithEmail.assignedSubjects);
      if (updatesWithEmail.classTeacher !== undefined) metadata.classTeacher = updatesWithEmail.classTeacher;
      if (updatesWithEmail.houseMaster !== undefined) metadata.houseMaster = updatesWithEmail.houseMaster;
      if (updatesWithEmail.leaveStatus) metadata.leaveStatus = updatesWithEmail.leaveStatus;
      if (updatesWithEmail.pendingApproval !== undefined) metadata.pendingApproval = updatesWithEmail.pendingApproval;
      if (updatesWithEmail.signature) metadata.signature = updatesWithEmail.signature;
      if (updatesWithEmail.documents) metadata.documents = normalizeArray(updatesWithEmail.documents);
      if (updatesWithEmail.performance) metadata.performance = updatesWithEmail.performance;
      if (updatesWithEmail.activityLog) metadata.activityLog = normalizeArray(updatesWithEmail.activityLog);
    }

    updatesWithEmail.metadata = metadata;
    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: updatesWithEmail });
    await attachUserRole(updatedUser.id, roleName);
    return mapUserEntity(updatedUser, roleName);
  }

  const model = getEntityModel(entityType);
  if (!model) {
    throw new Error('Unsupported entity model');
  }
  const existing = await prisma[model].findFirst({ where: { id: entityId, tenantId: tenant.id } });
  if (!existing) throw new Error('Entity not found');
  return prisma[model].update({ where: { id: existing.id }, data: updates });
}

async function deleteEntity(schoolId, entityType, entityId, actor = {}) {
  const field = normalizeEntityType(entityType);
  if (!field) {
    throw new Error('Unsupported entity type');
  }

  if (getUserRoleList(actor).length > 0 && !hasSchoolAuthorityRole(actor)) {
    throw new Error('Only School Authority can delete or deactivate school records.');
  }

  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const deleted = deleteSchoolEntity(school, field, entityId);
    if (!deleted) throw new Error('Entity not found');
    if (field === 'teachers') return sanitizeTeacherRecord(deleted);
    if (field === 'students') return sanitizeStudentRecord(deleted);
    if (['departments','streams','subjects','academicYears','terms','semesters','classes'].includes(field)) {
      deleted.status = 'archived';
    }
    saveSchoolData(schools);
    return deleted;
  }

  const tenant = await prisma.tenant.findUnique({ where: { schoolId } });
  if (!tenant) throw new Error('School not found');

  if (field === 'teachers' || field === 'students') {
    const roleName = field === 'teachers' ? 'teacher' : 'student';
    const user = await findUserByIdentifier(entityId, tenant.id);
    if (!user || user.tenantId !== tenant.id) {
      throw new Error('Entity not found');
    }
    const role = await findOrCreateRole(roleName);
    await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: role.id } });
    const remainingRoles = await prisma.userRole.count({ where: { userId: user.id } });
    if (remainingRoles === 0) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    return mapUserEntity(user, roleName);
  }

  const model = getEntityModel(entityType);
  if (!model) {
    throw new Error('Unsupported entity model');
  }

  if (['departments','streams','subjects','academicYears','terms','semesters','classes'].includes(field)) {
    return prisma[model].update({ where: { id: entityId }, data: { status: 'archived' } });
  }

  return prisma[model].delete({ where: { id: entityId } });
}

function normalizeMessagingIdentifier(value) {
  return String(value || '').split(':').pop().trim().toLowerCase();
}

function getMessagingActor(school, actor = {}) {
  const identifier = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email);
  const users = Array.isArray(school.users) ? school.users : [];
  const entities = [
    ...users,
    ...(Array.isArray(school.teachers) ? school.teachers : []),
    ...(Array.isArray(school.students) ? school.students : []),
  ];
  return entities.find((entry) => [entry.username, entry.email, entry.teacherId, entry.studentId, entry.userId, entry.id]
    .some((value) => normalizeMessagingIdentifier(value) === identifier)) || null;
}

function getMessagingRoles(actor = {}, record = {}) {
  const roles = Array.isArray(actor.roles) ? actor.roles : [record.role || ''];
  return roles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean);
}

function getMessagingRecipientOptions(school, actor = {}) {
  const actorRecord = getMessagingActor(school, actor);
  const roles = getMessagingRoles(actor, actorRecord || {});
  const actorId = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email || actorRecord?.username);
  const users = (Array.isArray(school.users) ? school.users : []).filter((entry) => String(entry.status || 'active').toLowerCase() !== 'archived');
  const teacher = actorRecord || {};
  const student = actorRecord || {};
  const assignedClasses = normalizeArray(teacher.assignedClasses || teacher.classes || teacher.className || teacher.assignedClass).map((value) => String(value).trim().toLowerCase());
  const studentClass = String(student.className || student.gradeLevel || student.grade || '').trim().toLowerCase();
  const isAllowed = (candidate) => {
    const candidateId = normalizeMessagingIdentifier(candidate.username || candidate.email || candidate.teacherId || candidate.studentId || candidate.id);
    if (!candidateId || candidateId === actorId) return false;
    const candidateRole = String(candidate.role || '').trim().toLowerCase();
    if (roles.includes('super_admin') || roles.includes('school_authority') || roles.includes('school_head')) return ['school_authority', 'school_head', 'teacher', 'student'].includes(candidateRole);
    if (roles.includes('teacher')) {
      if (['school_authority', 'school_head'].includes(candidateRole)) return true;
      if (candidateRole !== 'student') return false;
      const candidateClass = String(candidate.className || candidate.gradeLevel || candidate.grade || '').trim().toLowerCase();
      return assignedClasses.includes(candidateClass) || assignedClasses.includes(String(candidate.classId || '').trim().toLowerCase());
    }
    if (roles.includes('student')) {
      if (['school_authority', 'school_head'].includes(candidateRole)) return true;
      if (candidateRole !== 'teacher') return false;
      const candidateClasses = normalizeArray(candidate.assignedClasses || candidate.classes || candidate.className || candidate.assignedClass).map((value) => String(value).trim().toLowerCase());
      return Boolean(studentClass) && candidateClasses.includes(studentClass);
    }
    return false;
  };

  return users.filter(isAllowed).map((candidate) => ({
    id: candidate.username || candidate.email || candidate.teacherId || candidate.studentId || candidate.id,
    name: candidate.fullName || candidate.name || candidate.username || candidate.email || 'User',
    role: candidate.role || 'user',
  }));
}

function assertMessagingRecipient(school, actor, recipientId) {
  const normalizedRecipientId = normalizeMessagingIdentifier(recipientId);
  const recipientOptions = getMessagingRecipientOptions(school, actor);
  const recipient = recipientOptions.find((entry) => normalizeMessagingIdentifier(entry.id) === normalizedRecipientId);
  if (!recipient) throw new Error('Recipient is not authorized for messaging');
  return recipient;
}

async function createWorkspaceMessage(schoolId, payload = {}, actor = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const roles = getMessagingRoles(actor);
    if (roles.length && !isTenantMatch(actor, schoolId)) throw new Error('School access denied');
    const recipientIds = Array.isArray(payload.recipientIds) ? payload.recipientIds : [payload.recipientId || payload.recipient].filter(Boolean);
    if (roles.length && !recipientIds.length) throw new Error('A recipient is required');
    const actorRecord = getMessagingActor(school, actor);
    const senderId = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email || actorRecord?.username);
    const senderName = actorRecord?.fullName || actorRecord?.name || actorRecord?.username || 'User';
    const messages = roles.length
      ? recipientIds.map((recipientId) => {
        const recipient = assertMessagingRecipient(school, actor, recipientId);
        return normalizeWorkspaceMessage(school, {
          ...payload,
          id: undefined,
          folder: 'inbox',
          from: senderName,
          to: recipient.name,
          recipient: recipient.id,
          recipientId: normalizeMessagingIdentifier(recipient.id),
          recipientRole: recipient.role,
          senderId,
          senderRole: roles[0],
          senderName,
          unread: true,
          readAt: null,
          readBy: [],
        });
      })
      : [normalizeWorkspaceMessage(school, payload)];
    school.messages.unshift(...messages);
    saveSchoolData(schools);
    return messages[0];
  }

  throw new Error('Workspace messaging is only available in fallback mode');
}

async function createAssignment(schoolId, payload = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  ensureSchoolEntities(school);
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');

  const roles = getUserRoleList(actor);
  if (!roles.includes('teacher') && !roles.includes('school_authority') && !roles.includes('super_admin')) {
    throw new Error('Teacher or school authority role required');
  }

  const assignedClassId = String(payload.classId || payload.className || '').trim();
  if (!assignedClassId) throw new Error('Class is required');
  if (roles.includes('teacher') && !resolveTeacherAuthorization(school, actor, assignedClassId)) {
    throw new Error('Teacher is not authorized for this class');
  }

  const assignment = {
    id: payload.id || `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: String(payload.title || '').trim() || 'Untitled assignment',
    description: String(payload.description || payload.instructions || '').trim(),
    instructions: String(payload.instructions || payload.description || '').trim(),
    classId: assignedClassId,
    className: String(payload.className || (Array.isArray(school.classes) ? school.classes.find((entry) => String(entry.classId || entry.id || '').trim() === assignedClassId)?.name || '' : '')).trim(),
    subject: String(payload.subject || '').trim() || 'General',
    dueDate: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
    status: normalizeAssignmentStatus(payload.dueDate || new Date(Date.now() + 86400000).toISOString(), payload.status || 'assigned'),
    teacherId: String(payload.teacherId || actor.username || actor.userId || '').split(':').pop().trim() || 'teacher',
    createdBy: String(payload.createdBy || actor.username || actor.userId || '').split(':').pop().trim() || 'teacher',
    submissions: Array.isArray(payload.submissions) ? payload.submissions : [],
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
    schoolId,
  };

  if (!Array.isArray(school.assignments)) school.assignments = [];
  school.assignments.unshift(assignment);
  saveSchoolData(schools);
  return assignment;
}

async function listAssignments(schoolId, query = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const teacherFilter = String(query.teacherId || query.createdBy || '').trim();
  const items = (Array.isArray(school.assignments) ? school.assignments : []).filter((entry) => {
    const matchesTeacher = !teacherFilter || String(entry.teacherId || entry.createdBy || '').trim() === teacherFilter;
    return matchesTeacher;
  });
  return { schoolId, items, total: items.length };
}

async function listAssignmentsForStudent(schoolId, query = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const studentId = String(query.studentId || actor.username || actor.userId || '').split(':').pop().trim();
  const student = resolveStudentByActor(school, { ...actor, username: studentId, userId: `${schoolId}:${studentId}` });
  if (!student) return { schoolId, items: [], total: 0 };

  const classKeys = resolveStudentClassKeys(school, student);
  const items = (Array.isArray(school.assignments) ? school.assignments : []).filter((entry) => {
    return classKeys.has(String(entry.classId || '').trim().toLowerCase()) || classKeys.has(String(entry.className || '').trim().toLowerCase());
  });
  return { schoolId, items, total: items.length };
}

async function submitAssignment(schoolId, assignmentId, payload = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const roles = getUserRoleList(actor);
  if (!roles.includes('student')) throw new Error('Student role required');

  const assignment = (Array.isArray(school.assignments) ? school.assignments : []).find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const student = resolveStudentByActor(school, actor);
  if (!student) throw new Error('Student not found');
  const classKeys = resolveStudentClassKeys(school, student);
  const entryMatch = classKeys.has(String(assignment.classId || '').trim().toLowerCase()) || classKeys.has(String(assignment.className || '').trim().toLowerCase());
  if (!entryMatch) throw new Error('Assignment not available for this class');

  const studentId = String(payload.studentId || student.studentId || actor.username || '').trim();
  const submission = {
    id: payload.id || `submission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    studentId,
    studentName: String(payload.studentName || student.fullName || actor.username || '').trim(),
    text: payload.text || '',
    attachment: payload.attachment || null,
    status: 'submitted',
    submittedAt: payload.submittedAt || new Date().toISOString(),
  };

  const existing = Array.isArray(assignment.submissions) ? assignment.submissions : [];
  const index = existing.findIndex((entry) => String(entry.studentId || '').trim() === String(studentId).trim());
  if (index >= 0) existing[index] = { ...existing[index], ...submission };
  else existing.push(submission);

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  if (dueDate && dueDate.getTime() < new Date(submission.submittedAt).getTime()) {
    submission.status = 'late';
    if (index >= 0) existing[index].status = 'late';
    else existing[existing.length - 1].status = 'late';
  }

  assignment.submissions = existing;
  assignment.status = existing.some((entry) => entry.status === 'submitted' || entry.status === 'late') ? 'submitted' : 'assigned';
  assignment.updatedAt = new Date().toISOString();
  saveSchoolData(schools);
  return assignment;
}

async function getAssignmentSubmissions(schoolId, assignmentId, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const roles = getUserRoleList(actor);
  if (!roles.includes('teacher') && !roles.includes('school_authority') && !roles.includes('super_admin')) {
    throw new Error('Teacher or school authority role required');
  }

  const assignment = (Array.isArray(school.assignments) ? school.assignments : []).find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  if (roles.includes('teacher') && !resolveAssignmentOwnership(school, assignment, actor)) {
    throw new Error('Teacher is not assigned to this assignment');
  }

  return { schoolId, assignmentId, submissions: Array.isArray(assignment.submissions) ? assignment.submissions : [] };
}

async function updateAssignment(schoolId, assignmentId, updates = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const roles = getUserRoleList(actor);
  const assignment = (Array.isArray(school.assignments) ? school.assignments : []).find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  if (roles.includes('student')) throw new Error('Students are not permitted to modify assignment definitions');
  if (!roles.includes('teacher') && !roles.includes('school_authority') && !roles.includes('super_admin')) {
    throw new Error('Teacher or school authority role required');
  }
  if (roles.includes('teacher') && !resolveAssignmentOwnership(school, assignment, actor)) {
    throw new Error('Teacher is not permitted to modify this assignment');
  }

  Object.assign(assignment, {
    ...updates,
    title: updates.title || assignment.title,
    description: updates.description || updates.instructions || assignment.description,
    instructions: updates.instructions || updates.description || assignment.instructions,
    dueDate: updates.dueDate || assignment.dueDate,
    classId: updates.classId || assignment.classId,
    subject: updates.subject || assignment.subject,
    updatedAt: new Date().toISOString(),
  });
  assignment.status = normalizeAssignmentStatus(assignment.dueDate, assignment.status);
  saveSchoolData(schools);
  return assignment;
}

async function createLesson(schoolId, payload = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const roles = getUserRoleList(actor);
  if (!roles.includes('teacher') && !roles.includes('school_authority') && !roles.includes('super_admin')) {
    throw new Error('Teacher or school authority role required');
  }

  const classId = String(payload.classId || '').trim();
  if (!classId) throw new Error('Class is required');
  if (roles.includes('teacher') && !resolveTeacherAuthorization(school, actor, classId)) {
    throw new Error('Teacher is not authorized for this class');
  }

  const lesson = {
    id: payload.id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: String(payload.title || '').trim() || 'Untitled lesson',
    description: String(payload.description || '').trim(),
    content: String(payload.content || payload.description || '').trim(),
    classId,
    className: String(payload.className || (Array.isArray(school.classes) ? school.classes.find((entry) => String(entry.classId || entry.id || '').trim() === classId)?.name || '' : '')).trim(),
    subject: String(payload.subject || '').trim() || 'General',
    teacherId: String(payload.teacherId || actor.username || actor.userId || '').split(':').pop().trim() || 'teacher',
    createdBy: String(payload.createdBy || actor.username || actor.userId || '').split(':').pop().trim() || 'teacher',
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
    schoolId,
  };

  school.lessons.unshift(lesson);
  saveSchoolData(schools);
  return lesson;
}

async function listLessons(schoolId, query = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const items = (Array.isArray(school.lessons) ? school.lessons : []).filter((entry) => !query.teacherId || String(entry.teacherId || entry.createdBy || '').trim() === String(query.teacherId || '').trim());
  return { schoolId, items, total: items.length };
}

async function listLessonsForStudent(schoolId, query = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const studentId = String(query.studentId || actor.username || actor.userId || '').split(':').pop().trim();
  const student = resolveStudentByActor(school, { ...actor, username: studentId, userId: `${schoolId}:${studentId}` });
  if (!student) return { schoolId, items: [], total: 0 };

  const classKeys = resolveStudentClassKeys(school, student);
  const items = (Array.isArray(school.lessons) ? school.lessons : []).filter((entry) => {
    const matchesClassId = classKeys.has(String(entry.classId || '').trim().toLowerCase());
    const matchesClassName = classKeys.has(String(entry.className || '').trim().toLowerCase());
    const matchesSubject = !query.subject || String(entry.subject || '').trim().toLowerCase() === String(query.subject || '').trim().toLowerCase();
    return (matchesClassId || matchesClassName) && matchesSubject;
  });
  return { schoolId, items, total: items.length };
}

async function updateLesson(schoolId, lessonId, updates = {}, actor = {}) {
  const schools = loadSchoolData();
  const school = findSchoolBySchoolId(schools, schoolId);
  if (!school) throw new Error('School not found');
  if (!isTenantMatch(actor, schoolId)) throw new Error('School access denied');
  ensureSchoolEntities(school);

  const roles = getUserRoleList(actor);
  const lesson = (Array.isArray(school.lessons) ? school.lessons : []).find((entry) => entry.id === lessonId);
  if (!lesson) throw new Error('Lesson not found');
  if (roles.includes('student')) throw new Error('Students are not permitted to modify learning materials');
  if (!roles.includes('teacher') && !roles.includes('school_authority') && !roles.includes('super_admin')) {
    throw new Error('Teacher or school authority role required');
  }
  if (roles.includes('teacher') && !resolveLessonOwnership(school, lesson, actor)) {
    throw new Error('Teacher is not permitted to modify this lesson');
  }

  Object.assign(lesson, {
    ...updates,
    title: updates.title || lesson.title,
    description: updates.description || lesson.description,
    content: updates.content || updates.description || lesson.content,
    classId: updates.classId || lesson.classId,
    subject: updates.subject || lesson.subject,
    updatedAt: new Date().toISOString(),
  });
  saveSchoolData(schools);
  return lesson;
}

async function updateWorkspaceMessage(schoolId, messageId, updates = {}, actor = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const index = (school.messages || []).findIndex((item) => item.id === messageId);
    if (index === -1) throw new Error('Message not found');
    const current = school.messages[index] || {};
    const actorId = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email);
    const roles = getMessagingRoles(actor);
    if (roles.length && current.recipientId && normalizeMessagingIdentifier(current.recipientId) !== actorId) throw new Error('Message access denied');
    const allowedUpdates = roles.length ? { unread: updates.unread === false ? false : current.unread, readAt: updates.unread === false ? new Date().toISOString() : current.readAt } : updates;
    const updated = { ...current, ...allowedUpdates, id: messageId };
    school.messages[index] = updated;
    saveSchoolData(schools);
    return updated;
  }

  throw new Error('Workspace messaging is only available in fallback mode');
}

async function deleteWorkspaceMessage(schoolId, messageId, actor = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const index = (school.messages || []).findIndex((item) => item.id === messageId);
    if (index === -1) throw new Error('Message not found');
    const actorId = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email);
    const roles = getMessagingRoles(actor);
    const current = school.messages[index] || {};
    if (roles.length && current.recipientId && ![current.recipientId, current.senderId].map(normalizeMessagingIdentifier).includes(actorId)) throw new Error('Message access denied');
    const [removed] = school.messages.splice(index, 1);
    saveSchoolData(schools);
    return removed;
  }

  throw new Error('Workspace messaging is only available in fallback mode');
}

async function listWorkspaceMessages(schoolId, query = {}, actor = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const folder = query.folder || '';
    const actorId = normalizeMessagingIdentifier(actor.userId || actor.username || actor.email);
    const roles = getMessagingRoles(actor);
    const actorRecord = getMessagingActor(school, actor) || {};
    const actorRole = String(actorRecord.role || roles[0] || '').toLowerCase();
    const legacyInboxVisible = (item) => {
      const target = String(item.recipientType || item.audience || item.recipient || 'all').trim().toLowerCase();
      return ['all', 'everyone', actorRole, `${actorRole}s`].includes(target);
    };
    let items = Array.isArray(school.messages) ? school.messages.filter((item) => !roles.length
      || (item.recipientId
        ? [item.recipientId, item.senderId].map(normalizeMessagingIdentifier).includes(actorId)
        : legacyInboxVisible(item))) : [];
    if (folder) {
      const normalizedFolder = String(folder).toLowerCase();
      items = items.filter((item) => item.recipientId && roles.length
        ? (normalizedFolder === 'sent' ? normalizeMessagingIdentifier(item.senderId) === actorId : normalizeMessagingIdentifier(item.recipientId) === actorId)
        : normalizedFolder === 'sent' ? (!roles.length && String(item.folder || '').toLowerCase() === normalizedFolder) : String(item.folder || '').toLowerCase() === normalizedFolder);
    }
    if (query.search) {
      const term = String(query.search).trim().toLowerCase();
      items = items.filter((item) => `${item.subject || ''} ${item.body || ''} ${item.from || ''} ${item.to || ''}`.toLowerCase().includes(term));
    }
    return { schoolId, items, total: items.length };
  }

  throw new Error('Workspace messaging is only available in fallback mode');
}

async function createSupportTicket(schoolId, payload = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const ticket = normalizeSupportTicket(school, payload);
    school.supportTickets.unshift(ticket);
    saveSchoolData(schools);
    return ticket;
  }

  throw new Error('Workspace support is only available in fallback mode');
}

async function updateSupportTicket(schoolId, ticketId, updates = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const index = (school.supportTickets || []).findIndex((item) => item.id === ticketId);
    if (index === -1) throw new Error('Support ticket not found');
    const updated = { ...(school.supportTickets[index] || {}), ...updates, id: ticketId, updatedAt: new Date().toISOString() };
    school.supportTickets[index] = updated;
    saveSchoolData(schools);
    return updated;
  }

  throw new Error('Workspace support is only available in fallback mode');
}

async function deleteSupportTicket(schoolId, ticketId) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const index = (school.supportTickets || []).findIndex((item) => item.id === ticketId);
    if (index === -1) throw new Error('Support ticket not found');
    const [removed] = school.supportTickets.splice(index, 1);
    saveSchoolData(schools);
    return removed;
  }

  throw new Error('Workspace support is only available in fallback mode');
}

async function listSupportTickets(schoolId, query = {}) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) throw new Error('School not found');
    ensureSchoolEntities(school);
    const status = String(query.status || '').toLowerCase();
    let items = Array.isArray(school.supportTickets) ? school.supportTickets : [];
    if (status) {
      items = items.filter((item) => String(item.status || '').toLowerCase() === status);
    }
    return { schoolId, items, total: items.length };
  }

  throw new Error('Workspace support is only available in fallback mode');
}

async function getDashboardSummary(schoolId) {
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData();
    const school = findSchoolBySchoolId(schools, schoolId);
    if (!school) {
      throw new Error('School not found');
    }

    return buildDashboardSnapshot(school, school.users || []);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { schoolId },
    include: {
      users: true,
      departments: true,
      streams: true,
      subjects: true,
      classes: true,
      academicYears: true,
      terms: true,
      semesters: true,
    },
  }).catch(() => null);
  if (!tenant) {
    throw new Error('School not found');
  }

  const tenantId = tenant.id;
  const totalUsers = await prisma.user.count({ where: { tenantId } });
  const teacherUsers = await prisma.user.findMany({ where: { tenantId, roles: { some: { role: { name: 'teacher' } } } } });
  const studentUsers = await prisma.user.findMany({ where: { tenantId, roles: { some: { role: { name: 'student' } } } } });

  const teacherCounts = teacherUsers.reduce(
    (acc, user) => {
      const status = String(user.status || 'active').toLowerCase();
      const leaveStatus = String(user.metadata?.leaveStatus || '').toLowerCase();
      acc.total += 1;
      if (leaveStatus === 'on leave' || leaveStatus === 'sick leave' || leaveStatus === 'annual leave' || leaveStatus === 'emergency leave' || leaveStatus === 'study leave') {
        acc.onLeave += 1;
      } else if (status === 'inactive') {
        acc.inactive += 1;
      } else if (Boolean(user.metadata?.pendingApproval)) {
        acc.pendingApproval += 1;
      } else {
        acc.active += 1;
      }
      return acc;
    },
    { total: 0, active: 0, inactive: 0, onLeave: 0, pendingApproval: 0 }
  );

  const teacherDepartments = new Set(teacherUsers.map((user) => String(user.metadata?.department || '').trim()).filter(Boolean));
  const assignedClassSet = new Set(teacherUsers.reduce((acc, user) => acc.concat(normalizeArray(user.metadata?.assignedClasses)), []));
  const assignedSubjectSet = new Set(teacherUsers.reduce((acc, user) => acc.concat(normalizeArray(user.metadata?.assignedSubjects)), []));

  const statusCounts = studentUsers.reduce(
    (acc, user) => {
      const status = String(user.status || 'active').toLowerCase();
      acc.total += 1;
      if (status === 'graduated') acc.graduated += 1;
      else if (status === 'transfer' || status === 'transferred') acc.transferred += 1;
      else if (status === 'suspended') acc.suspended += 1;
      else if (status === 'archived') acc.archived += 1;
      else acc.active += 1;
      return acc;
    },
    { total: 0, active: 0, graduated: 0, transferred: 0, suspended: 0, archived: 0 }
  );

  const academicYear = (tenant.academicYears || []).find((item) => String(item.status || '').toLowerCase() === 'active') || (tenant.academicYears || [])[0] || null;
  const term = (tenant.terms || []).find((item) => String(item.status || '').toLowerCase() === 'active') || (tenant.terms || [])[0] || null;

  const recentAdmissions = studentUsers
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((user) => ({
      id: user.id,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      studentId: user.metadata?.studentId || null,
      admissionNumber: user.metadata?.admissionNumber || null,
      className: user.metadata?.className || null,
    }));

  const recentTeacherActivity = teacherUsers
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
    .map((user) => ({
      id: user.id,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
      email: user.email,
      status: user.status,
      updatedAt: user.updatedAt,
      department: user.metadata?.department || null,
      assignedClasses: normalizeArray(user.metadata?.assignedClasses),
      assignedSubjects: normalizeArray(user.metadata?.assignedSubjects),
    }));

  const currency = getSchoolCurrency(tenant);
  const attendanceMetrics = calculateAttendanceMetrics(Array.isArray(tenant.attendanceRecords) ? tenant.attendanceRecords : []);
  const feeMetrics = calculateFeeCollection(Array.isArray(tenant.payments) ? tenant.payments : [], currency);
  const dashboardSummary = {
    schoolId: tenant.schoolId,
    name: tenant.name,
    description: tenant.description || null,
    logo: tenant.logo || null,
    coverImage: tenant.coverImage || null,
    schoolStatus: tenant.status || 'active',
    region: tenant.region || tenant.country || null,
    country: tenant.country || null,
    timezone: tenant.timezone || null,
    website: tenant.website || null,
    address: tenant.address || null,
    phone: tenant.phone || null,
    email: tenant.email || null,
    branding: tenant.branding || null,
    totalUsers,
    teacherCount: teacherCounts.total,
    teacherActive: teacherCounts.active,
    teacherInactive: teacherCounts.inactive,
    teacherOnLeave: teacherCounts.onLeave,
    teacherPendingApproval: teacherCounts.pendingApproval,
    teacherDepartmentCount: teacherDepartments.size,
    teacherAssignedClassesCount: assignedClassSet.size,
    teacherAssignedSubjectsCount: assignedSubjectSet.size,
    studentCount: studentUsers.length,
    activeStudents: statusCounts.active,
    graduatedStudents: statusCounts.graduated,
    transferredStudents: statusCounts.transferred,
    suspendedStudents: statusCounts.suspended,
    archivedStudents: statusCounts.archived,
    recentAdmissions,
    staffCount: Array.isArray(tenant.users)
      ? tenant.users.filter((user) => String(user.status || '').toLowerCase() === 'active' && !['teacher', 'student', 'school_authority', 'school_head', 'super_admin'].includes(String(user.role || '').toLowerCase())).length
      : 0,
    classCount: tenant.classes ? tenant.classes.length : 0,
    departmentCount: tenant.departments ? tenant.departments.length : 0,
    streamCount: tenant.streams ? tenant.streams.length : 0,
    subjectCount: tenant.subjects ? tenant.subjects.length : 0,
    academicYearCount: tenant.academicYears ? tenant.academicYears.length : 0,
    termCount: tenant.terms ? tenant.terms.length : 0,
    semesterCount: tenant.semesters ? tenant.semesters.length : 0,
    attendanceSummary: {
      attendanceToday: attendanceMetrics.attendanceToday,
      attendanceTrendData: attendanceMetrics.trendData,
      counts: attendanceMetrics.counts,
    },
    feesSummary: {
      collectedToday: feeMetrics.collectedLabel,
      outstanding: feeMetrics.outstandingLabel,
      partial: feeMetrics.partialLabel,
      collected: feeMetrics.collected,
      outstandingValue: feeMetrics.outstanding,
      partialValue: feeMetrics.partial,
    },
    performanceSummary: {
      aiTutorStatus: tenant.aiTutorStatus || 'Available',
      academicYear: academicYear ? academicYear.label || academicYear.name || academicYear.title || academicYear.id : '—',
      currentTerm: term ? term.label || term.name || term.title || term.id : '—',
    },
    schoolNotices: Array.isArray(tenant.announcements) ? tenant.announcements.slice(0, 4) : Array.isArray(tenant.events) ? tenant.events.slice(0, 4) : [],
    recentActivities: Array.isArray(tenant.recentActivities) && tenant.recentActivities.length > 0
      ? tenant.recentActivities.slice(0, 5)
      : [
          { title: 'School profile updated', detail: 'The school head refreshed the tenant profile.' },
          { title: 'Academic structure prepared', detail: 'New academic structure items can be created from the dashboard.' },
          { title: 'Tenant dashboard opened', detail: 'The school head reviewed the live school overview.' },
        ],
    upcomingEvents: Array.isArray(tenant.events) && tenant.events.length > 0
      ? tenant.events.slice(0, 4)
      : [
          { title: 'Term planning review', detail: 'Review class and subject coverage for the next cycle.' },
          { title: 'Parent engagement week', detail: 'Share updates and upcoming school events with families.' },
        ],
    recentTeacherActivity,
    attendanceTrendData: attendanceMetrics.trendData,
    feeCollectionData: {
      collected: feeMetrics.collected,
      outstanding: feeMetrics.outstanding,
      partial: feeMetrics.partial,
      currency,
    },
    monthlyRevenueData: calculateMonthlyRevenue(Array.isArray(tenant.payments) ? tenant.payments : []),
    completedSetupSteps: deriveCompletedSetupSteps(tenant),
  };

  return dashboardSummary;
}

module.exports = {
  createSchool,
  getSchoolById,
  getSchoolBySchoolId,
  sanitizeSchoolResponse,
  resolveSchoolLifecycleStatus,
  getStudentSchoolView,
  getTeacherSchoolView,
  createFeePayment,
  updateTeacherWorkspace,
  updateSchool,
  updateSchoolCredentials,
  deleteSchool,
  activateSchool,
  listSchools,
  getPlatformSummary,
  getDashboardSummary,
  createWorkspaceMessage,
  getMessagingRecipientOptions,
  updateWorkspaceMessage,
  deleteWorkspaceMessage,
  listWorkspaceMessages,
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  listSupportTickets,
  createAssignment,
  listAssignments,
  listAssignmentsForStudent,
  submitAssignment,
  getAssignmentSubmissions,
  updateAssignment,
  createLesson,
  listLessons,
  listLessonsForStudent,
  updateLesson,
  getEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  searchEntities,
};
