// Login feature: password form + cookie issue. Public routes (no auth gate).
import { checkPassword, authCookieHeader } from '../core/auth.js';
import { layout, esc } from '../core/layout.js';

function loginPage(error) {
  return layout({
    title: 'Login — Project Dashboard',
    bare: true,
    body: `
    <section class="card login">
      <h1>Project Dashboard</h1>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <form method="POST" action="/login">
        <input type="password" name="password" placeholder="Password" autofocus required>
        <button type="submit">Sign in</button>
      </form>
    </section>`,
  });
}

export default {
  id: 'login',
  order: 0,
  routes: [
    { method: 'GET', path: '/login', public: true, handler: (ctx) => ctx.send(200, loginPage()) },
    {
      method: 'POST', path: '/login', public: true,
      handler: async (ctx) => {
        const b = await ctx.body();
        if (checkPassword(b.password)) {
          return ctx.redirect('/', { 'Set-Cookie': authCookieHeader() });
        }
        ctx.send(401, loginPage('Wrong password.'));
      },
    },
  ],
};
