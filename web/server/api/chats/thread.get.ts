// сообщения ветки: ?order=VX-… или без order — общий чат. after — id последнего полученного (для опроса)
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const qy = getQuery(e)
  const orderId = qy.order ? String(qy.order) : null
  if (orderId && !(await one(`select 1 from orders where id = $1 and user_id = $2`, [orderId, u.id]))) fail(404, 'not_found', 'Заказ не найден.')
  const t = await one(`select t.*, o.product_name from chat_threads t left join orders o on o.id = t.order_id where t.user_id = $1 and ${orderId ? 't.order_id = $2' : 't.order_id is null'}`, orderId ? [u.id, orderId] : [u.id])
  if (!t) return { thread: null, messages: [] }
  const after = Math.max(0, Number(qy.after) || 0)
  const msgs = await q(MSG_SQL, [t.id, after])
  if (t.unread_user) await q(`update chat_threads set unread_user = 0 where id = $1`, [t.id])
  return { thread: { id: t.id, order_id: t.order_id, status: t.status, title: threadTitle(t) }, messages: msgs.map(m => msgView(m, '/api/chats/file')) }
})
