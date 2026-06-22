// Thin HTTP server. Loads features from the registry and dispatches requests.
// App logic lives in src/features/*; generic plumbing lives in src/core/*.
import http from 'node:http';
import { join } from 'node:path';
import { config, ROOT } from './config.js';
import { db, initSchema } from './db.js';
import { isAuthed, authEnabled } from './core/auth.js';
import { serveStatic, send, json } from './core/http.js';
import { loadFeatures, collectRoutes, navItems } from './core/registry.js';
import { matchRoute } from './core/router.js';
import { makeContext } from './core/context.js';

const PUBLIC = join(ROOT, 'public');
const BASE = config.base_path;          // '' or '/prefix'

export async function createServer() {
  initSchema();
  const features = await loadFeatures(db);
  const routes = collectRoutes(features);
  const nav = navItems(features);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let path = url.pathname;
      if (BASE) {
        if (path === BASE || path === `${BASE}/`) path = '/';
        else if (path.startsWith(`${BASE}/`)) path = path.slice(BASE.length);
        else return send(res, 404, 'Not found');
      }

      if (path.startsWith('/static/')) {
        return serveStatic(res, PUBLIC, path.replace(/^\/static\//, ''));
      }

      const match = matchRoute(routes, req.method, path);
      if (!match) return send(res, 404, 'Not found');

      if (!match.route.public && !isAuthed(req)) {
        if (req.method === 'GET') {
          res.writeHead(302, { Location: `${BASE}/login` });
          return res.end();
        }
        return json(res, 401, { error: 'unauthorized' });
      }

      const ctx = makeContext({ req, res, url, params: match.params, db, runtime: config, navItems: nav });
      await match.route.handler(ctx);
    } catch (err) {
      console.error('Request error:', err);
      if (!res.headersSent) json(res, 500, { error: 'internal error' });
    }
  });
}

// Start when run directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const server = await createServer();
  server.listen(config.port, config.host, () => {
    if (!authEnabled()) {
      console.warn('⚠  No password set — auth is DISABLED. Set "password" in config.json.');
    }
    console.log(`Project Dashboard listening on http://${config.host}:${config.port}`);
  });
}
