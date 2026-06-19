// Shared HTML chrome used by every page. Feature views build a `body` string
// and call ctx.page({title, body}); this wraps it with <head>, theme, and nav.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderNav(navItems, activePath) {
  if (!navItems.length) return '';
  const links = navItems
    .map((n) => {
      const active = n.href === activePath || (n.href !== '/' && activePath.startsWith(n.href));
      return `<a href="${esc(n.href)}" class="${active ? 'active' : ''}">${esc(n.label)}</a>`;
    })
    .join('');
  return `<nav class="appnav">${links}</nav>`;
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
export function layout({ title, body, theme = 'light', navItems = [], activePath = '/', bare = false }) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="${esc(theme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  ${bare ? '' : renderNav(navItems, activePath)}
  <main class="container">${body}</main>
  <script src="/static/app.js"></script>
</body>
</html>`;
}
