// Dashboard feature: the project overview / landing page at '/'.
// Read-only summary widgets that link into the Todos list and detail pages.
// See .omc/specs/deep-interview-dashboard-tab.md for the spec.
import { esc } from '../core/layout.js';

const DUE_SOON_DAYS = 3;
const RECENT_TODOS = 3;
const RECENT_SESSIONS = 3;
const FEED_LIMIT = 5;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysStr(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// ---------- Widgets ----------
function completionWidget(db) {
  const total = db.prepare('SELECT COUNT(*) c FROM todos').get().c;
  const done = db.prepare('SELECT COUNT(*) c FROM todos WHERE done = 1').get().c;
  const open = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `
    <section class="card widget">
      <h2>Progress</h2>
      <div class="stat-row">
        <span class="stat"><strong>${total}</strong> total</span>
        <span class="stat"><strong>${open}</strong> open</span>
        <span class="stat"><strong>${done}</strong> done</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" title="${pct}% complete">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <p class="muted">${pct}% complete</p>
    </section>`;
}

function dueSoonWidget(db) {
  const rows = db.prepare(
    'SELECT * FROM todos WHERE done = 0 AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date ASC',
  ).all(plusDaysStr(DUE_SOON_DAYS));
  const today = todayStr();
  const items = rows.length
    ? rows.map((t) => `<li><a href="/todos/${t.id}">${esc(t.title)}</a>
        <span class="due ${t.due_date < today ? 'overdue' : ''}">${esc(t.due_date)}</span></li>`).join('')
    : '<li class="muted">Nothing due in the next ' + DUE_SOON_DAYS + ' days.</li>';
  return `
    <section class="card widget">
      <h2>Due soon</h2>
      <ul class="widget-list">${items}</ul>
    </section>`;
}

function recentTodosWidget(db) {
  const rows = db.prepare('SELECT * FROM todos ORDER BY id DESC LIMIT ?').all(RECENT_TODOS);
  const items = rows.length
    ? rows.map((t) => `<li><a href="/todos/${t.id}" class="${t.done ? 'done-link' : ''}">${esc(t.title)}</a></li>`).join('')
    : '<li class="muted">No todos yet.</li>';
  return `
    <section class="card widget">
      <h2>Recently added</h2>
      <ul class="widget-list">${items}</ul>
    </section>`;
}

function recentSessionsWidget(db) {
  const rows = db.prepare(`
    SELECT s.*, t.title AS todo_title FROM sessions s
    JOIN todos t ON t.id = s.todo_id
    ORDER BY s.id DESC LIMIT ?`).all(RECENT_SESSIONS);
  const items = rows.length
    ? rows.map((s) => {
      const name = s.remote_url
        ? `<a href="${esc(s.remote_url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`
        : `<span class="muted">${esc(s.name)}</span>`;
      return `<li>${name} <span class="status ${s.remote_url ? 'ok' : ''}">${esc(s.status)}</span>
        <a class="muted small" href="/todos/${s.todo_id}">${esc(s.todo_title)}</a></li>`;
    }).join('')
    : '<li class="muted">No sessions yet.</li>';
  return `
    <section class="card widget">
      <h2>Recent sessions</h2>
      <ul class="widget-list">${items}</ul>
    </section>`;
}

function activityWidget(db) {
  // Approximated from created_at only (no event log; completions are not timestamped).
  const rows = db.prepare(`
    SELECT 'todo' AS kind, id AS ref, title AS label, created_at FROM todos
    UNION ALL
    SELECT 'session' AS kind, todo_id AS ref, name AS label, created_at FROM sessions
    ORDER BY created_at DESC LIMIT ?`).all(FEED_LIMIT);
  const items = rows.length
    ? rows.map((r) => {
      const verb = r.kind === 'todo' ? 'Todo added' : 'Session started';
      return `<li><span class="muted small">${esc(r.created_at)}</span>
        ${verb}: <a href="/todos/${r.ref}">${esc(r.label)}</a></li>`;
    }).join('')
    : '<li class="muted">No activity yet.</li>';
  return `
    <section class="card widget">
      <h2>Recent activity</h2>
      <ul class="widget-list">${items}</ul>
      <p class="muted small">Approximated from creation times.</p>
    </section>`;
}

function sessionStatsWidget(db) {
  const total = db.prepare('SELECT COUNT(*) c FROM sessions').get().c;
  const byModel = db.prepare('SELECT model, COUNT(*) c FROM sessions GROUP BY model ORDER BY c DESC').all();
  const byEffort = db.prepare('SELECT effort, COUNT(*) c FROM sessions GROUP BY effort ORDER BY c DESC').all();
  const fmt = (rows) => (rows.length
    ? rows.map((r) => `<li>${esc(r.model ?? r.effort ?? '—')} <strong>${r.c}</strong></li>`).join('')
    : '<li class="muted">none</li>');
  return `
    <section class="card widget">
      <h2>Sessions</h2>
      <p><strong>${total}</strong> total</p>
      <div class="stat-cols">
        <div><h3>By model</h3><ul class="widget-list">${fmt(byModel)}</ul></div>
        <div><h3>By effort</h3><ul class="widget-list">${fmt(byEffort)}</ul></div>
      </div>
    </section>`;
}

function projectInfoWidget(settings, runtime) {
  return `
    <section class="card widget">
      <h2>Project</h2>
      <ul class="widget-list">
        <li>Name: <strong>${esc(settings.project_name)}</strong></li>
        <li>Target: <code>${esc(runtime.target_dir)}</code></li>
        <li>Theme: ${esc(settings.theme)}</li>
      </ul>
    </section>`;
}

function dashboardView(ctx) {
  const { db } = ctx;
  const settings = ctx.settings();
  return `
    <h1 class="dash-title">${esc(settings.project_name)}</h1>
    <div class="dash-grid">
      ${completionWidget(db)}
      ${dueSoonWidget(db)}
      ${recentTodosWidget(db)}
      ${recentSessionsWidget(db)}
      ${sessionStatsWidget(db)}
      ${activityWidget(db)}
      ${projectInfoWidget(settings, ctx.runtime)}
    </div>`;
}

export default {
  id: 'dashboard',
  order: 5,
  nav: { label: 'Dashboard', href: '/' },
  routes: [
    { method: 'GET', path: '/', handler: (ctx) => ctx.page({ title: 'Dashboard', body: dashboardView(ctx) }) },
  ],
};
