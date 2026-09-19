// Firebase production data adapters. These helpers intentionally keep Firebase
// access behind a small boundary so the existing Prisma and JSON test paths can
// remain isolated while features migrate incrementally.

const firebaseAdmin = require('./firebase.admin');

function isFirebaseDataConfigured() {
  return firebaseAdmin.isFirebaseConfigured() && String(process.env.DATA_STORE_MODE || '').toLowerCase() === 'firebase';
}

function getFirestore() {
  if (!isFirebaseDataConfigured()) throw new Error('Firebase Firestore data mode is not configured. Set DATA_STORE_MODE=firebase.');
  return firebaseAdmin.getFirebaseAdmin().firestore();
}

function getStorageBucket() {
  if (!isFirebaseDataConfigured()) throw new Error('Firebase Storage data mode is not configured. Set DATA_STORE_MODE=firebase.');
  return firebaseAdmin.getFirebaseAdmin().storage().bucket();
}

function tenantCollection(schoolId, collectionName) {
  const normalizedSchoolId = String(schoolId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalizedSchoolId)) throw new Error('Invalid school ID.');
  return getFirestore().collection('tenants').doc(normalizedSchoolId).collection(collectionName);
}

async function addTenantDocument(schoolId, collectionName, id, data) {
  const reference = id ? tenantCollection(schoolId, collectionName).doc(String(id)) : tenantCollection(schoolId, collectionName).doc();
  await reference.set(data, { merge: true });
  return { id: reference.id, ...data };
}

async function listTenantDocuments(schoolId, collectionName, options = {}) {
  let query = tenantCollection(schoolId, collectionName);
  if (options.orderBy) query = query.orderBy(options.orderBy, options.direction || 'desc');
  if (options.limit) query = query.limit(Math.min(Number(options.limit) || 100, 500));
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  isFirebaseDataConfigured,
  getFirestore,
  getStorageBucket,
  tenantCollection,
  addTenantDocument,
  listTenantDocuments,
};