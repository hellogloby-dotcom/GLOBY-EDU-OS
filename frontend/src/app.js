// app.js
// Lightweight client-side router for the GlobyEdu frontend.

import { createCard, createAlert, createButton } from './components/layout.js';
import { isAuthenticated, renderAuthView } from './auth.js';

// Define available routes and the content they render.
const routes = {
  '/': {
    title: 'Home',
    render: () => {
      return `
        <section class="space-y-6">
          ${createAlert('Welcome to GlobyEdu OS. Use the menu to explore basic views.', 'info')}
          <div class="grid gap-6 lg:grid-cols-2">
            ${createCard('Academic overview', 'View quick links and academic status summaries.')}
            ${createCard('Upcoming lessons', 'Starter shell for lesson plan modules and scheduling.')}
          </div>
          <div class="mt-6">
            ${createButton('View Health Check', 'health-check', 'secondary')}
          </div>
        </section>
      `;
    },
  },
  '/students': {
    title: 'Students',
    render: () => {
      return `
        <section class="space-y-6">
          <h1 class="text-2xl font-semibold text-slate-900">Students</h1>
          <p class="text-slate-600">A starter page for student listing and academic records.</p>
          ${createCard('Student directory', 'This page will connect to student data services in future modules.')}
        </section>
      `;
    },
  },
  '/lessons': {
    title: 'Lessons',
    render: () => {
      return `
        <section class="space-y-6">
          <h1 class="text-2xl font-semibold text-slate-900">Lessons</h1>
          <p class="text-slate-600">Build lesson planning and attendance workflows here.</p>
          ${createCard('Lesson plans', 'Starter route shell for lesson management and scheduling.')}
        </section>
      `;
    },
  },
  '/settings': {
    title: 'Settings',
    render: () => {
      return `
        <section class="space-y-6">
          <h1 class="text-2xl font-semibold text-slate-900">Settings</h1>
          <p class="text-slate-600">System configuration and admin preferences.</p>
          ${createCard('System settings', 'This shell will evolve into a settings management console.')}
        </section>
      `;
    },
  },
};

// Get references to page elements used by the router.
const viewport = document.getElementById('app-viewport');
const refreshButton = document.getElementById('refresh-view');

// Render the selected route to the main viewport.
function renderRoute(path) {
  if (!isAuthenticated()) {
    renderAuthView();
    return;
  }

  const route = routes[path] || routes['/'];
  document.title = `GlobyEdu OS | ${route.title}`;
  viewport.innerHTML = route.render();
  attachRouteButtons();
}

// Attach event listeners to dynamically generated buttons inside the viewport.
function attachRouteButtons() {
  const healthButton = document.getElementById('health-check');
  if (healthButton) {
    healthButton.addEventListener('click', () => {
      fetch('/api/v1/health')
        .then((response) => response.json())
        .then((data) => {
          viewport.insertAdjacentHTML(
            'beforeend',
            createAlert(`API health: ${data.status}`, data.status === 'ok' ? 'success' : 'warning')
          );
        })
        .catch(() => {
          viewport.insertAdjacentHTML(
            'beforeend',
            createAlert('Unable to reach the backend API. Check server status.', 'danger')
          );
        });
    });
  }
}

// Navigate without full page refresh and update browser history.
function navigateTo(path) {
  window.history.pushState({}, '', path);
  renderRoute(path);
}

// Handle click events on sidebar nav buttons.
function bindNavigation() {
  const links = document.querySelectorAll('[data-route]');
  links.forEach((link) => {
    link.addEventListener('click', () => {
      navigateTo(link.dataset.route);
    });
  });
}

// Handle browser back/forward buttons.
window.addEventListener('popstate', () => {
  renderRoute(window.location.pathname);
});

// Refresh button simply re-renders the current route.
refreshButton.addEventListener('click', () => {
  renderRoute(window.location.pathname);
});

// Initialize the app router once the DOM is ready.
function initRouter() {
  bindNavigation();
  renderRoute(window.location.pathname);
}

// Wait for DOM content to be loaded before bootstrapping the app.
document.addEventListener('DOMContentLoaded', initRouter);
