export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const { status } = getQuery(e)
  const rows = await q(
    `select o.*, p.slug as product_slug, exists (select 1 from reviews r where r.order_id = o.id) reviewed,
        (select t.unread_user from chat_threads t where t.order_id = o.id) chat_unread from orders o left join products p on p.id = o.product_id
      where o.user_id = $1 and ($2::text is null or o.status = $2) order by o.created_at desc limit 200`,
    [u.id, status ? String(status) : null])
  return { orders: rows.map(orderView) }
})
