const admin = require('firebase-admin');

const DEFAULT_PROJECT_ID = 'globyedu-os';

function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID);
}

function getFirebaseCredential() {
  if (!admin.credential || typeof admin.credential.applicationDefault !== 'function') {
    return null;
  }
  return admin.credential.applicationDefault();
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  const credential = getFirebaseCredential();
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    ...(credential ? { credential } : {}),
  });

  return admin;
}

function getFirebaseAdmin() {
  return initializeFirebaseAdmin();
}

async function verifyIdToken(idToken) {
  const app = getFirebaseAdmin();
  return app.auth().verifyIdToken(idToken);
}

async function getUser(uid) {
  const app = getFirebaseAdmin();
  return app.auth().getUser(uid);
}

async function getUserByEmail(email) {
  const app = getFirebaseAdmin();
  return app.auth().getUserByEmail(email);
}

async function setCustomUserClaims(uid, claims) {
  const app = getFirebaseAdmin();
  return app.auth().setCustomUserClaims(uid, claims);
}

async function createUser({ email, password, displayName }) {
  const app = getFirebaseAdmin();
  return app.auth().createUser({ email, password, displayName, emailVerified: false });
}

async function deleteUser(uid) {
  const app = getFirebaseAdmin();
  return app.auth().deleteUser(uid);
}

async function generateEmailVerificationLink(email, actionCodeSettings) {
  const app = getFirebaseAdmin();
  return app.auth().generateEmailVerificationLink(email, actionCodeSettings);
}

async function generatePasswordResetLink(email, actionCodeSettings) {
  const app = getFirebaseAdmin();
  return app.auth().generatePasswordResetLink(email, actionCodeSettings);
}

module.exports = {
  isFirebaseConfigured,
  initializeFirebaseAdmin,
  getFirebaseCredential,
  getFirebaseAdmin,
  verifyIdToken,
  getUser,
  getUserByEmail,
  setCustomUserClaims,
  createUser,
  deleteUser,
  generateEmailVerificationLink,
  generatePasswordResetLink,
};
