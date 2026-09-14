// register.js
// Create school account page for the marketing experience.

export function RegisterPage() {
  return `
    <main class="max-w-4xl mx-auto px-6 py-14">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-200/60">
        <div class="mb-8 text-center">
          <p class="text-sm uppercase tracking-[0.3em] text-sky-600">Start your free trial</p>
          <h1 class="mt-4 text-3xl font-semibold text-slate-900">Create your school account in minutes</h1>
          <p class="mt-3 text-slate-600">Sign up now and automatically activate a 3-day free trial for your school.</p>
        </div>
        <form id="register-form" class="grid gap-6">
          <div class="grid gap-6 lg:grid-cols-2">
            <label class="block text-sm text-slate-700">
              School Name
              <input type="text" id="school-name" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Example International School" required />
            </label>
            <label class="block text-sm text-slate-700">
              Administrator Name
              <input type="text" id="admin-name" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Jane Doe" required />
            </label>
          </div>
          <div class="grid gap-6 lg:grid-cols-2">
            <label class="block text-sm text-slate-700">
              School Email
              <input type="email" id="school-email" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="admin@school.edu" required />
            </label>
            <label class="block text-sm text-slate-700">
              Phone
              <input type="tel" id="school-phone" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="+1 555 123 4567" required />
            </label>
          </div>
          <div class="grid gap-6 lg:grid-cols-2">
            <label class="block text-sm text-slate-700">
              Country
              <input type="text" id="school-country" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="United States" required />
            </label>
            <label class="block text-sm text-slate-700">
              Password
              <input type="password" id="password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Create a strong password" required />
            </label>
          </div>
          <label class="block text-sm text-slate-700">
            Confirm Password
            <input type="password" id="confirm-password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Confirm your password" required />
          </label>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="submit" class="inline-flex items-center justify-center rounded-full bg-sky-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-sky-700">Create School Account</button>
            <button id="google-register" type="button" class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50">Google Sign In</button>
          </div>
          <div id="register-message" class="min-h-[2rem] text-sm text-slate-600"></div>
          <p class="text-center text-sm text-slate-500">Already registered? <a href="#/login" class="font-semibold text-sky-600">Login here</a>.</p>
        </form>
      </div>
    </main>
  `;
}
