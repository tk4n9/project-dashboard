// Todos feature: the main page (todo list + config) and the per-todo detail
// page (explanation, due date, Claude remote-control sessions).
//
// This is the reference example for how a feature is built: views are plain
// functions returning HTML strings; handlers read ctx and call ctx.page/ctx.json.
import { esc } from '../core/layout.js';
import { ICON } from '../core/icons.js';
import { startSession, killSession, tmuxAvailable } from '../sessions.js';

const MODELS = ['opus', 'sonnet', 'haiku', 'fable'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// ---------- DB helpers ----------
const allTodos = (db) => db.prepare('SELECT * FROM todos ORDER BY position, id').all();
const getTodo = (db, id) => db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
const todoSessions = (db, id) =>
  db.prepare('SELECT * FROM sessions WHERE todo_id = ? ORDER BY id DESC').all(id);

// ---------- Views ----------
function dueBadge(due) {
  if (!due) return '';
  const today = new Date().toISOString().slice(0, 10);
  return `<span class="due ${due < today ? 'overdue' : ''}">${esc(due)}</span>`;
}

function sessionItem(s) {
  const status = `<span class="status ${s.remote_url ? 'ok' : ''}">${esc(s.status)}</span>`;
  return s.remote_url
    ? `<li><a href="${esc(s.remote_url)}" target="_blank" rel="noopener">${esc(s.name)}</a> ${status}</li>`
    : `<li><span class="muted">${esc(s.name)}</span> ${status}</li>`;
}

function todoRow(t, sessions) {
  const links = sessions.length
    ? sessions.map(sessionItem).join('')
    : '<li class="muted">No sessions yet.</li>';
  return `
  <li class="todo ${t.done ? 'done' : ''}" data-id="${t.id}">
    <div class="todo-main">
      <input type="checkbox" class="toggle" ${t.done ? 'checked' : ''} aria-label="Mark done">
      <a class="title" href="/todos/${t.id}">${esc(t.title)}</a>
      ${dueBadge(t.due_date)}
      <button type="button" class="expand-btn" aria-expanded="false" aria-label="Show sessions">▾</button>
      <button type="button" class="todo-delete danger" aria-label="Delete todo">✕</button>
    </div>
    <div class="todo-sessions" hidden>
      <div class="sessions-box">
        <ul class="sessions">${links}</ul>
      </div>
    </div>
  </li>`;
}

function mainView(settings, todos, sessionsByTodo) {
  const visible = settings.show_completed ? todos : todos.filter((t) => !t.done);
  const rows = visible.map((t) => todoRow(t, sessionsByTodo[t.id] || [])).join('');
  return `
    <header class="topbar">
      <input id="project-name" class="project-name" value="${esc(settings.project_name)}" aria-label="Project name">
      <div class="settings">
        <button id="toggle-completed" class="icon-toggle ${settings.show_completed ? 'active' : ''}"
                aria-pressed="${settings.show_completed ? 'true' : 'false'}"
                title="toggle completed todo block visibility">${settings.show_completed ? ICON.eye : ICON.eyeOff}</button>
      </div>
    </header>
    <div class="toolbar">
      <form id="add-form" class="add-form">
        <input type="text" id="add-title" placeholder="New todo title…" required>
        <button type="submit">+ Add</button>
      </form>
    </div>
    <ul class="todo-list">${rows || '<li class="muted empty">No todos. Add one above.</li>'}</ul>`;
}

function detailView(todo, sessions, targetDir) {
  const links = sessions.length ? sessions.map(sessionItem).join('') : '<li class="muted">No sessions yet.</li>';
  return `
    <p><a href="/todos" class="back">← Back</a></p>
    <input id="todo-title" class="detail-title" value="${esc(todo.title)}" aria-label="Todo title">

    <section class="card">
      <div class="md-tabs">
        <button type="button" class="tab active" data-tab="write">Write</button>
        <button type="button" class="tab" data-tab="preview">Preview</button>
      </div>
      <textarea id="explanation" class="explanation" rows="10"
        placeholder="Task explanation (markdown). Also used as boilerplate prompt for Claude sessions.">${esc(todo.explanation)}</textarea>
      <div id="preview" class="preview md-body" hidden></div>
      <div class="row">
        <button id="save-explanation">Save</button>
        <label class="due-edit">Due: <input type="date" id="due-date" value="${esc(todo.due_date || '')}"></label>
      </div>
    </section>
    <section class="card">
      <h2>Claude sessions</h2>
      <ul class="sessions">${links}</ul>
    </section>
    <section class="card">
      <h2>Start a session</h2>
      <form id="start-session" class="start-form">
        <label>Session name <input type="text" name="name" required></label>
        <label>Working directory <input type="text" name="cwd" value="${esc(targetDir)}"></label>
        <label>Prompt (appended after the explanation above)
          <textarea name="prompt" rows="3"></textarea></label>
        <div class="row">
          <label>Model <select name="model">${MODELS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select></label>
          <label>Effort <select name="effort">${EFFORTS.map((e) => `<option value="${e}"${e === 'high' ? ' selected' : ''}>${e}</option>`).join('')}</select></label>
        </div>
        <button type="submit">Start session</button>
        <span id="start-status" class="muted"></span>
      </form>
    </section>`;
}

// ---------- Handlers ----------
function home(ctx) {
  const todos = allTodos(ctx.db);
  const sessionsByTodo = {};
  for (const t of todos) sessionsByTodo[t.id] = todoSessions(ctx.db, t.id);
  const settings = ctx.settings();
  ctx.page({ title: `${settings.project_name} — Dashboard`, body: mainView(settings, todos, sessionsByTodo) });
}

function detail(ctx) {
  const todo = getTodo(ctx.db, Number(ctx.params.id));
  if (!todo) return ctx.notFound('Todo not found');
  ctx.page({
    title: `${todo.title} — Dashboard`,
    body: detailView(todo, todoSessions(ctx.db, todo.id), ctx.runtime.target_dir),
  });
}

async function updateConfig(ctx) {
  const b = await ctx.body();
  if (typeof b.project_name === 'string' && b.project_name.trim())
    ctx.db.prepare('UPDATE config SET project_name = ? WHERE id = 1').run(b.project_name.trim());
  if (b.show_completed !== undefined)
    ctx.db.prepare('UPDATE config SET show_completed = ? WHERE id = 1').run(b.show_completed ? 1 : 0);
  if (b.theme === 'light' || b.theme === 'dark')
    ctx.db.prepare('UPDATE config SET theme = ? WHERE id = 1').run(b.theme);
  if (['left', 'center', 'right', 'fit'].includes(b.container_align))
    ctx.db.prepare('UPDATE config SET container_align = ? WHERE id = 1').run(b.container_align);
  ctx.json(200, { ok: true });
}

async function addTodo(ctx) {
  const b = await ctx.body();
  const title = (b.title || '').trim();
  if (!title) return ctx.json(400, { error: 'title required' });
  const max = ctx.db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM todos').get().m;
  const info = ctx.db.prepare('INSERT INTO todos (title, position) VALUES (?, ?)').run(title, max + 1);
  ctx.json(200, { ok: true, id: info.lastInsertRowid });
}

async function deleteTodos(ctx) {
  const b = await ctx.body();
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isInteger) : [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const sess = ctx.db.prepare(`SELECT tmux_name FROM sessions WHERE todo_id IN (${ph})`).all(...ids);
    for (const s of sess) killSession(s.tmux_name);   // exact name only, never broad pkill
    ctx.db.prepare(`DELETE FROM todos WHERE id IN (${ph})`).run(...ids);
  }
  ctx.json(200, { ok: true, deleted: ids.length });
}

function toggleTodo(ctx) {
  const id = Number(ctx.params.id);
  ctx.db.prepare('UPDATE todos SET done = 1 - done WHERE id = ?').run(id);
  const t = getTodo(ctx.db, id);
  ctx.json(200, { ok: true, done: t ? t.done : null });
}

async function saveTitle(ctx) {
  const b = await ctx.body();
  const title = (b.title || '').trim();
  if (!title) return ctx.json(400, { error: 'title required' });
  ctx.db.prepare('UPDATE todos SET title = ? WHERE id = ?').run(title, Number(ctx.params.id));
  ctx.json(200, { ok: true });
}

async function saveExplanation(ctx) {
  const b = await ctx.body();
  ctx.db.prepare('UPDATE todos SET explanation = ? WHERE id = ?').run(b.explanation || '', Number(ctx.params.id));
  ctx.json(200, { ok: true });
}

async function saveDue(ctx) {
  const b = await ctx.body();
  const due = b.due_date && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null;
  ctx.db.prepare('UPDATE todos SET due_date = ? WHERE id = ?').run(due, Number(ctx.params.id));
  ctx.json(200, { ok: true });
}

async function startTodoSession(ctx) {
  const todo = getTodo(ctx.db, Number(ctx.params.id));
  if (!todo) return ctx.json(404, { error: 'todo not found' });
  if (!tmuxAvailable()) return ctx.json(400, { error: 'tmux not installed on host' });

  const b = await ctx.body();
  const name = (b.name || '').trim() || `session-${Date.now()}`;
  const cwd = (b.cwd || '').trim() || ctx.runtime.target_dir;
  const model = b.model || 'sonnet';
  const effort = b.effort || 'high';
  const fullPrompt = [todo.explanation, b.prompt].filter((x) => x && x.trim()).join('\n\n');

  const { tmuxName, promise } = startSession({ name, cwd, model, effort, fullPrompt });
  const info = ctx.db.prepare(`
    INSERT INTO sessions (todo_id, name, cwd, model, effort, prompt, tmux_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'starting')`)
    .run(todo.id, name, cwd, model, effort, fullPrompt, tmuxName);
  const sessionId = info.lastInsertRowid;

  promise.then(({ url, status }) => {
    ctx.db.prepare('UPDATE sessions SET remote_url = ?, status = ? WHERE id = ?').run(url, status, sessionId);
  });

  ctx.json(200, { ok: true, id: sessionId, name, status: 'starting' });
}

export default {
  id: 'todos',
  order: 10,
  nav: { label: 'Todos', href: '/todos' },
  routes: [
    { method: 'GET', path: '/todos', handler: home },
    { method: 'GET', path: '/todos/:id', handler: detail },
    { method: 'POST', path: '/config', handler: updateConfig },
    { method: 'POST', path: '/todos', handler: addTodo },
    { method: 'POST', path: '/todos/delete', handler: deleteTodos },
    { method: 'POST', path: '/todos/:id/toggle', handler: toggleTodo },
    { method: 'POST', path: '/todos/:id/title', handler: saveTitle },
    { method: 'POST', path: '/todos/:id/explanation', handler: saveExplanation },
    { method: 'POST', path: '/todos/:id/due', handler: saveDue },
    { method: 'POST', path: '/todos/:id/sessions', handler: startTodoSession },
  ],
};
