// platform-admin.js
// Dedicated login UI for Globy platform administrators.
// This page is intentionally separate from school login and preserves the existing marketing SPA architecture.

export function PlatformAdminPage() {
  return `
    <main class="max-w-4xl mx-auto px-6 py-14">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-200/60">
        <div class="grid gap-10 lg:grid-cols-[0.9fr_0.6fr] items-start">
          <section>
            <p class="text-sm uppercase tracking-[0.3em] text-sky-600">Platform Administrator</p>
            <h1 class="mt-4 text-4xl font-semibold text-slate-900">Secure Globy Technologies access</h1>
            <p class="mt-4 text-slate-600">This login portal is only for Globy platform administrators. Use your work email and password to access the Super Admin dashboard.</p>
            <div class="mt-10 grid gap-4 rounded-[2rem] bg-slate-50 p-6 text-slate-700 shadow-sm">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Administrator accounts</p>
                <p class="mt-2 text-sm">Only approved Globy admin emails may sign in on this page.</p>
              </div>
              <div class="text-sm">
                <p class="font-semibold text-slate-900">Platform super admins</p>
                <p class="mt-2 text-slate-600">Enter the email assigned to your platform administrator account to continue.</p>
              </div>
            </div>
          </section>

          <section class="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <form id="platform-admin-form" class="grid gap-5">
              <label class="block text-sm text-slate-700">
                Email
                <input type="email" id="platform-admin-email" required placeholder="you@globy.com" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
              </label>

              <label class="block text-sm text-slate-700">
                Password
                <input type="password" id="platform-admin-password" required placeholder="••••••••" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
              </label>

              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" id="platform-admin-remember" class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                  Remember me
                </label>
                <a href="#/forgot?type=platform_admin" class="text-sm font-semibold text-sky-600 transition hover:text-sky-700">Forgot password?</a>
              </div>

              <button type="submit" class="rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-700">Sign in</button>

              <div id="platform-admin-message" class="min-h-[2rem] text-sm"></div>

              <p class="text-center text-sm text-slate-500">Need help? Contact <a href="mailto:support@globyedu.com" class="font-semibold text-sky-600">support@globyedu.com</a>.</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  `;
}
