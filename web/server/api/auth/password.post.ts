// смена пароля в кабинете: нужен текущий; остальные сессии завершаются
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const row = await one<{ password_hash: string }>(`select password_hash from users where id = $1`, [u.id])
  if (!row || !(await verifyPassword(String(b?.old ?? ''), row.password_hash))) fail(400, 'bad_password', 'Текущий пароль указан неверно.')
  const next = checkPassword(b?.new)
  await q(`update users set password_hash = $2 where id = $1`, [u.id, await hashPassword(next)])
  await q(`delete from sessions where user_id = $1 and id <> $2`, [u.id, u.session_id])
  return { ok: true }
})
