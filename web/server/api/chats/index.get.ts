// мои чаты с поддержкой: общий и по заказам
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const rows = await q(`select t.id, t.order_id, t.status, t.unread_user, t.last_message_at, t.last_from, o.product_name, o.plan_label,
      (select coalesce(m.body, 'Файл') from chat_messages m where m.thread_id = t.id order by m.id desc limit 1) last_text
    from chat_threads t left join orders o on o.id = t.order_id where t.user_id = $1 order by t.last_message_at desc`, [u.id])
  return { threads: rows.map(t => ({ ...t, title: threadTitle(t) })), unread: rows.reduce((s, t) => s + t.unread_user, 0) }
})
