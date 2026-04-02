/**
 * Theme Force — background service worker
 * Stores the global theme preference and broadcasts it to all tabs.
 */

const api = (typeof browser !== 'undefined' ? browser : chrome);

const DEFAULT_MODE = 'system';

// ── helpers ──────────────────────────────────────────────────────────────────

async function getStoredMode() {
  return new Promise((resolve) => {
    api.storage.local.get('mode', (result) => {
      resolve(result.mode || DEFAULT_MODE);
    });
  });
}

async function setStoredMode(mode) {
  return new Promise((resolve) => {
    api.storage.local.set({ mode }, resolve);
  });
}

async function applyToTab(tabId, mode) {
  try {
    await api.tabs.sendMessage(tabId, { type: 'apply-theme', mode });
  } catch (_) {
    // Tab may not have a content script (e.g. browser internal pages) — ignore.
  }
}

async function applyToAllTabs(mode) {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      applyToTab(tab.id, mode);
    }
  }
}

// ── message handler ──────────────────────────────────────────────────────────

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;

  if (msg.type === 'get-theme') {
    getStoredMode().then((mode) => sendResponse({ mode }));
    return true; // keep channel open for async response
  }

  if (msg.type === 'set-theme') {
    const mode = msg.mode;
    setStoredMode(mode).then(async () => {
      await applyToAllTabs(mode);
      sendResponse({ ok: true, mode });
    });
    return true;
  }

  return false;
});

// ── apply stored theme when a tab finishes loading ───────────────────────────

api.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    const mode = await getStoredMode();
    if (mode !== 'system') {
      applyToTab(tabId, mode);
    }
  }
});
