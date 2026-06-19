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

const showCompleted = $('#show-completed');
if (showCompleted) {
  showCompleted.addEventListener('change', async () => {
    await postJSON('/config', { show_completed: showCompleted.checked });
    location.reload();
  });
}

const darkMode = $('#dark-mode');
if (darkMode) {
  darkMode.addEventListener('change', async () => {
    const theme = darkMode.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    await postJSON('/config', { theme });
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

const deleteSelected = $('#delete-selected');
if (deleteSelected) {
  deleteSelected.addEventListener('click', async () => {
    const ids = $$('.todo .select:checked').map((c) => Number(c.value));
    if (!ids.length) { alert('No todos selected.'); return; }
    if (!confirm(`Delete ${ids.length} todo(s)? This also kills their Claude sessions.`)) return;
    await postJSON('/todos/delete', { ids });
    location.reload();
  });
}

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
