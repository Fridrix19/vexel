// тариф: цена в $ (центы) или ₽ (копейки). Новая цена действует только для новых заказов.
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const before = await one(`select pp.*, p.slug from product_plans pp join products p on p.id = pp.product_id where pp.id::text = $1`, [getRouterParam(e, 'id')])
  if (!before) fail(404, 'not_found', 'Тариф не найден.')
  const body = await readBody(e)
  const v = planInput({ ...before, ...body })
  // цена изменилась, а подпись («$20/month») прислали старую — подставим новую сумму, чтобы на сайте не было расхождения
  if (body?.price_text === undefined || body.price_text === before.price_text) {
    const f = (c: number) => (c / 100) % 1 ? (c / 100).toFixed(2) : String(c / 100)
    if (v.currency === 'usd' && before.price_cents && v.price_cents && v.price_cents !== before.price_cents && v.price_text)
      v.price_text = v.price_text.replace('$' + f(before.price_cents), '$' + f(v.price_cents))
    if (v.currency === 'rub' && before.price_kop && v.price_kop && v.price_kop !== before.price_kop && v.price_text) {
      const r = (k: number) => new Intl.NumberFormat('ru-RU').format(k / 100)
      v.price_text = v.price_text.replace(r(before.price_kop), r(v.price_kop)).replace(String(before.price_kop / 100), String(v.price_kop / 100))
    }
  }
  const pl = await one(`update product_plans set label=$2, currency=$3, price_cents=$4, price_kop=$5, price_text=$6, description=$7, free=$8, active=$9, sort=$10, custom_min_cents=$11, custom_max_cents=$12
                         where id = $1 returning *`,
    [before.id, v.label, v.currency, v.price_cents, v.price_kop, v.price_text, v.description, v.free, v.active, v.sort, v.custom_min_cents, v.custom_max_cents])
  const changed: Record<string, any> = {}
  for (const k of ['label','currency','price_cents','price_kop','price_text','free','active','custom_min_cents','custom_max_cents']) if (String(before[k]) !== String(pl[k])) changed[k] = [before[k], pl[k]]
  await audit(e, a, 'plan.update', pl.id, { product: before.slug, label: pl.label, changed })
  await q(`update products set updated_at = now(), updated_by = $2 where id = $1`, [pl.product_id, a.id])
  return { plan: pl }
})
