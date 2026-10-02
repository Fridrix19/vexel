// отзывы для модерации: ?status=published|hidden, q — товар, текст, почта
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'reviews')
  const qy = getQuery(e)
  const status = ['published', 'hidden'].includes(String(qy.status)) ? String(qy.status) : null
  const s = String(qy.q ?? '').trim()
  const rows = await q(`select r.*, p.name product_name, p.slug, u.email, u.username, a.name reply_by_name
    from reviews r join products p on p.id = r.product_id join users u on u.id = r.user_id left join admins a on a.id = r.reply_by
    where ($1::text is null or r.status = $1) and ($2 = '' or p.name ilike '%' || $2 || '%' or r.text ilike '%' || $2 || '%' or u.email ilike '%' || $2 || '%' or r.order_id ilike '%' || $2 || '%')
    order by r.created_at desc limit 300`, [status, s])
  return { reviews: rows }
})
