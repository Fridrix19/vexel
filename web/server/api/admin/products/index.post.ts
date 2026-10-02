// новый товар
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const b = await readBody(e)
  const v = productInput(b, true)
  const p = await one(`insert into products (slug, category_id, name, description, icon, delivery, buyer_fields, active, sort, commission_pct, updated_by)
                       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [v.slug, v.category_id, v.name, v.description, v.icon, v.delivery, JSON.stringify(v.buyer_fields), v.active, v.sort, v.commission_pct, a.id])
    .catch((err: any) => { if (err?.code === '23505') fail(409, 'slug_taken', 'Такой адрес (slug) уже занят.'); if (err?.code === '23503') fail(422, 'bad_category', 'Нет такой категории.'); throw err })
  await audit(e, a, 'product.create', p.id, { slug: p.slug, name: p.name })
  return { product: p }
})
