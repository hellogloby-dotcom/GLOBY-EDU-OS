const PUSH_PREFS_KEY = 'globyedu_push_preferences';
const DEFAULT_PUSH_PREFS = {
  enabled: false,
  categories: {
    announcements: true,
    attendance: true,
    finance: true,
    messages: true,
    reports: true,
    ai: true,
    supportTickets: true,
    systemUpdates: true,
  },
};

export function getPushPreferences() {
  try {
    const saved = localStorage.getItem(PUSH_PREFS_KEY);
    return saved ? JSON.parse(saved) : { ...DEFAULT_PUSH_PREFS };
  } catch {
    return { ...DEFAULT_PUSH_PREFS };
  }
}

export function savePushPreferences(prefs) {
  const next = { ...getPushPreferences(), ...prefs };
  localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(next));
  return next;
}

export function dispatchPushNotification(payload) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const { title, body, category = 'systemUpdates', icon = '/src/assets/images/ui/operations-hero.svg', data = {} } = payload;
  const tag = `globyedu-${category}-${Date.now()}`;
  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification(title, {
      body,
      icon,
      badge: '/src/assets/images/ui/operations-hero.svg',
      tag,
      data,
      renotify: true,
    });
  });
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  const permission = await Notification.requestPermission();
  return permission;
}
