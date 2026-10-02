// завершить сессию: id или "others" — все, кроме текущей
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const id = getRouterParam(e, 'id')
  if (id === 'others') await q(`delete from sessions where user_id = $1 and id <> $2`, [u.id, u.session_id])
  else {
    if (id === u.session_id) fail(422, 'current_session', 'Текущую сессию завершает «Выйти».')
    await q(`delete from sessions where user_id = $1 and id::text = $2`, [u.id, id])
  }
  return { ok: true }
})
