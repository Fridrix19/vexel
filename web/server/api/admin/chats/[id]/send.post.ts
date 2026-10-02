// ответ пользователю: {text} или multipart с файлом. Пользователю — уведомление в кабинете (и письмо, если это первое непрочитанное)
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'chats')
  const { text, file } = await readChatBody(e)
  const t = await one(`select * from chat_threads where id::text = $1`, [getRouterParam(e, 'id')])
  if (!t) fail(404, 'not_found', 'Чат не найден.')
  const fileId = await saveChatFile(file, { admin: a.id })
  const m = await one(`insert into chat_messages (thread_id, author, admin_id, body, file_id) values ($1, 'admin', $2, $3, $4) returning id`, [t.id, a.id, text, fileId])
  await q(`update chat_threads set last_from = 'admin', last_message_at = now(), unread_user = unread_user + 1, unread_admin = 0, answered_by = $2, status = 'open' where id = $1`, [t.id, a.id])
  const link = t.order_id ? '/dashboard.html#order:' + t.order_id : '/dashboard.html#support'
  const title = t.order_id ? 'Ответ поддержки по заказу ' + t.order_id : 'Ответ поддержки'
  const preview = (text || 'Файл').slice(0, 200)
  if (t.unread_user === 0) await notifyUser(t.user_id, title, preview, link)
  else await q(`insert into notifications (user_id, title, body, link) values ($1, $2, $3, $4)`, [t.user_id, title, preview, link])
  await audit(e, a, 'chat.reply', t.id, { order_id: t.order_id })
  const full = await one(MSG_SQL.replace('m.id > $2 order by m.id limit 500', 'm.id = $2'), [t.id, m.id])
  return { message: msgView(full, '/api/admin/chats/file') }
})
