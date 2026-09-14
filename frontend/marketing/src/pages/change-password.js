export function ChangePasswordPage() {
  return `
    <main class="mx-auto max-w-3xl px-6 py-14">
      <div class="rounded-4xl border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-200/60">
        <div class="mb-8 text-center">
          <p class="text-sm uppercase tracking-[0.3em] text-amber-600">Password change required</p>
          <h1 class="mt-4 text-3xl font-semibold text-slate-900">Set a new password</h1>
          <p class="mt-3 text-slate-600">Your temporary password must be replaced before you can continue.</p>
        </div>
        <form id="change-password-form" class="grid gap-5">
          <label class="block text-sm text-slate-700">
            Current temporary password
            <input type="password" id="current-password" required autocomplete="current-password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
          </label>
          <label class="block text-sm text-slate-700">
            New password
            <input type="password" id="new-password" required autocomplete="new-password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
          </label>
          <label class="block text-sm text-slate-700">
            Confirm new password
            <input type="password" id="confirm-new-password" required autocomplete="new-password" class="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
          </label>
          <button type="submit" class="rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-700">Change password</button>
          <div id="change-password-message" class="min-h-8 text-sm"></div>
        </form>
      </div>
    </main>
  `;
}