// Spawn a Claude Code remote-control session inside a detached tmux session,
// then poll its log file to scrape the remote-control URL.
//
// NOTE (fragile point): Claude Code has no machine-readable output for the
// remote-control link, so we scrape stdout. The pattern below matches the
// observed format `https://claude.ai/code?environment=env_<id>`. If a future
// Claude version changes this, update REMOTE_URL_RE.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './config.js';

const LOG_DIR = join(ROOT, 'data', 'logs');
mkdirSync(LOG_DIR, { recursive: true });

const REMOTE_URL_RE = /https:\/\/claude\.ai\/code\?environment=env_[A-Za-z0-9]+/;
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 45_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function tmuxAvailable() {
  if (process.env.PD_DISABLE_SPAWN === '1') return true;  // test mode
  try {
    execFileSync('tmux', ['-V'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Sanitize a user-supplied session name into a safe tmux session id.
function safeTmuxName(name) {
  const base = (name || 'session').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  return `pd-${base}-${Date.now()}`;
}

/**
 * Launch a remote-control session.
 * @returns {{tmuxName:string, logPath:string, promise:Promise<{url:string|null,status:string}>}}
 */
export function startSession({ name, cwd, model, effort, fullPrompt }) {
  if (process.env.PD_DISABLE_SPAWN === '1') {
    // Test mode: don't spawn a real process.
    return { tmuxName: `test-${name}`, logPath: null, promise: Promise.resolve({ url: null, status: 'disabled' }) };
  }
  if (!tmuxAvailable()) {
    return {
      tmuxName: null,
      logPath: null,
      promise: Promise.resolve({ url: null, status: 'error: tmux not installed' }),
    };
  }

  const tmuxName = safeTmuxName(name);
  const logPath = join(LOG_DIR, `${tmuxName}.log`);

  // Build the claude command. Args are passed as a single shell string to tmux;
  // values are validated/escaped to avoid injection.
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const parts = ['claude', '--remote-control', q(name)];
  if (fullPrompt && fullPrompt.trim()) parts.push(q(fullPrompt));
  if (model) parts.push('--model', q(model));
  if (effort) parts.push('--effort', q(effort));
  const claudeCmd = parts.join(' ');

  // cd into target dir (no --cwd flag exists), tee output so we can scrape it.
  const inner = `cd ${q(cwd)} && ${claudeCmd} 2>&1 | tee ${q(logPath)}`;

  spawn('tmux', ['new-session', '-d', '-s', tmuxName, inner], {
    stdio: 'ignore',
    detached: true,
  }).unref();

  const promise = pollForUrl(logPath);
  return { tmuxName, logPath, promise };
}

async function pollForUrl(logPath) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    if (!existsSync(logPath)) continue;
    let text = '';
    try {
      text = readFileSync(logPath, 'utf8');
    } catch {
      continue;
    }
    const m = text.match(REMOTE_URL_RE);
    if (m) return { url: m[0], status: 'running' };
  }
  return { url: null, status: 'error: timed out waiting for remote URL' };
}

// Best-effort kill of a session's tmux process (by exact name — never broad pkill).
export function killSession(tmuxName) {
  if (!tmuxName) return false;
  try {
    execFileSync('tmux', ['kill-session', '-t', tmuxName], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
