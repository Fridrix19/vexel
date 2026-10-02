// смена статуса: in_work / need_info (с текстом для клиента) / paid (вернуть в очередь)
const ALLOWED = ['in_work', 'need_info', 'paid']
const TEXT: Record<string, string> = { in_work: 'Заказ взят в работу', need_info: 'Нужны данные от клиента', paid: 'Заказ возвращён в очередь' }
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'orders')
  const b = await readBody(e)
  const status = String(b?.status ?? '')
  if (!ALLOWED.includes(status)) fail(422, 'bad_status', 'Недопустимый статус.')
  const text = String(b?.text ?? '').trim().slice(0, 500) || TEXT[status]
  const o = await one(`update orders set status = $2, updated_at = now(), assigned_admin = $3 where id = $1 and status in ('paid','in_work','need_info') returning id, user_id`,
    [getRouterParam(e, 'id'), status, a.id])
  if (!o) fail(409, 'order_closed', 'Заказ уже закрыт.')
  await q(`insert into order_events (order_id, kind, status, text, by_admin) values ($1, 'status', $2, $3, $4)`, [o.id, status, text, a.id])
  if (status === 'need_info') await notifyUser(o.user_id, `Заказ ${o.id}: нужны данные`, text, '/dashboard.html#order:' + o.id)
  await audit(e, a, 'order.status', o.id, { status, text })
  return { ok: true }
})
