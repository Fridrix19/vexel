// пополнение баланса: создаёт платёж у провайдера (пока — тестовый)
const MIN_KOP = 100_00, MAX_KOP = 300_000_00

export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const amount = Math.round(Number(b?.amount_kop))
  if (!Number.isFinite(amount) || amount < MIN_KOP || amount > MAX_KOP)
    fail(422, 'bad_amount', 'Сумма пополнения — от 100 до 300 000 ₽.', { min_kop: MIN_KOP, max_kop: MAX_KOP })
  let forOrder = null
  if (b?.for_order?.plan_id) {
    forOrder = { plan_id: String(b.for_order.plan_id), fields: b.for_order.fields ?? {}, amount_cents: b.for_order.amount_cents ?? null, gift_to: b.for_order.gift_to ? normEmail(b.for_order.gift_to) : null, use_bonus: b.for_order.use_bonus !== false }
  }
  const provider = useRuntimeConfig().paymentProvider || 'test'
  if (provider !== 'test') fail(501, 'provider_not_configured', 'Платёжный провайдер ещё не подключён.')
  const p = await one<{ id: string }>(
    `insert into payments (user_id, amount_kop, provider, for_order) values ($1, $2, 'test', $3) returning id, amount_kop, status, created_at`,
    [u.id, amount, forOrder])
  await q(`update payments set provider_id = id::text where id = $1`, [p!.id])
  trackAction(u.id, 'topup_start', { label: (amount / 100) + ' ₽', payment_id: p!.id })
  return { payment: p, provider: 'test', confirm: { type: 'test', url: `/api/topups/${p!.id}/test` } }
})
