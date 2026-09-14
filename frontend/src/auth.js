// auth.js
// Vanilla JS authentication logic for the GlobyEdu frontend.

import { createAlert } from './components/layout.js';
import { createLoginView } from './components/login.js';
import { createDashboardShell, createSubjectCard } from './components/dashboard.js';

const viewport = document.getElementById('app-viewport');

// Read the auth state from localStorage each time so stale values do not persist.
function getStoredSession() {
  return {
    token: localStorage.getItem('globyedu_token'),
    role: localStorage.getItem('globyedu_role'),
    username: localStorage.getItem('globyedu_username'),
    grade: localStorage.getItem('globyedu_grade'),
    schoolName: localStorage.getItem('globyedu_schoolName'),
  };
}

// Fetch the available schools from the backend to populate the dropdown.
export function loadSchools() {
  return fetch('/api/v1/auth/schools')
    .then((response) => response.json())
    .then((data) => {
      if (data.status !== 'ok') {
        throw new Error('Unable to load schools.');
      }
      return data.schools;
    });
}

// Send login credentials to the backend and handle the response.
export function submitLogin({ schoolId, username, password }) {
  return fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schoolId, username, password }),
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok || data.status !== 'ok') {
      throw new Error(data.message || 'Login failed.');
    }
    return data;
  });
}

// Store authentication state locally for the session.
export function saveSession(data) {
  localStorage.setItem('globyedu_token', data.token);
  localStorage.setItem('globyedu_role', data.role);
  localStorage.setItem('globyedu_username', data.username);
  localStorage.setItem('globyedu_grade', data.grade);
  localStorage.setItem('globyedu_schoolName', data.schoolName);
}

// Remove stored authentication state on logout.
export function clearSession() {
  localStorage.removeItem('globyedu_token');
  localStorage.removeItem('globyedu_role');
  localStorage.removeItem('globyedu_username');
  localStorage.removeItem('globyedu_grade');
  localStorage.removeItem('globyedu_schoolName');
}

// Fetch curriculum data for a specific grade from the backend.
// This sends a GET request to the Express route that uses a URL parameter (:grade)
// and returns a JSON object with subjects and topics for that grade.
export function loadCurriculum(grade) {
  return fetch(`/api/v1/curriculum/${grade}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.status !== 'ok') {
        throw new Error(data.message || 'Unable to load curriculum.');
      }
      return data.subjects;
    });
}

// Render the dashboard and populate subject cards.
export function renderDashboard(session) {
  viewport.innerHTML = createDashboardShell(session.role, session.username, session.schoolName, session.grade);
  const subjectGrid = document.getElementById('subject-card-grid');
  const gradeLabel = document.getElementById('dashboard-grade');
  const logoutButton = document.getElementById('nav-logout');

  if (gradeLabel) {
    gradeLabel.textContent = session.grade;
  }

  loadCurriculum(session.grade)
    .then((subjects) => {
      // Vanilla JS array iteration: forEach maps each subject object into HTML and inserts it into the page.
      subjects.forEach((item) => {
        subjectGrid.insertAdjacentHTML('beforeend', createSubjectCard(item.subject, item.topic));
      });
    })
    .catch((error) => {
      subjectGrid.innerHTML = `<div class="col-span-full rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">${error.message}</div>`;
    });

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      clearSession();
      window.location.reload();
    });
  }
}

// Render the authentication state: if logged in, show dashboard; otherwise render login form.
export function renderAuthView() {
  const session = getStoredSession();

  if (session.token && session.role && session.username && session.schoolName && session.grade) {
    renderDashboard(session);
    return;
  }

  loadSchools()
    .then((schools) => {
      viewport.innerHTML = createLoginView(schools);
      bindLoginForm();
    })
    .catch(() => {
      viewport.innerHTML = createAlert('Unable to load schools. Please try again later.', 'danger');
    });
}

// Attach the login submit handler to the rendered form.
export function bindLoginForm() {
  const form = document.getElementById('login-form');
  const messageSlot = document.getElementById('login-message');

  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const schoolId = document.getElementById('school-select').value;
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;

    messageSlot.innerHTML = '';

    submitLogin({ schoolId, username, password })
      .then((result) => {
        saveSession(result);
        renderDashboard(result);
      })
      .catch((error) => {
        messageSlot.innerHTML = createAlert(error.message, 'danger');
      });
  });
}

// Attach logout handling to clear session state and return to login screen.
export function bindLogout() {
  const logoutButton = document.getElementById('logout-button');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', () => {
    clearSession();
    window.location.reload();
  });
}

// Export helper to detect if a user is authenticated.
export function isAuthenticated() {
  const session = getStoredSession();
  return Boolean(session.token && session.role && session.username && session.schoolName && session.grade);
}
