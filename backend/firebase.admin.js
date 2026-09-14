const admin = require('firebase-admin');

function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID);
}

function initializeFirebaseAdmin() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (admin.apps.length > 0) {
    return admin;
  }

  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    credential: admin.credential.applicationDefault(),
  });

  return admin;
}

function getFirebaseAdmin() {
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID.');
  }
  return app;
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
  getFirebaseAdmin,
  verifyIdToken,
  getUser,
  getUserByEmail,
  createUser,
  deleteUser,
  generateEmailVerificationLink,
  generatePasswordResetLink,
};
