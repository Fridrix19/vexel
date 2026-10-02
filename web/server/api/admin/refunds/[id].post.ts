// решение по заявке: {action: 'approve'|'reject'|'done', note}
// на баланс: approve = возврат заказа на баланс сразу; на карту: approve → вернуть через провайдера → done (списывает с баланса, если это вывод)
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'refunds')
  const b = await readBody(e)
  const action = String(b?.action ?? ''), note = String(b?.note ?? '').trim().slice(0, 300)
  const r = await one(`select * from refund_requests where id::text = $1`, [getRouterParam(e, 'id')])
  if (!r) fail(404, 'not_found', 'Заявка не найдена.')
  if (action === 'reject') {
    if (!note) fail(422, 'note_required', 'Укажите причину отказа — её увидит клиент.')
    if (!['new', 'approved'].includes(r.status)) fail(409, 'closed', 'Заявка уже закрыта.')
    await q(`update refund_requests set status = 'rejected', admin_id = $2, admin_note = $3, decided_at = now() where id = $1`, [r.id, a.id, note])
    await notifyUser(r.user_id, 'Возврат отклонён', note, '/dashboard.html#payments:refunds')
  } else if (action === 'approve') {
    if (r.status !== 'new') fail(409, 'closed', 'Заявка уже рассмотрена.')
    if (r.destination === 'balance' && r.order_id) {
      await refundOrderSafe(r.order_id, a.id, note || 'Возврат по заявке')
      await q(`update refund_requests set status = 'done', admin_id = $2, admin_note = $3, decided_at = now() where id = $1`, [r.id, a.id, note || null])
    } else {
      await q(`update refund_requests set status = 'approved', admin_id = $2, admin_note = $3, decided_at = now() where id = $1`, [r.id, a.id, note || null])
      await notifyUser(r.user_id, 'Возврат одобрен', 'Деньги вернутся на карту, с которой вы платили, обычно за 1–5 рабочих дней.', '/dashboard.html#payments:refunds')
    }
  } else if (action === 'done') {
    if (r.status !== 'approved' || r.destination !== 'card') fail(409, 'bad_state', 'Отметить выполненным можно одобренный возврат на карту.')
    await tx(async (c) => {
      if (r.order_id) {
        await c.query(`update orders set status = 'refunded', updated_at = now() where id = $1`, [r.order_id])
        await c.query(`insert into order_events (order_id, kind, status, text, by_admin) values ($1, 'refund', 'refunded', 'Возврат на карту', $2)`, [r.order_id, a.id])
      } else {
        await c.query(`select ledger_post($1, $2, 'payout', null, $3, $4, 'Возврат пополнения на карту', $5)`, [r.user_id, -r.amount_kop, r.payment_id, a.id, 'payout:' + r.id])
      }
      await c.query(`update refund_requests set status = 'done', decided_at = now() where id = $1`, [r.id])
    })
  } else fail(422, 'bad_action', 'Неизвестное действие.')
  await audit(e, a, 'refund.' + action, r.id, { note, order_id: r.order_id, amount_kop: r.amount_kop })
  return { ok: true }
})
