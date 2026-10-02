// ветка: пользователь, заказ, сообщения; after — для опроса новых
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'chats')
  const t = await one(`select t.*, o.product_name, o.plan_label, o.status order_status, o.amount_kop, o.created_at order_created_at,
      u.email, u.username, u.name, u.kyc_status, u.telegram, u.phone
    from chat_threads t join users u on u.id = t.user_id left join orders o on o.id = t.order_id where t.id::text = $1`, [getRouterParam(e, 'id')])
  if (!t) fail(404, 'not_found', 'Чат не найден.')
  const after = Math.max(0, Number(getQuery(e).after) || 0)
  const msgs = await q(MSG_SQL, [t.id, after])
  if (t.unread_admin) await q(`update chat_threads set unread_admin = 0 where id = $1`, [t.id])
  const other = await q(`select t2.id, t2.order_id, t2.last_from, t2.status, o.product_name from chat_threads t2 left join orders o on o.id = t2.order_id where t2.user_id = $1 and t2.id <> $2 order by t2.last_message_at desc limit 20`, [t.user_id, t.id])
  return { thread: { ...t, title: threadTitle(t) }, messages: msgs.map(m => msgView(m, '/api/admin/chats/file')), other: other.map(x => ({ ...x, title: threadTitle(x) })) }
})
