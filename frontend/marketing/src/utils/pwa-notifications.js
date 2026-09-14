export function showGlobalPwaNotice({ title, message, type = 'info', primaryText = 'OK', secondaryText = null, onPrimary = null, onSecondary = null, autoHide = true, duration = 5000 }) {
  const bannerId = 'globyedu-pwa-notice';
  let banner = document.getElementById(bannerId);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = bannerId;
    banner.className = 'fixed inset-x-0 top-4 z-50 mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-300';
    document.body.appendChild(banner);
  }

  const tone = type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-900' : type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-slate-900 border-slate-700 text-white';

  banner.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${tone}">
      <div>
        <p class="text-sm font-semibold">${title}</p>
        <p class="mt-1 text-sm leading-6">${message}</p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        ${secondaryText ? `<button id="pwa-notice-secondary" class="rounded-full border border-current px-4 py-2 text-sm font-semibold transition hover:opacity-90">${secondaryText}</button>` : ''}
        <button id="pwa-notice-primary" class="rounded-full bg-current px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">${primaryText}</button>
      </div>
    </div>
  `;

  banner.classList.remove('translate-y-[-120%]');
  banner.classList.add('translate-y-0');

  const cleanup = () => {
    banner.classList.add('translate-y-[-120%]');
    setTimeout(() => {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  };

  const primaryBtn = document.getElementById('pwa-notice-primary');
  if (primaryBtn && onPrimary) {
    primaryBtn.addEventListener('click', () => {
      onPrimary();
      cleanup();
    });
  }

  const secondaryBtn = document.getElementById('pwa-notice-secondary');
  if (secondaryBtn && onSecondary) {
    secondaryBtn.addEventListener('click', () => {
      onSecondary();
      cleanup();
    });
  }

  if (autoHide) {
    setTimeout(cleanup, duration);
  }
}
