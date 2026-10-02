// написать в поддержку: {text, order_id?} или multipart с файлом. Ветка создаётся при первом сообщении
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const { text, orderId, file } = await readChatBody(e)
  let order: any = null
  if (orderId) { order = await one(`select id, product_name, plan_label from orders where id = $1 and user_id = $2`, [orderId, u.id]); if (!order) fail(404, 'not_found', 'Заказ не найден.') }
  const recent = await one(`select count(*)::int n from chat_messages m join chat_threads t on t.id = m.thread_id where t.user_id = $1 and m.author = 'user' and m.created_at > now() - interval '5 minutes'`, [u.id])
  if (recent.n >= 30) fail(429, 'too_many', 'Слишком много сообщений подряд — подождите пару минут.')
  const fileId = await saveChatFile(file, { user: u.id })
  const r = await tx(async (c) => {
    let t = (await c.query(`select * from chat_threads where user_id = $1 and ${orderId ? 'order_id = $2' : 'order_id is null'} for update`, orderId ? [u.id, orderId] : [u.id])).rows[0]
    if (!t) t = (await c.query(`insert into chat_threads (user_id, order_id, subject) values ($1, $2, $3) returning *`, [u.id, orderId, order ? order.product_name : 'Общий вопрос'])).rows[0]
    const wasWaiting = t.last_from === 'user' && t.status === 'open'
    const m = (await c.query(`insert into chat_messages (thread_id, author, body, file_id) values ($1, 'user', $2, $3) returning *`, [t.id, text, fileId])).rows[0]
    await c.query(`update chat_threads set last_from = 'user', last_message_at = now(), unread_admin = unread_admin + 1, status = 'open' where id = $1`, [t.id])
    return { t, m, wasWaiting }
  })
  if (!r.wasWaiting) notifyAdmins(`Новое сообщение${order ? ' по заказу ' + order.id : ''}`, `${u.email}: ${(text || 'файл').slice(0, 300)}`, '/admin/chats?id=' + r.t.id)
  trackAction(u.id, 'chat', { label: order ? order.id : 'общий чат' })
  const full = await one(MSG_SQL.replace('m.id > $2 order by m.id limit 500', 'm.id = $2'), [r.t.id, r.m.id])
  return { thread_id: r.t.id, message: msgView(full, '/api/chats/file') }
})
