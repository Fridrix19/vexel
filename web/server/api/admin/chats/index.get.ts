// чаты: ?filter=waiting (ждут ответа, по умолчанию) | all | closed; q — почта, логин, заказ
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'chats')
  const qy = getQuery(e)
  const filter = ['waiting', 'all', 'closed'].includes(String(qy.filter)) ? String(qy.filter) : 'waiting'
  const s = String(qy.q ?? '').trim()
  const rows = await q(`select t.id, t.order_id, t.status, t.unread_admin, t.last_message_at, t.last_from, o.product_name, o.plan_label, o.status order_status,
      u.id user_id, u.email, u.username, u.name,
      (select coalesce(m.body, 'Файл') from chat_messages m where m.thread_id = t.id order by m.id desc limit 1) last_text
    from chat_threads t join users u on u.id = t.user_id left join orders o on o.id = t.order_id
    where ${filter === 'waiting' ? "t.last_from = 'user' and t.status = 'open'" : filter === 'closed' ? "t.status = 'closed'" : 'true'}
      and ($1 = '' or u.email ilike '%' || $1 || '%' or u.username ilike '%' || $1 || '%' or coalesce(t.order_id, '') ilike '%' || $1 || '%')
    order by ${filter === 'waiting' ? 't.last_message_at asc' : 't.last_message_at desc'} limit 200`, [s])
  const counts = await one(`select count(*) filter (where last_from = 'user' and status = 'open')::int waiting, count(*)::int total from chat_threads`)
  return { threads: rows.map(t => ({ ...t, title: threadTitle(t) })), counts }
})
