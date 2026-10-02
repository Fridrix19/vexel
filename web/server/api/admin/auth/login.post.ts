// вход в админку; 5 неверных попыток с одного IP за 15 минут — пауза
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const login = String(b?.login ?? '').trim().toLowerCase()
  const password = String(b?.password ?? '')
  const ip = clientIp(e)
  const recent = await one<{ n: number }>(`select count(*)::int n from audit_log where action = 'admin.login_failed' and ip = $1 and created_at > now() - interval '15 minutes'`, [ip])
  if ((recent?.n ?? 0) >= 5) fail(429, 'locked', 'Слишком много попыток. Подождите 15 минут.')
  const a = await one(`select id, password_hash, active from admins where login = $1`, [login])
  const ok = a ? await verifyPassword(password, a.password_hash) : (await verifyPassword(password, await dummyHash()), false)
  if (!a || !ok || !a.active) {
    await q(`insert into audit_log (action, target, ip) values ('admin.login_failed', $1, $2)`, [login.slice(0, 60), ip])
    fail(401, 'bad_credentials', 'Неверный логин или пароль.')
  }
  await startAdminSession(e, a.id)
  await q(`insert into audit_log (admin_id, action, ip) values ($1, 'admin.login', $2)`, [a.id, ip])
  return { admin: await one(`select id, login, name, role, must_change from admins where id = $1`, [a.id]) }
})
