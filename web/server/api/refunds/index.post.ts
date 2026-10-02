// заявка на возврат: по заказу (на баланс или на карту) или вывод пополнения на карту
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const reason = String(b?.reason ?? '').trim().slice(0, 500)
  if (!reason) fail(422, 'reason_required', 'Опишите причину возврата.')
  const destination = b?.destination === 'card' ? 'card' : 'balance'
  let amount = 0, orderId: string | null = null, paymentId: string | null = null
  if (b?.order_id) {
    const o = await one(`select id, amount_kop, status from orders where id = $1 and user_id = $2`, [String(b.order_id), u.id])
    if (!o) fail(404, 'not_found', 'Заказ не найден.')
    if (['refunded', 'canceled'].includes(o.status)) fail(409, 'order_closed', 'По этому заказу уже был возврат или отмена.')
    orderId = o.id; amount = o.amount_kop
  } else if (b?.payment_id) {
    const p = await one(`select id, amount_kop from payments where id::text = $1 and user_id = $2 and status = 'succeeded'`, [String(b.payment_id), u.id])
    if (!p) fail(404, 'not_found', 'Платёж не найден.')
    paymentId = p.id; amount = Math.min(p.amount_kop, (await one(`select user_balance($1) b`, [u.id])).b)
    if (amount <= 0) fail(422, 'nothing_to_refund', 'На балансе нет средств для возврата.')
  } else fail(422, 'target_required', 'Выберите заказ или платёж.')
  if (await one(`select 1 from refund_requests where user_id = $1 and status = 'new' and (order_id = $2 or payment_id = $3)`, [u.id, orderId, paymentId]))
    fail(409, 'already_requested', 'Заявка уже на рассмотрении.')
  const r = await one(`insert into refund_requests (user_id, order_id, payment_id, amount_kop, destination, reason) values ($1, $2, $3, $4, $5, $6) returning *`,
    [u.id, orderId, paymentId, amount, destination, reason])
  notifyAdmins('Заявка на возврат', `${u.email}: ${(amount / 100).toFixed(2)} ₽, ${destination === 'card' ? 'на карту' : 'на баланс'}. Причина: ${reason}`, '/admin/refunds')
  return { refund: r }
})
