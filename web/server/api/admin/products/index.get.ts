export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'products')
  const { q: s } = page(e)
  const { category, active } = getQuery(e)
  const rows = await q(`select p.id, p.slug, p.name, p.category_id, p.icon, p.delivery, p.active, p.sort, p.commission_pct, p.updated_at, (select name from admins where id = p.updated_by) updated_by_name,
      (select count(*)::int from product_plans pp where pp.product_id = p.id) plans,
      (select count(*)::int from product_keys k where k.product_id = p.id and k.status = 'free') keys_free,
      (select count(*)::int from orders o where o.product_id = p.id and o.created_at > now() - interval '30 days') orders_30d
    from products p
    where ($1 = '' or p.name ilike '%' || $1 || '%' or p.slug ilike '%' || $1 || '%')
      and ($2::text is null or p.category_id = $2) and ($3::text is null or p.active = ($3 = 'true'))
    order by p.category_id, p.sort, p.name`, [s, category ? String(category) : null, active ? String(active) : null])
  return { products: rows, categories: await q(`select id, name from categories order by sort`) }
})
