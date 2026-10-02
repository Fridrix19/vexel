export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'refunds')
  const { status, from, to } = getQuery(e)
  const rows = await q(`select r.*, u.email, o.product_name, o.status order_status, a.name admin_name
      from refund_requests r join users u on u.id = r.user_id left join orders o on o.id = r.order_id left join admins a on a.id = r.admin_id
     where ($1::text is null or r.status = $1) and ($2::date is null or r.created_at >= $2::date) and ($3::date is null or r.created_at < $3::date + 1) order by (r.status = 'new') desc, r.created_at desc limit 200`, [status ? String(status) : null, dateOrNull(from), dateOrNull(to)])
  return { refunds: rows }
})
