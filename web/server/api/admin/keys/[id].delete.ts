// отозвать свободный ключ
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const k = await one(`update product_keys set status = 'revoked' where id::text = $1 and status = 'free' returning id, product_id`, [getRouterParam(e, 'id')])
  if (!k) fail(409, 'not_free', 'Ключ уже продан или отозван.')
  await audit(e, a, 'keys.revoke', k.id, { product_id: k.product_id })
  return { ok: true }
})
