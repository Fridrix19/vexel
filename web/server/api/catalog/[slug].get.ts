export default defineEventHandler(async (e) => {
  const slug = getRouterParam(e, 'slug')
  const p = await one(`select id, slug, name, category_id as category, description, icon, delivery, buyer_fields, commission_pct from products where slug = $1 and active`, [slug])
  if (!p) fail(404, 'not_found', 'Товар не найден.')
  setHeader(e, 'cache-control', 'no-store')
  const r = await rate()
  const plans = await q(`select * from product_plans where product_id = $1 and active order by sort`, [p.id])
  return { rate: r, product: { ...p, id: undefined }, plans: plans.map(x => planView(x, r, p.commission_pct)) }
})
