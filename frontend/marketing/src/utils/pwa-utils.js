const UPDATE_STATUS_KEY = 'globyedu_pwa_update_status';
const DRAFT_PREFIX = 'globyedu_draft_';

export function setPwaUpdateAvailable(available) {
  localStorage.setItem(UPDATE_STATUS_KEY, JSON.stringify({ available, timestamp: Date.now() }));
}

export function getPwaUpdateAvailable() {
  try {
    const stored = localStorage.getItem(UPDATE_STATUS_KEY);
    return stored ? JSON.parse(stored).available : false;
  } catch {
    return false;
  }
}

export function clearPwaUpdateAvailable() {
  localStorage.removeItem(UPDATE_STATUS_KEY);
}

export function saveDraft(key, data) {
  if (!key || !data) return;
  try {
    const safeKey = `${DRAFT_PREFIX}${key}`;
    localStorage.setItem(safeKey, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch {
    // Ignore storage errors for draft saves.
  }
}

export function loadDraft(key) {
  if (!key) return null;
  try {
    const safeKey = `${DRAFT_PREFIX}${key}`;
    const stored = localStorage.getItem(safeKey);
    if (!stored) return null;
    return JSON.parse(stored).data || null;
  } catch {
    return null;
  }
}

export function clearDraft(key) {
  if (!key) return;
  try {
    const safeKey = `${DRAFT_PREFIX}${key}`;
    localStorage.removeItem(safeKey);
  } catch {
    // Ignore.
  }
}

export function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
