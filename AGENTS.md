# AGENTS.md — Project Dashboard

Entry point for AI agents. Read this first; follow links for depth (progressive
disclosure — don't load everything at once).

## What this is
A self-hostable, lightweight, Notion-like **project status dashboard**. Clone it
beside a "target-project", run `./setup.sh`, get a LAN web app to track todos and
launch **Claude Code remote-control sessions** scoped to each todo.

- **project-dashboard** = this repo. **target-project** = the project being managed (`ctx.runtime.target_dir`).

## The one thing to know: features are pluggable
A page is **one file** in `src/features/`. The registry auto-discovers it — there
is no central route list. To add a page:

```bash
npm run new:page <name> "Label"   # scaffold
# edit src/features/<name>.js
npm run check                     # syntax + tests (your feedback loop)
```

→ **Full recipe + the `ctx` API + a worked PDF-viewer example: [docs/adding-a-feature.md](docs/adding-a-feature.md).**

## Structure
```
src/
  core/        generic plumbing — rarely edit
    registry.js  auto-discovers src/features/*.js
    router.js    :param path matching
    context.js   the ctx object handed to handlers (feature API)
    layout.js    shared HTML chrome + esc()
    http.js      send/json/redirect/parseBody/serveStatic
    auth.js      single-password signed-cookie gate
  features/    one file per page (todos.js is the reference example)
  config.js    loads config.json
  db.js        sqlite schema + connection
  sessions.js  spawn `claude --remote-control` via tmux; scrape remote URL
scripts/       new-page.mjs (scaffolder), check.mjs (feedback loop)
test/          node:test smoke tests (zero deps)
docs/          deeper guides
public/        app.js, app.css
```

## Data model
- `config(id=1, project_name, show_completed, theme)`
- `todos(id, title, done, explanation, due_date, position, created_at)`
- `sessions(id, todo_id, name, remote_url, cwd, model, effort, prompt, tmux_name, status, created_at)`

## Boundaries
**Always:** new pages in `src/features/`; escape output with `esc()`; parameterized SQL;
add a test + run `npm run check` before claiming done; kill processes by exact id.
**Ask first:** new runtime dependency (project is near-zero-dep); auth/schema/session-spawn changes; build step or frontend framework.
**Never:** broad `pkill`; commit `config.json`/`data/`/secrets; unescaped user/db HTML.

## Claude session spawning (the fragile part)
- `cd <cwd> && claude --remote-control '<name>' '<explanation+prompt>' --model <m> --effort <e> 2>&1 | tee <log>`, run in detached `tmux`.
- Remote link has **no machine-readable output** — scraped from stdout via `REMOTE_URL_RE` in `sessions.js` (`https://claude.ai/code?environment=env_<id>`). Update that regex if Claude changes the format.
- No `--cwd` flag (we `cd`). Models: `opus|sonnet|haiku|fable`. Effort: `low|medium|high|xhigh|max`.
- Requires `tmux` + a logged-in `claude` CLI. Set `PD_DISABLE_SPAWN=1` to stub spawning (tests use this).

## Conventions
- Mutations are JSON `POST` endpoints; client (`public/app.js`) does fetch-then-reload (server DOM = source of truth).
- Keep dependencies minimal; prefer Node built-ins. No build step.
- Test isolation via env: `PD_DB_PATH`, `PD_CONFIG_PATH`, `PD_DISABLE_SPAWN`.
- Update `STATUSLOG.md` as you work (local, gitignored).
