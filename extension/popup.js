/**
 * Theme Force — popup script
 */

const api = (typeof browser !== 'undefined' ? browser : chrome);

const LABELS = { dark: 'Dark', light: 'Light', system: 'System Default' };

function setActiveButton(mode) {
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const label = document.getElementById('current-label');
  if (label) label.textContent = LABELS[mode] || mode;
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

function setSiteToggleDisabled(disabled) {
  const input = document.getElementById('site-excluded');
  const label = document.querySelector('.site-toggle');
  if (input) input.disabled = disabled;
  if (label) label.classList.toggle('disabled', disabled);
}

function initGlobalMode() {
  api.runtime.sendMessage({ type: 'get-theme' }, (response) => {
    if (api.runtime.lastError) return;
    setActiveButton((response && response.mode) || 'system');
  });

  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      api.runtime.sendMessage({ type: 'set-theme', mode }, (response) => {
        if (api.runtime.lastError) return;
        if (response && response.ok) {
          setActiveButton(mode);
        }
      });
    });
  });
}

function initSiteExclusion() {
  const hostLabel = document.getElementById('site-host');
  const exclusionInput = document.getElementById('site-excluded');

  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (api.runtime.lastError || !tabs || !tabs[0]) {
      setSiteToggleDisabled(true);
      return;
    }

    const host = getHostFromUrl(tabs[0].url);
    if (!host) {
      if (hostLabel) hostLabel.textContent = 'Current site: unavailable (restricted page)';
      setSiteToggleDisabled(true);
      return;
    }

    if (hostLabel) hostLabel.textContent = `Current site: ${host}`;
    setSiteToggleDisabled(false);

    api.runtime.sendMessage({ type: 'get-site-exclusion', host }, (response) => {
      if (api.runtime.lastError || !exclusionInput) return;
      exclusionInput.checked = Boolean(response && response.excluded);
    });

    if (exclusionInput) {
      exclusionInput.addEventListener('change', () => {
        api.runtime.sendMessage(
          { type: 'set-site-excluded', host, excluded: exclusionInput.checked },
          () => {
            // No-op; background handles immediate tab updates.
          }
        );
      });
    }
  });
}

initGlobalMode();
initSiteExclusion();
