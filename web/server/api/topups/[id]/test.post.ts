// тестовый провайдер: «оплатить» или «отменить» — вместо hosted-страницы банка.
// В бою этот маршрут выключен; деньги зачисляет только вебхук провайдера.
export default defineEventHandler(async (e) => {
  if ((useRuntimeConfig().paymentProvider || 'test') !== 'test') fail(404, 'not_found', 'Не найдено.')
  const u = await requireUser(e)
  const id = getRouterParam(e, 'id')
  const action = (await readBody(e))?.action === 'cancel' ? 'cancel' : 'succeed'
  const p = await one(`select id, status from payments where id = $1 and user_id = $2 and provider = 'test'`, [id, u.id])
  if (!p) fail(404, 'not_found', 'Платёж не найден.')
  if (action === 'cancel') {
    await q(`update payments set status = 'canceled' where id = $1 and status = 'pending'`, [id])
    return { status: 'canceled' }
  }
  return onPaymentSucceeded(id!)
})
