// login.js
// Login view templates for the GlobyEdu OS frontend.

// Build the login screen HTML for a list of available tenants.
export function createLoginView(schoolOptions = []) {
  const schoolHtml = schoolOptions
    .map(
      (school) =>
        `<option value="${school.schoolId}">${school.name}</option>`
    )
    .join('');

  return `
    <section class="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div class="max-w-xl w-full bg-white border border-slate-200 rounded-3xl shadow-lg p-8">
        <div class="mb-8 text-center">
          <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Multi-tenant login</p>
          <h1 class="mt-4 text-3xl font-semibold text-slate-900">Access GlobyEdu Dashboard</h1>
          <p class="mt-2 text-slate-600">Select your school and sign in with your academic account.</p>
        </div>

        <form id="login-form" class="space-y-5">
          <div>
            <label for="school-select" class="block text-sm font-medium text-slate-700">School</label>
            <select
              id="school-select"
              class="mt-2 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              <option value="">Choose school</option>
              ${schoolHtml}
            </select>
          </div>

          <div>
            <label for="username-input" class="block text-sm font-medium text-slate-700">Student / Teacher email</label>
            <input
              id="username-input"
              type="text"
              placeholder="Enter your email"
              class="mt-2 block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div>
            <label for="password-input" class="block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password-input"
              type="password"
              placeholder="Enter your password"
              class="mt-2 block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div id="login-message" class="min-h-[2rem]"></div>

          <button
            type="submit"
            class="w-full rounded-2xl bg-blue-700 px-5 py-3 text-white text-base font-semibold shadow-lg shadow-blue-500/10 transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Continue to Dashboard
          </button>
        </form>
      </div>
    </section>
  `;
}

// Build the post-login dashboard view based on the authenticated role.
export function createDashboardView(role, username, schoolName) {
  const roleText = role === 'teacher' ? 'Teacher workspace' : role === 'student' ? 'Student portal' : 'Admin control panel';

  return `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.2em] text-slate-400">${schoolName}</p>
          <h1 class="text-3xl font-semibold text-slate-900">Welcome back, ${username}</h1>
          <p class="mt-2 text-slate-600">You are signed in as <span class="font-medium text-slate-900">${roleText}</span>.</p>
        </div>
        <button id="logout-button" class="btn-secondary">Sign out</button>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <article class="card">
          <h2 class="text-xl font-semibold text-slate-900">Quick start</h2>
          <p class="mt-3 text-slate-600">Use the sidebar to navigate to student, lesson, and settings modules as they are built.</p>
        </article>
        <article class="card">
          <h2 class="text-xl font-semibold text-slate-900">Role summary</h2>
          <p class="mt-3 text-slate-600">Your dashboard content will adjust for <strong>${role}</strong> access in the next phase.</p>
        </article>
      </div>
    </section>
  `;
}
