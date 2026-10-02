export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const p = await one(`select id, amount_kop, provider, status, for_order, created_at, paid_at from payments where id = $1 and user_id = $2`,
    [getRouterParam(e, 'id'), u.id])
  if (!p) fail(404, 'not_found', 'Платёж не найден.')
  const order = p.status === 'succeeded' && p.for_order
    ? await one(`select order_id from ledger_entries where idempotency_key = $1`, ['order:topup:' + p.id]) : null
  return { payment: p, order_id: order?.order_id ?? null }
})
