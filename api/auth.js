import { dbRequest } from '../lib/supabase.js';
import {
  createSession, derivePassword, verifyPassword, sessionCookie, hash,
  parseCookies, COOKIE_NAME, clearSessionCookie, getAdmin
} from '../lib/auth.js';
import { json, readJson, allowMethods, safeError, getClientIp } from '../lib/http.js';

async function login(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const body = await readJson(req);
  const loginName = String(body.login || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9._-]{3,50}$/.test(loginName) || password.length < 10) {
    return json(res, 400, { error: 'Podaj login i hasło.' });
  }

  const ipHash = hash(getClientIp(req));
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const failures = await dbRequest('auth_login_attempts', {
    query: { select: 'id', email: `eq.${loginName}`, ip_hash: `eq.${ipHash}`, succeeded: 'eq.false', created_at: `gt.${since}` }
  });
  if ((failures || []).length >= 5) return json(res, 429, { error: 'Zbyt wiele prób. Spróbuj ponownie za 15 minut.' });

  const users = await dbRequest('admin_users', {
    query: { select: 'id,login,email,password_hash,display_name,active', login: `eq.${loginName}`, limit: 1 }
  });
  let user = users?.[0];
  const bootstrapLogin = String(process.env.ADMIN_LOGIN || '').trim().toLowerCase();
  const bootstrapPassword = String(process.env.ADMIN_PASSWORD || '');
  const bootstrapMatches = loginName === bootstrapLogin
    && bootstrapPassword.length >= 14
    && hash(password) === hash(bootstrapPassword);

  if (!user && bootstrapMatches) {
    const existingAdmins = await dbRequest('admin_users', { query: { select: 'id', limit: 1 } });
    if (!existingAdmins?.length) {
      const created = await dbRequest('admin_users', {
        method: 'POST',
        body: {
          login: loginName,
          email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null,
          password_hash: derivePassword(password),
          display_name: String(process.env.ADMIN_DISPLAY_NAME || 'Administrator').trim(),
          active: true
        }
      });
      user = created?.[0];
    }
  }
  const valid = user?.active && verifyPassword(password, user.password_hash);
  await dbRequest('auth_login_attempts', {
    method: 'POST', body: { email: loginName, ip_hash: ipHash, succeeded: Boolean(valid) }, prefer: 'return=minimal'
  });
  if (!valid) return json(res, 401, { error: 'Nieprawidłowy login lub hasło.' });

  const session = await createSession(req, user.id);
  await dbRequest('admin_users', {
    method: 'PATCH', query: { id: `eq.${user.id}` },
    body: { last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }, prefer: 'return=minimal'
  });
  res.setHeader('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds));
  return json(res, 200, { user: { id: user.id, login: user.login, displayName: user.display_name } });
}

async function logout(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) {
    await dbRequest('admin_sessions', {
      method: 'PATCH', query: { token_hash: `eq.${hash(token)}`, revoked_at: 'is.null' },
      body: { revoked_at: new Date().toISOString() }, prefer: 'return=minimal'
    });
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  return json(res, 200, { ok: true });
}

async function session(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const admin = await getAdmin(req);
  if (!admin) return json(res, 401, { authenticated: false });
  return json(res, 200, {
    authenticated: true,
    user: { id: admin.id, login: admin.login, displayName: admin.display_name }
  });
}

export default async function handler(req, res) {
  try {
    const action = String(req.query?.action || '');
    if (action === 'login') return await login(req, res);
    if (action === 'logout') return await logout(req, res);
    if (action === 'session') return await session(req, res);
    return json(res, 404, { error: 'Nie znaleziono endpointu uwierzytelniania.' });
  } catch (error) {
    if (String(req.query?.action || '') === 'logout') res.setHeader('Set-Cookie', clearSessionCookie());
    return safeError(res, error);
  }
}
