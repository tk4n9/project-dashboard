// Runtime config loaded from config.json (created by setup.sh). Gitignored.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
// PD_CONFIG_PATH lets tests/CI supply an isolated config file.
const CONFIG_PATH = process.env.PD_CONFIG_PATH || join(ROOT, 'config.json');

const defaults = {
  target_dir: ROOT,   // working dir for spawned Claude sessions
  host: '0.0.0.0',
  port: 8080,
  password: '',       // empty = auth disabled (warn)
  secret: 'dev-insecure-secret-change-me',
  base_path: '',      // e.g. '/projectdashboard' when served under a subpath
};

let fileConfig = {};
if (existsSync(CONFIG_PATH)) {
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to parse config.json:', e.message);
  }
}

export const config = { ...defaults, ...fileConfig };

// Normalize base_path to '' or '/prefix' (leading slash, no trailing slash).
let bp = String(config.base_path || '').trim();
if (bp && !bp.startsWith('/')) bp = `/${bp}`;
config.base_path = bp.replace(/\/+$/, '');

export { ROOT };
