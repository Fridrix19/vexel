// смена своего пароля (обязательна после входа admin/admin)
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e)
  const b = await readBody(e)
  const row = await one(`select password_hash from admins where id = $1`, [a.id])
  if (!(await verifyPassword(String(b?.old ?? ''), row.password_hash))) fail(400, 'bad_password', 'Текущий пароль указан неверно.')
  const next = String(b?.new ?? '')
  if (next.length < 10 || !/\d/.test(next) || !/[^\d\s]/.test(next)) fail(422, 'weak_password', 'Пароль админа — от 10 символов, буквы и цифры.')
  await q(`update admins set password_hash = $2, must_change = false where id = $1`, [a.id, await hashPassword(next)])
  await q(`delete from admin_sessions where admin_id = $1 and id <> $2`, [a.id, a.session_id])
  await audit(e, a, 'admin.password', a.id)
  return { ok: true }
})
