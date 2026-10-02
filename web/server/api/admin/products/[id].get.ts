export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'products')
  const p = await one(`select p.*, (select name from admins where id = p.updated_by) updated_by_name from products p where p.id::text = $1 or p.slug = $1`, [getRouterParam(e, 'id')])
  if (!p) fail(404, 'not_found', 'Товар не найден.')
  const r = await rate()
  const plans = await q(`select pp.*, (select count(*)::int from product_keys k where k.plan_id = pp.id and k.status = 'free') keys_free
                           from product_plans pp where product_id = $1 order by sort, label`, [p.id])
  const keys = await q(`select k.id, k.plan_id, k.status, k.order_id, k.created_at, k.sold_at, a.name added_by from product_keys k left join admins a on a.id = k.added_by
                          where k.product_id = $1 order by k.status = 'free' desc, k.created_at desc limit 300`, [p.id])
  return { product: p, rate: r, plans: plans.map(x => ({ ...x, view: planView(x, r, p.commission_pct) })), keys }
})
