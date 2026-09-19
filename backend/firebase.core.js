const firebaseData = require('./firebase.data');

const CORE_COLLECTIONS = Object.freeze({
  tenants: 'tenants',
  users: 'users',
  roles: 'roles',
  teachers: 'teachers',
  students: 'students',
  classes: 'classes',
  enrollments: 'enrollments',
  payments: 'payments',
  subscriptions: 'subscriptions',
  refundRequests: 'refundRequests',
});

function isFirebaseCoreMode() {
  return firebaseData.isFirebaseDataConfigured();
}

function assertSchoolId(schoolId) {
  const value = String(schoolId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid school ID.');
  return value;
}

function tenantRef(schoolId) {
  return firebaseData.getFirestore().collection(CORE_COLLECTIONS.tenants).doc(assertSchoolId(schoolId));
}

function collectionRef(collectionName) {
  if (!Object.values(CORE_COLLECTIONS).includes(collectionName)) throw new Error('Unsupported Firebase core collection.');
  return firebaseData.getFirestore().collection(collectionName);
}

async function getTenant(schoolId) {
  const snapshot = await tenantRef(schoolId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function saveTenant(schoolId, data, merge = true) {
  const id = assertSchoolId(schoolId);
  const payload = { ...data, schoolId: id, updatedAt: new Date().toISOString() };
  await tenantRef(id).set(payload, { merge });
  return { id, ...payload };
}

async function listBySchool(collectionName, schoolId) {
  const snapshot = await collectionRef(collectionName).where('schoolId', '==', assertSchoolId(schoolId)).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getById(collectionName, id) {
  const snapshot = await collectionRef(collectionName).doc(String(id)).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function saveById(collectionName, id, data, merge = true) {
  const documentId = String(id || '').trim();
  if (!documentId) throw new Error('A Firebase document ID is required.');
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await collectionRef(collectionName).doc(documentId).set(payload, { merge });
  return { id: documentId, ...payload };
}

async function deleteById(collectionName, id) {
  await collectionRef(collectionName).doc(String(id)).delete();
}

async function getSchoolAggregate(schoolId) {
  const tenant = await getTenant(schoolId);
  if (!tenant) return null;
  const [users, teachers, students, classes, enrollments] = await Promise.all([
    listBySchool(CORE_COLLECTIONS.users, schoolId),
    listBySchool(CORE_COLLECTIONS.teachers, schoolId),
    listBySchool(CORE_COLLECTIONS.students, schoolId),
    listBySchool(CORE_COLLECTIONS.classes, schoolId),
    listBySchool(CORE_COLLECTIONS.enrollments, schoolId),
  ]);
  return {
    ...tenant,
    users,
    teachers,
    students,
    classes,
    enrollments,
  };
}

module.exports = {
  CORE_COLLECTIONS,
  isFirebaseCoreMode,
  getTenant,
  saveTenant,
  listBySchool,
  getById,
  saveById,
  deleteById,
  getSchoolAggregate,
};
