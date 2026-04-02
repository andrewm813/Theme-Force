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

// Load and show the current setting
api.runtime.sendMessage({ type: 'get-theme' }, (response) => {
  if (api.runtime.lastError) return;
  setActiveButton((response && response.mode) || 'system');
});

// Handle button clicks
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
