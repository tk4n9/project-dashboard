# Project Dashboard

A lightweight, self-hostable, Notion-like **project status dashboard**. Clone it
beside a project you want to manage, run one script, and get a LAN web app to
track todos and launch [Claude Code](https://claude.com/claude-code)
remote-control sessions scoped to each todo.

- **project-dashboard** — this repo.
- **target-project** — the project you're managing (usually a sibling directory).

## Features

- Todo list: add, complete (with strikethrough), delete, optional due dates.
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

## Install with Claude Code (one prompt)

From your **target-project root**, start [Claude Code](https://claude.com/claude-code)
and paste this prompt. It clones the dashboard beside your project and starts it:

```text
Set up the "project-dashboard" tool to manage THIS project.

1. Treat the current directory as the target-project. Record its absolute path.
2. Clone the dashboard as a SIBLING directory (next to this project, NOT inside it):
   git clone https://github.com/tk4n9/project-dashboard.git ../project-dashboard
   If ../project-dashboard already exists, run `git pull` in it instead of cloning.
3. Ask me for a dashboard password, and optionally a port (default 8080) and host
   (127.0.0.1 = local only, 0.0.0.0 = LAN). Use sensible defaults if I don't care.
4. From the cloned directory, run the setup script pointed at this project:
   cd ../project-dashboard && ./setup.sh --target-dir "<absolute path of the target-project>" --password "<password>" [--port N] [--host ADDR]
5. The script installs deps, initializes the DB, and starts the server.
   Report the local and LAN URLs it prints.

Host requirements: Node.js >= 18, tmux, and a logged-in `claude` CLI
(tmux + claude are only needed to launch Claude sessions from the dashboard).
```

## Quick start (manual)

```bash
git clone https://github.com/tk4n9/project-dashboard.git
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
