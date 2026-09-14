// verify-email.js
// UI for email verification confirmation in the marketing SPA.

export function VerifyEmailPage(status = 'pending', message = 'Verifying your email...') {
  return `
    <main class="max-w-3xl mx-auto px-6 py-14">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-200/60">
        <div class="mb-8 text-center">
          <p class="text-sm uppercase tracking-[0.3em] text-sky-600">Email verification</p>
          <h1 class="mt-4 text-3xl font-semibold text-slate-900">${status === 'success' ? 'Email verified' : 'Verify your email'}</h1>
          <p class="mt-3 text-slate-600">${message}</p>
        </div>
        <div class="text-center">
          <a href="#/login" class="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-700">Return to login</a>
        </div>
      </div>
    </main>
  `;
}
