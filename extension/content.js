/**
 * Theme Force — content script
 * Runs at document_start so the style is applied before any paint.
 */

// Cross-browser shim: Firefox exposes `browser`, Chrome exposes `chrome`.
const api = (typeof browser !== 'undefined' ? browser : chrome);

const STYLE_ID = 'theme-force-style';

function removeThemeStyles() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
  document.documentElement.classList.remove('__tf-invert');
}

function applyTheme(mode) {
  removeThemeStyles();
  if (mode === 'system') return;

  const style = document.createElement('style');
  style.id = STYLE_ID;

  if (mode === 'dark') {
    // color-scheme: dark  tells the browser / site to prefer dark rendering.
    // The @media block adds a CSS-filter invert fallback for sites that
    // ignore color-scheme (only fires when the OS is set to light).
    style.textContent = `
      :root { color-scheme: dark !important; }
      @media (prefers-color-scheme: light) {
        html.__tf-invert {
          filter: invert(1) hue-rotate(180deg) !important;
          background: #fff !important;
        }
        html.__tf-invert img,
        html.__tf-invert video,
        html.__tf-invert picture,
        html.__tf-invert canvas,
        html.__tf-invert svg image {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      }
    `;
  } else if (mode === 'light') {
    // Mirror logic for forcing light on systems set to dark.
    style.textContent = `
      :root { color-scheme: light !important; }
      @media (prefers-color-scheme: dark) {
        html.__tf-invert {
          filter: invert(1) hue-rotate(180deg) !important;
          background: #000 !important;
        }
        html.__tf-invert img,
        html.__tf-invert video,
        html.__tf-invert picture,
        html.__tf-invert canvas,
        html.__tf-invert svg image {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      }
    `;
  }

  // Insert at the top of <head> (or <html>) before any other styles so it
  // can be overridden by site styles when color-scheme is respected.
  const target = document.head || document.documentElement;
  target.insertBefore(style, target.firstChild);

  document.documentElement.classList.add('__tf-invert');
}

// Re-apply whenever the background broadcasts a theme change.
api.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'apply-theme') {
    applyTheme(msg.mode);
  }
});

// Ask the background for the stored setting as soon as the script loads.
api.runtime.sendMessage({ type: 'get-theme' }, (response) => {
  if (api.runtime.lastError) return; // tab not connected yet — safe to ignore
  if (response && response.mode) {
    applyTheme(response.mode);
  }
});
