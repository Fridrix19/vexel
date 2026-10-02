// изменение товара; цены тарифов — отдельно (/admin/plans). Уже оформленные заказы не меняются: в них снимок цены.
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const b = await readBody(e)
  const before = await one(`select * from products where id::text = $1`, [getRouterParam(e, 'id')])
  if (!before) fail(404, 'not_found', 'Товар не найден.')
  const v = productInput({ ...before, ...b }, false)
  const p = await one(`update products set category_id=$2, name=$3, description=$4, icon=$5, delivery=$6, buyer_fields=$7, active=$8, sort=$9, commission_pct=$10, updated_at=now(), updated_by=$11
                        where id = $1 returning *`,
    [before.id, v.category_id, v.name, v.description, v.icon, v.delivery, JSON.stringify(v.buyer_fields), v.active, v.sort, v.commission_pct, a.id])
    .catch((err: any) => { if (err?.code === '23503') fail(422, 'bad_category', 'Нет такой категории.'); throw err })
  const changed: Record<string, any> = {}
  for (const k of ['category_id','name','description','icon','delivery','active','sort','commission_pct']) if (String(before[k]) !== String(p[k])) changed[k] = [before[k], p[k]]
  if (JSON.stringify(before.buyer_fields) !== JSON.stringify(p.buyer_fields)) changed.buyer_fields = true
  await audit(e, a, 'product.update', p.id, { slug: p.slug, changed })
  return { product: p }
})
