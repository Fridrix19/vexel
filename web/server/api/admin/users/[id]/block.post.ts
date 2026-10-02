// блокировка / разблокировка: {blocked, reason}; блокировка завершает все сессии
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'users.write')
  const b = await readBody(e)
  const blocked = b?.blocked === true
  const reason = String(b?.reason ?? '').trim().slice(0, 300)
  if (blocked && !reason) fail(422, 'reason_required', 'Укажите причину блокировки.')
  const u = await one(`update users set status = $2 where id::text = $1 returning id, email, status`, [getRouterParam(e, 'id'), blocked ? 'blocked' : 'active'])
  if (!u) fail(404, 'not_found', 'Пользователь не найден.')
  if (blocked) await q(`delete from sessions where user_id = $1`, [u.id])
  await audit(e, a, blocked ? 'user.block' : 'user.unblock', u.id, { email: u.email, reason })
  return { user: u }
})
