// модерация: {status: published|hidden, reply} — ответ магазина виден под отзывом
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'reviews')
  const b = await readBody(e)
  const r = await one(`select * from reviews where id::text = $1`, [getRouterParam(e, 'id')])
  if (!r) fail(404, 'not_found', 'Отзыв не найден.')
  const status = b?.status === undefined ? r.status : ['published', 'hidden'].includes(b.status) ? b.status : fail(422, 'bad_status', 'Статус: published или hidden.')
  const reply = b?.reply === undefined ? r.reply : (String(b.reply ?? '').trim().slice(0, 2000) || null)
  const n = await one(`update reviews set status = $2, reply = $3, reply_at = case when $3 is distinct from reply then now() else reply_at end,
      reply_by = case when $3 is distinct from reply then $4::uuid else reply_by end, updated_at = now() where id = $1 returning *`, [r.id, status, reply, a.id])
  if (reply && reply !== r.reply) await q(`insert into notifications (user_id, title, body, link) values ($1, 'Ответ на ваш отзыв', $2, $3)`, [r.user_id, reply.slice(0, 200), '/dashboard.html#order:' + r.order_id])
  await audit(e, a, status !== r.status ? (status === 'hidden' ? 'review.hide' : 'review.show') : 'review.reply', r.id, { order_id: r.order_id })
  return { review: n }
})
