// forgot.js
// Forgot Password UI for marketing site (frontend-only placeholder).

export function ForgotPage(loginType = 'school') {
  const header = loginType === 'platform_admin' ? 'Platform admin password reset' : 'Forgot password';
  const description = loginType === 'platform_admin'
    ? 'Enter your Globy admin email to receive password reset instructions.'
    : 'Enter your email to receive password reset instructions.';
  const loginLink = loginType === 'platform_admin' ? '#/platform-admin' : '#/login';

  return `
    <main class="max-w-2xl mx-auto px-6 py-12">
      <h2 class="text-2xl font-semibold">${header}</h2>
      <p class="mt-2 text-sm text-slate-600">${description}</p>
      <form id="forgot-form" class="mt-6 grid gap-4">
        <label class="block text-sm text-slate-700">
          Email address
          <input type="email" id="forgot-email" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="you@school.edu" required />
        </label>
        <button type="submit" class="rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-700">Send reset link</button>
        <div id="forgot-message" class="min-h-[2rem] text-sm text-slate-600"></div>
        <p class="text-center text-sm text-slate-500">Remembered your password? <a href="${loginLink}" class="font-semibold text-sky-600">Return to login</a></p>
      </form>
    </main>
  `;
}
