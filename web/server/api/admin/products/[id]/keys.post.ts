// загрузка ключей в пул: {plan_id?, keys: "по одному на строку"}; хранятся зашифрованными
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const p = await one(`select id, slug from products where id::text = $1`, [getRouterParam(e, 'id')])
  if (!p) fail(404, 'not_found', 'Товар не найден.')
  const b = await readBody(e)
  const planId = b?.plan_id ? (await one(`select id from product_plans where id::text = $1 and product_id = $2`, [String(b.plan_id), p.id]))?.id : null
  if (b?.plan_id && !planId) fail(422, 'bad_plan', 'Тариф не относится к этому товару.')
  const keys = [...new Set(String(b?.keys ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean))]
  if (!keys.length) fail(422, 'no_keys', 'Вставьте ключи — по одному на строку.')
  if (keys.length > 1000) fail(422, 'too_many', 'Не больше 1000 ключей за раз.')
  await tx(async (c) => { for (const k of keys) await c.query(`insert into product_keys (product_id, plan_id, secret_enc, added_by) values ($1, $2, $3, $4)`, [p.id, planId, encrypt(k.slice(0, 2000)), a.id]) })
  await q(`update products set updated_at = now(), updated_by = $2 where id = $1`, [p.id, a.id])
  await audit(e, a, 'keys.add', p.id, { product: p.slug, plan_id: planId, count: keys.length })
  // заказы, ждавшие ключей, — выдать сейчас
  const waiting = await q(`select o.id from orders o join products pr on pr.id = o.product_id where o.product_id = $1 and pr.delivery = 'auto' and o.status = 'paid' order by o.created_at`, [p.id])
  let delivered = 0
  for (const o of waiting) if (await fulfillKeyOrder(o.id)) delivered++
  return { added: keys.length, delivered_waiting: delivered }
})
