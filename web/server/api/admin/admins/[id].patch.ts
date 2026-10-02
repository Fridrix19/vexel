// роль, активность, сброс пароля; последнего активного владельца отключить нельзя
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'admins')
  const b = await readBody(e)
  const t = await one(`select * from admins where id::text = $1`, [getRouterParam(e, 'id')])
  if (!t) fail(404, 'not_found', 'Админ не найден.')
  const role = b?.role && ['owner', 'senior', 'operator', 'kyc'].includes(b.role) ? b.role : t.role
  const active = b?.active === undefined ? t.active : b.active === true
  if (t.role === 'owner' && (role !== 'owner' || !active)) {
    const owners = (await one(`select count(*)::int n from admins where role = 'owner' and active and id <> $1`, [t.id])).n
    if (!owners) fail(409, 'last_owner', 'Нельзя убрать последнего владельца.')
  }
  let hash = t.password_hash, mustChange = t.must_change
  if (b?.password) { if (String(b.password).length < 10) fail(422, 'weak_password', 'Временный пароль — от 10 символов.'); hash = await hashPassword(String(b.password)); mustChange = true }
  await q(`update admins set role = $2, active = $3, password_hash = $4, must_change = $5,
            role_set_at = case when role <> $2 then now() else role_set_at end, role_set_by = case when role <> $2 then $6 else role_set_by end where id = $1`,
    [t.id, role, active, hash, mustChange, a.id])
  if (!active || b?.password) await q(`delete from admin_sessions where admin_id = $1`, [t.id])
  await audit(e, a, 'admin.update', t.id, { login: t.login, role_before: t.role, role, active, password_reset: !!b?.password })
  return { ok: true }
})
