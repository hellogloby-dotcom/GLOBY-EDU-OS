// login.js
// Role-based login page for the GlobyEdu marketing SPA.

export function LoginPage() {
  return `
    <main class="max-w-5xl mx-auto px-4 py-10">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/40">
        <div class="mb-8 text-center">
          <p class="text-sm uppercase tracking-[0.3em] text-sky-600">Role selection</p>
          <h1 class="mt-4 text-3xl font-semibold text-slate-900">Secure sign in to GlobyEdu</h1>
          <p class="mt-3 text-slate-600">Choose the role that matches your school account and continue with the right experience.</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          ${renderRoleCard('school_authority', 'School Authority', 'Access school management tools for heads and administrators.')}
          ${renderRoleCard('teacher', 'Teacher', 'Enter classroom tools, lesson plans, and student records.')}
          ${renderRoleCard('student', 'Student', 'Open learning activities, grades, and assignments.')}
        </div>

        <div class="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <a href="#/platform-admin" id="super-admin-portal" class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">Super Admin Login</a>
          <span class="text-sm text-slate-500">Open the secure Super Admin authentication page.</span>
        </div>

        <div id="role-login-panel" class="mt-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Selected role</p>
              <h2 id="selected-role-title" class="mt-2 text-xl font-semibold text-slate-900">School Authority</h2>
              <p id="selected-role-description" class="mt-3 text-sm text-slate-600">Use your school email and tenant ID to access administrative tools.</p>
            </div>
            <span id="selected-role-badge" class="inline-flex rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">School authority</span>
          </div>

          <form id="login-form" class="mt-8 space-y-5">
            <input type="hidden" id="login-role" value="school_authority" />
            <div id="field-school-id-group">
              <label id="field-school-id-label" class="block text-sm text-slate-700">
                School ID
                <input id="school-id" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="globy-school" />
              </label>
            </div>

            <label class="block text-sm text-slate-700">
              <span id="field-username-label" data-role-labels='{"school_authority":"School Email","teacher":"Email","student":"Email"}'>School Email</span>
              <input id="student-id" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="head@school.edu" aria-label="School or account email" />
            </label>

            <div id="field-school-name-group" class="grid gap-4 lg:grid-cols-2">
              <label class="block text-sm text-slate-700">
                School Name
                <input id="school-name" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Globy School" />
              </label>
              <label class="block text-sm text-slate-700">
                Secure session
                <div class="mt-3 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3">
                  <input id="remember-me" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400" />
                  <span class="text-sm text-slate-600">Keep me signed in on this device.</span>
                </div>
              </label>
            </div>

            <div id="teacher-details" class="grid gap-4 lg:grid-cols-2 hidden">
              <label class="block text-sm text-slate-700">
                Teacher name
                <input id="teacher-name" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Jane Doe" />
              </label>
              <div></div>
            </div>

            <div id="student-details" class="grid gap-4 lg:grid-cols-2 hidden">
              <label class="block text-sm text-slate-700">
                Student name
                <input id="student-name" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Jane Doe" />
              </label>
              <label class="block text-sm text-slate-700">
                Class
                <input id="student-class" type="text" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Form 1A" />
              </label>
            </div>

            <label class="block text-sm text-slate-700">
              Password
              <input id="password" type="password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="••••••••" />
            </label>

            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" id="google-signin" class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50">Google Sign In</button>
              <button type="submit" class="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">Sign in</button>
            </div>

            <div id="login-message" class="min-h-[2rem] text-sm text-slate-600"></div>

            <p class="text-center text-sm text-slate-500">New to GlobyEdu? <a href="#/register" class="font-semibold text-sky-600 hover:text-sky-700">Register your school</a>.</p>
          </form>
        </div>
      </div>
    </main>
  `;
}

function renderRoleCard(role, title, description) {
  return `
    <button type="button" data-login-role="${role}" class="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-sky-300 hover:bg-white">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-slate-900">${title}</p>
          <p class="mt-3 text-sm text-slate-500">${description}</p>
        </div>
        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700">→</span>
      </div>
    </button>
  `;
}
