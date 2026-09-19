const FIREBASE_CONFIG = globalThis.__GLOBYEDU_FIREBASE_CONFIG__ || {};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseModules = null;

function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
  );
}

async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase configuration is not set. Configure the FIREBASE_* web variables on the backend.');

  }

  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
  const authModule = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');

  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }

  if (!firebaseAuth) {
    firebaseAuth = authModule.getAuth(firebaseApp);
  }

  firebaseModules = {
    auth: firebaseAuth,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
    sendPasswordResetEmail: authModule.sendPasswordResetEmail,
    signInWithPopup: authModule.signInWithPopup,
    GoogleAuthProvider: authModule.GoogleAuthProvider,
    applyActionCode: authModule.applyActionCode,
    confirmPasswordReset: authModule.confirmPasswordReset,
    sendEmailVerification: authModule.sendEmailVerification,
    signOut: authModule.signOut,
  };

  return firebaseModules;
}

async function firebaseSignInWithEmail(email, password) {
  const { auth, signInWithEmailAndPassword } = await loadFirebaseModules();
  return signInWithEmailAndPassword(auth, email, password);
}

async function firebaseSignInWithGoogle() {
  const { auth, signInWithPopup, GoogleAuthProvider } = await loadFirebaseModules();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

async function firebaseLinkGoogle() {
  return firebaseSignInWithGoogle();
}

async function firebaseCreateUserWithEmail(email, password) {
  const { auth, createUserWithEmailAndPassword } = await loadFirebaseModules();
  return createUserWithEmailAndPassword(auth, email, password);
}

async function firebaseSendEmailVerification(user) {
  const { sendEmailVerification } = await loadFirebaseModules();
  return sendEmailVerification(user);
}

async function firebaseSendPasswordResetEmail(email, actionCodeSettings) {
  const { auth, sendPasswordResetEmail } = await loadFirebaseModules();
  if (actionCodeSettings) {
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
  }
  return sendPasswordResetEmail(auth, email);
}

async function firebaseApplyActionCode(oobCode) {
  const { auth, applyActionCode } = await loadFirebaseModules();
  return applyActionCode(auth, oobCode);
}

async function firebaseConfirmPasswordReset(oobCode, newPassword) {
  const { auth, confirmPasswordReset } = await loadFirebaseModules();
  return confirmPasswordReset(auth, oobCode, newPassword);
}

async function firebaseSignOutUser() {
  const { auth, signOut } = await loadFirebaseModules();
  return signOut(auth);
}

export {
  isFirebaseConfigured,
  firebaseSignInWithEmail,
  firebaseSignInWithGoogle,
  firebaseLinkGoogle,
  firebaseSendPasswordResetEmail,
  firebaseApplyActionCode,
  firebaseConfirmPasswordReset,
  firebaseSignOutUser,
};
