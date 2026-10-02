// общая точка для вебхука любого провайдера: зачислить и, если пополняли «под заказ», оформить его
export async function onPaymentSucceeded(paymentId: string) {
  try { await q(`select payment_succeeded($1)`, [paymentId]) }
  catch (e: any) {
    if (e?.message === 'payment_not_pending') fail(409, 'payment_not_pending', 'Платёж отменён или уже возвращён.')
    throw e
  }
  const p = await one(`select id, user_id, for_order from payments where id = $1`, [paymentId])
  if (p) trackAction(p.user_id, 'topup_paid', { label: 'пополнение оплачено', payment_id: p.id })
  let order: any = null, order_error: string | null = null
  if (p?.for_order?.plan_id) {
    try {
      order = await one(`select * from place_order($1, $2, $3, $4, $5, $6)`,
        [p.user_id, p.for_order.plan_id, p.for_order.fields ?? {}, 'topup:' + p.id, p.for_order.amount_cents ?? null, p.for_order.use_bonus !== false])
      if (p.for_order.gift_to && order && !order.gift_to) await setGift(order, p.for_order.gift_to, { id: p.user_id, email: '' })
    } catch (e: any) { order_error = e?.message ?? 'order_failed' }
    if (order?.id) await fulfillOrder(order.id)
  }
  return { status: 'succeeded', order_id: order?.id ?? null, order_error }
}
