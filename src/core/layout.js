// Shared HTML chrome used by every page. Feature views build a `body` string
// and call ctx.page({title, body}); this wraps it with <head>, theme, and nav.

import { ICON, ALIGN_ICON } from './icons.js';
import { config } from '../config.js';

// Prefix an internal path with the configured base_path (subpath hosting).
export const u = (p) => config.base_path + p;

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderNav(navItems, activePath, theme, align) {
  const links = navItems
    .map((n) => {
      const active = u(n.href) === activePath || (n.href !== '/' && activePath.startsWith(u(n.href)));
      return `<a href="${esc(u(n.href))}" class="${active ? 'active' : ''}">${esc(n.label)}</a>`;
    })
    .join('');
  // Global config controls (alignment + theme) live in the nav so they appear on every page.
  const controls = `<div class="nav-controls">
    <button id="toggle-align" class="icon-toggle" data-align="${esc(align)}"
            title="cycle body alignment (left / center / right / fit-width)">${ICON[ALIGN_ICON[align] || 'alignCenter']}</button>
    <button id="toggle-theme" class="icon-toggle"
            title="toggle dark mode">${theme === 'dark' ? ICON.moon : ICON.sun}</button>
  </div>`;
  return `<nav class="appnav"><div class="nav-links">${links}</div>${controls}</nav>`;
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body        already-escaped/composed HTML
 * @param {string} [o.theme]     'light' | 'dark'
 * @param {Array}  [o.navItems]  [{label, href}]
 * @param {string} [o.activePath]
 * @param {boolean}[o.bare]      omit nav chrome (e.g. login)
 */
const ALIGNS = ['left', 'center', 'right', 'fit'];

export function layout({ title, body, theme = 'light', navItems = [], activePath = '/', bare = false, align = 'center' }) {
  const alignClass = ALIGNS.includes(align) ? align : 'center';
  return `<!DOCTYPE html>
<html lang="en" data-theme="${esc(theme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="${u('/static/app.css')}">
</head>
<body data-base="${esc(config.base_path)}">
  ${bare ? '' : renderNav(navItems, activePath, theme, alignClass)}
  <main class="container align-${alignClass}">${body}</main>
  <script src="${u('/static/app.js')}"></script>
</body>
</html>`;
}
