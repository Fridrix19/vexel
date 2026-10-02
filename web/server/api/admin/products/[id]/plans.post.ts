export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const p = await one(`select id, slug from products where id::text = $1`, [getRouterParam(e, 'id')])
  if (!p) fail(404, 'not_found', 'Товар не найден.')
  const v = planInput(await readBody(e))
  const pl = await one(`insert into product_plans (product_id, label, currency, price_cents, price_kop, price_text, description, free, active, sort, custom_min_cents, custom_max_cents)
                        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [p.id, v.label, v.currency, v.price_cents, v.price_kop, v.price_text, v.description, v.free, v.active, v.sort, v.custom_min_cents, v.custom_max_cents])
  await q(`update products set updated_at = now(), updated_by = $2 where id = $1`, [p.id, a.id])
  await audit(e, a, 'plan.create', pl.id, { product: p.slug, ...v })
  return { plan: pl }
})
