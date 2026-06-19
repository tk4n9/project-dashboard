# Project Dashboard

A lightweight, self-hostable, Notion-like **project status dashboard**. Clone it
beside a project you want to manage, run one script, and get a LAN web app to
track todos and launch [Claude Code](https://claude.com/claude-code)
remote-control sessions scoped to each todo.

- **project-dashboard** — this repo.
- **target-project** — the project you're managing (usually a sibling directory).

## Features

- Todo list: add, complete (with strikethrough), bulk-delete, optional due dates.
- Per-todo detail page with a markdown explanation (Write/Preview) that doubles
  as the boilerplate prompt for Claude sessions.
- Start Claude Code remote-control sessions per todo (name, working directory,
  prompt, model, effort) and collect their browser/mobile control links.
- Light/dark mode, editable project name, show/hide completed todos.
- LAN access with simple password auth.

## Requirements

- Node.js ≥ 18
- [`tmux`](https://github.com/tmux/tmux) — for launching Claude sessions
- A logged-in [`claude`](https://claude.com/claude-code) CLI — for session spawning
- The web UI works without tmux/claude; only session-spawning needs them.

## Quick start

```bash
git clone <this-repo> project-dashboard
cd project-dashboard
./setup.sh --target-dir ../your-project --password yourpassword
```

`setup.sh` writes `config.json`, installs dependencies, initializes the database,
prints the local + LAN URLs, and starts the server.

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--target-dir PATH` | parent directory | Default working dir for spawned sessions |
| `--port N` | `8080` | Listen port |
| `--host ADDR` | `0.0.0.0` | Bind address (`127.0.0.1` for localhost-only) |
| `--password PW` | _(none)_ | Login password. **No password = auth disabled.** |

## How Claude sessions work

The server launches `claude --remote-control` inside a detached `tmux` session in
the chosen working directory, then scrapes the remote-control link
(`https://claude.ai/code?environment=...`) from its output and shows it in the UI.

> Note: Claude Code exposes no machine-readable output for this link, so it is
> scraped from stdout. If a future Claude version changes the format, update
> `REMOTE_URL_RE` in `src/sessions.js`.

## Security

- Designed for trusted LAN / localhost use. It spawns processes and runs Claude on
  the host. Don't expose it to untrusted networks.
- Always set `--password` when binding to `0.0.0.0`.

## Extending it

Adding a page is one file in `src/features/` (the registry auto-discovers it):

```bash
npm run new:page <name> "Label"
npm run check        # syntax + tests
```

See [`docs/adding-a-feature.md`](docs/adding-a-feature.md) for the full recipe and
[`AGENTS.md`](AGENTS.md) for architecture and conventions.

## Development

```bash
npm install
npm run check        # syntax check + tests
npm test             # tests only
npm start            # run (needs config.json; see setup.sh)
```

## License

Not yet chosen — see `LICENSE` (TODO).
