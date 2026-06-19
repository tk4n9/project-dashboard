// Vanilla client logic. Mutations go through fetch(JSON) then reload, keeping
// the server-rendered DOM as the single source of truth.
'use strict';

function postJSON(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- Main page ----------
const projectName = $('#project-name');
if (projectName) {
  projectName.addEventListener('change', () =>
    postJSON('/config', { project_name: projectName.value }));
}

const toggleCompleted = $('#toggle-completed');
if (toggleCompleted) {
  toggleCompleted.addEventListener('click', async () => {
    const next = toggleCompleted.getAttribute('aria-pressed') !== 'true';
    await postJSON('/config', { show_completed: next });
    location.reload();
  });
}

const toggleTheme = $('#toggle-theme');
if (toggleTheme) {
  toggleTheme.addEventListener('click', async () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    await postJSON('/config', { theme: next });
    location.reload(); // refresh the icon (sun/moon) and title
  });
}

const addForm = $('#add-form');
if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('#add-title').value.trim();
    if (!title) return;
    await postJSON('/todos', { title });
    location.reload();
  });
}

// Expand/collapse a todo's sessions box without resizing the top row.
$$('.todo .expand-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = btn.closest('.todo').querySelector('.todo-sessions');
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    btn.classList.toggle('open', opening);
  });
});

$$('.todo .toggle').forEach((cb) => {
  cb.addEventListener('change', async () => {
    const id = Number(cb.closest('.todo').dataset.id);
    await postJSON(`/todos/${id}/toggle`, {});
    location.reload();
  });
});

// ---------- Detail page ----------
const explanation = $('#explanation');
const saveExpl = $('#save-explanation');
if (saveExpl && explanation) {
  const todoId = location.pathname.split('/')[2];

  const titleInput = $('#todo-title');
  if (titleInput) {
    titleInput.addEventListener('change', () => {
      const v = titleInput.value.trim();
      if (v) postJSON(`/todos/${todoId}/title`, { title: v });
    });
  }

  saveExpl.addEventListener('click', async () => {
    await postJSON(`/todos/${todoId}/explanation`, { explanation: explanation.value });
    saveExpl.textContent = 'Saved ✓';
    setTimeout(() => { saveExpl.textContent = 'Save'; }, 1500);
  });

  const dueDate = $('#due-date');
  if (dueDate) {
    dueDate.addEventListener('change', () =>
      postJSON(`/todos/${todoId}/due`, { due_date: dueDate.value }));
  }

  // Write / Preview tabs.
  const preview = $('#preview');
  $$('.md-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      $$('.md-tabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isPreview = tab.dataset.tab === 'preview';
      explanation.hidden = isPreview;
      preview.hidden = !isPreview;
      if (isPreview) preview.innerHTML = await renderMarkdown(explanation.value);
    });
  });

  const startForm = $('#start-session');
  if (startForm) {
    startForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(startForm).entries());
      $('#start-status').textContent = 'Starting…';
      const res = await postJSON(`/todos/${todoId}/sessions`, data);
      const out = await res.json();
      if (!res.ok) { $('#start-status').textContent = out.error || 'Error'; return; }
      location.reload();
    });
  }
}

// Auto-refresh while any session is still resolving its remote URL.
if ($$('.status').some((s) => /starting/.test(s.textContent))) {
  setTimeout(() => location.reload(), 5000);
}

// Markdown: use `marked` from CDN if reachable; otherwise fall back to <pre>.
let markedPromise = null;
async function renderMarkdown(text) {
  if (window.marked) return window.marked.parse(text);
  if (!markedPromise) {
    markedPromise = import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js')
      .then((m) => { window.marked = m.marked || m; return window.marked; })
      .catch(() => null);
  }
  const marked = await markedPromise;
  if (marked) return marked.parse(text);
  const esc = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<pre>${esc}</pre>`;
}
