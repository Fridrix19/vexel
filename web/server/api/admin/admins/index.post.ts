// новый админ: {login, name, role, password}; при первом входе попросим сменить пароль
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'admins')
  const b = await readBody(e)
  const login = String(b?.login ?? '').trim().toLowerCase(), name = String(b?.name ?? '').trim()
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) fail(422, 'bad_login', 'Логин: 3–40 символов, латиница, цифры, точка, дефис.')
  if (!name) fail(422, 'bad_name', 'Укажите имя.')
  const role = ['owner', 'senior', 'operator', 'kyc'].includes(b?.role) ? b.role : 'operator'
  const pw = String(b?.password ?? '')
  if (pw.length < 10) fail(422, 'weak_password', 'Временный пароль — от 10 символов.')
  const r = await one(`insert into admins (login, password_hash, name, role, must_change, created_by, role_set_at, role_set_by) values ($1, $2, $3, $4, true, $5, now(), $5) returning id, login, name, role`,
    [login, await hashPassword(pw), name.slice(0, 80), role, a.id]).catch((err: any) => { if (err?.code === '23505') fail(409, 'login_taken', 'Такой логин уже есть.'); throw err })
  await audit(e, a, 'admin.create', r.id, { login, role })
  return { admin: r }
})
