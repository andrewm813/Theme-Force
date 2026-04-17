/**
 * Theme Force — background service worker
 * Stores the global theme preference and broadcasts it to all tabs.
 */

const api = (typeof browser !== 'undefined' ? browser : chrome);

const DEFAULT_MODE = 'system';
const VALID_MODES = new Set(['dark', 'light', 'system']);

// ── helpers ──────────────────────────────────────────────────────────────────

async function getStoredSettings() {
  return new Promise((resolve) => {
    api.storage.local.get(['mode', 'excludedHosts'], (result) => {
      const mode = VALID_MODES.has(result.mode) ? result.mode : DEFAULT_MODE;
      const excludedHosts = Array.isArray(result.excludedHosts)
        ? result.excludedHosts.filter((host) => typeof host === 'string' && host.length > 0)
        : [];

      resolve({ mode, excludedHosts });
    });
  });
}

async function setStoredMode(mode) {
  return new Promise((resolve) => {
    api.storage.local.set({ mode }, resolve);
  });
}

async function setStoredExcludedHosts(excludedHosts) {
  return new Promise((resolve) => {
    api.storage.local.set({ excludedHosts }, resolve);
  });
}

function getHostFromUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.hostname.toLowerCase()
      : null;
  } catch (_) {
    return null;
  }
}

function getEffectiveModeForUrl(url, mode, excludedHosts) {
  const host = getHostFromUrl(url);
  if (host && excludedHosts.includes(host)) {
    return 'system';
  }
  return mode;
}

async function applyToTab(tabId, mode) {
  try {
    await api.tabs.sendMessage(tabId, { type: 'apply-theme', mode });
  } catch (_) {
    // Tab may not have a content script (e.g. browser internal pages) — ignore.
  }
}

async function applyToAllTabs(mode, excludedHosts) {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      const effectiveMode = getEffectiveModeForUrl(tab.url, mode, excludedHosts);
      applyToTab(tab.id, effectiveMode);
    }
  }
}

async function applyToHostTabs(host, mode, excludedHosts) {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const tabHost = getHostFromUrl(tab.url);
    if (tabHost !== host) continue;
    const effectiveMode = getEffectiveModeForUrl(tab.url, mode, excludedHosts);
    applyToTab(tab.id, effectiveMode);
  }
}

// ── message handler ──────────────────────────────────────────────────────────

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;

  if (msg.type === 'get-theme') {
    getStoredSettings().then(({ mode }) => sendResponse({ mode }));
    return true; // keep channel open for async response
  }

  if (msg.type === 'get-theme-for-url') {
    getStoredSettings().then(({ mode, excludedHosts }) => {
      const effectiveMode = getEffectiveModeForUrl(msg.url, mode, excludedHosts);
      sendResponse({ mode: effectiveMode });
    });
    return true;
  }

  if (msg.type === 'set-theme') {
    const mode = msg.mode;
    if (!VALID_MODES.has(mode)) {
      sendResponse({ ok: false, error: 'invalid-mode' });
      return false;
    }

    setStoredMode(mode).then(async () => {
      const { excludedHosts } = await getStoredSettings();
      await applyToAllTabs(mode, excludedHosts);
      sendResponse({ ok: true, mode });
    });
    return true;
  }

  if (msg.type === 'get-site-exclusion') {
    getStoredSettings().then(({ excludedHosts }) => {
      const host = (typeof msg.host === 'string' ? msg.host.toLowerCase() : '');
      sendResponse({ excluded: Boolean(host) && excludedHosts.includes(host) });
    });
    return true;
  }

  if (msg.type === 'set-site-excluded') {
    const host = (typeof msg.host === 'string' ? msg.host.toLowerCase() : '');
    const excluded = Boolean(msg.excluded);

    if (!host) {
      sendResponse({ ok: false, error: 'invalid-host' });
      return false;
    }

    getStoredSettings().then(async ({ mode, excludedHosts }) => {
      const updatedHosts = excluded
        ? Array.from(new Set([...excludedHosts, host]))
        : excludedHosts.filter((h) => h !== host);

      await setStoredExcludedHosts(updatedHosts);
      await applyToHostTabs(host, mode, updatedHosts);

      sendResponse({ ok: true, host, excluded });
    });
    return true;
  }

  return false;
});

// ── apply stored theme when a tab finishes loading ───────────────────────────

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const { mode, excludedHosts } = await getStoredSettings();
    const effectiveMode = getEffectiveModeForUrl(tab && tab.url, mode, excludedHosts);
    applyToTab(tabId, effectiveMode);
  }
});
