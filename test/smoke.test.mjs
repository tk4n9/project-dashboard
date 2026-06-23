// Smoke tests: boot the real server against an isolated temp DB/config and
// exercise the HTTP surface. Zero dependencies (node:test + global fetch).
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolate state BEFORE importing the app (config.js/db.js read these at import).
const dir = mkdtempSync(join(tmpdir(), 'pd-test-'));
process.env.PD_DB_PATH = join(dir, 'test.db');
process.env.PD_CONFIG_PATH = join(dir, 'config.json');
process.env.PD_DISABLE_SPAWN = '1'; // never launch a real `claude`
writeFileSync(process.env.PD_CONFIG_PATH, JSON.stringify({
  target_dir: dir, host: '127.0.0.1', port: 0, password: '', secret: 'test-secret',
}));

const { createServer } = await import('../src/server.js');

let server;
let base;
const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

before(async () => {
  server = await createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('dashboard is the home page', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /dash-grid/);
  assert.match(html, /class="appnav"/);
  assert.match(html, />Dashboard</);
  assert.match(html, />Progress</);
});

test('todos list lives at /todos', async () => {
  const res = await fetch(base + '/todos');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /todo-list/);
  assert.match(html, />Todos</);
});

test('unknown route is 404', async () => {
  const res = await fetch(base + '/does-not-exist');
  assert.equal(res.status, 404);
});

test('add, toggle, and read back a todo', async () => {
  const add = await (await post('/todos', { title: 'Write tests' })).json();
  assert.equal(add.ok, true);
  const id = add.id;

  const detail = await fetch(`${base}/todos/${id}`);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /Write tests/);

  const toggled = await (await post(`/todos/${id}/toggle`, {})).json();
  assert.equal(toggled.done, 1);
});

test('todo title is editable', async () => {
  const { id } = await (await post('/todos', { title: 'Old title' })).json();
  const res = await post(`/todos/${id}/title`, { title: 'New title' });
  assert.equal(res.status, 200);
  assert.match(await (await fetch(`${base}/todos/${id}`)).text(), /New title/);
  // empty title rejected
  assert.equal((await post(`/todos/${id}/title`, { title: '  ' })).status, 400);
});

test('add, render, and delete a comment', async () => {
  const { id } = await (await post('/todos', { title: 'Has comments' })).json();
  const add = await (await post(`/todos/${id}/comments`, { body: 'first log entry' })).json();
  assert.equal(add.ok, true);
  assert.match(await (await fetch(`${base}/todos/${id}`)).text(), /first log entry/);
  assert.equal((await post(`/todos/${id}/comments`, { body: '  ' })).status, 400); // empty rejected
  // edit
  assert.equal((await post(`/comments/${add.id}`, { body: 'edited entry' })).status, 200);
  assert.match(await (await fetch(`${base}/todos/${id}`)).text(), /edited entry/);
  assert.equal((await post(`/comments/${add.id}`, { body: '  ' })).status, 400); // empty edit rejected
  assert.equal((await post(`/comments/${add.id}/delete`, {})).status, 200);
  assert.doesNotMatch(await (await fetch(`${base}/todos/${id}`)).text(), /first log entry/);
});

test('add requires a title', async () => {
  const res = await post('/todos', { title: '   ' });
  assert.equal(res.status, 400);
});

test('due date is validated', async () => {
  const { id } = await (await post('/todos', { title: 'Due item' })).json();
  assert.equal((await post(`/todos/${id}/due`, { due_date: 'nonsense' })).status, 200);
  const html = await (await fetch(`${base}/todos/${id}`)).text();
  assert.doesNotMatch(html, /nonsense/); // invalid date rejected → stored as null
});

test('config update is reflected on the page', async () => {
  await post('/config', { project_name: 'Renamed Project', theme: 'dark' });
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /Renamed Project/);
  assert.match(html, /data-theme="dark"/);
});

test('container alignment is configurable', async () => {
  await post('/config', { container_align: 'right' });
  assert.match(await (await fetch(base + '/')).text(), /class="container align-right"/);
  // invalid value ignored, falls back to a valid class
  await post('/config', { container_align: 'bogus' });
  assert.match(await (await fetch(base + '/')).text(), /class="container align-(left|center|right|fit)"/);
});

test('delete removes todos', async () => {
  const { id } = await (await post('/todos', { title: 'Delete me' })).json();
  const del = await (await post('/todos/delete', { ids: [id] })).json();
  assert.equal(del.deleted, 1);
  assert.equal((await fetch(`${base}/todos/${id}`)).status, 404);
});

test('session endpoint records a session (spawn disabled)', async () => {
  const { id } = await (await post('/todos', { title: 'Session host' })).json();
  const res = await post(`/todos/${id}/sessions`, { name: 's1', model: 'sonnet', effort: 'high', prompt: 'hi' });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.ok, true);
  assert.equal(out.status, 'starting');
  // delete/close the session entry
  assert.equal((await post(`/sessions/${out.id}/delete`, {})).status, 200);
});

test('add an existing session by remote URL', async () => {
  const { id } = await (await post('/todos', { title: 'Existing session host' })).json();
  const res = await post(`/todos/${id}/sessions/existing`, { name: 'pasted', remote_url: 'https://claude.ai/code?environment=env_abc123' });
  assert.equal(res.status, 200);
  const html = await (await fetch(`${base}/todos/${id}`)).text();
  assert.match(html, /env_abc123/);
  assert.equal((await post(`/todos/${id}/sessions/existing`, { name: 'x' })).status, 400); // url required
});
