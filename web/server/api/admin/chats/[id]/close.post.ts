// закрыть / открыть ветку {closed: true|false}
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'chats')
  const closed = (await readBody(e))?.closed !== false
  const t = await one(`update chat_threads set status = $2 where id::text = $1 returning id`, [getRouterParam(e, 'id'), closed ? 'closed' : 'open'])
  if (!t) fail(404, 'not_found', 'Чат не найден.')
  await audit(e, a, closed ? 'chat.close' : 'chat.open', t.id, {})
  return { ok: true }
})
