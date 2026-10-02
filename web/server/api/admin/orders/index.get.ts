export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'orders')
  const { limit, offset, q: s } = page(e)
  const { status, product, from, to } = getQuery(e)
  const where = `($1 = '' or o.id ilike '%' || $1 || '%' or u.email ilike '%' || $1 || '%' or u.username ilike '%' || $1 || '%' or o.product_name ilike '%' || $1 || '%')
                 and ($2::text is null or o.status = any(string_to_array($2, ','))) and ($3::text is null or p.slug = $3)
                 and ($4::date is null or o.created_at >= $4::date) and ($5::date is null or o.created_at < $5::date + 1)`
  const args = [s, status ? String(status) : null, product ? String(product) : null, dateOrNull(from), dateOrNull(to)]
  const rows = await q(`select o.id, o.product_name, o.plan_label, o.amount_kop, o.price_cents, o.currency, o.status, o.created_at, o.updated_at,
      u.email, u.username, u.id user_id, p.slug, p.delivery, a.name admin_name
    from orders o join users u on u.id = o.user_id left join products p on p.id = o.product_id left join admins a on a.id = o.assigned_admin
    where ${where} order by o.created_at desc limit ${limit} offset ${offset}`, args)
  const total = (await one(`select count(*)::int n from orders o join users u on u.id = o.user_id left join products p on p.id = o.product_id where ${where}`, args)).n
  return { orders: rows, total }
})
