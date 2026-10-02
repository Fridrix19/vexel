// покупка с баланса. idem — ключ от клиента (uuid на попытку), повторный клик вернёт тот же заказ
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const idem = String(b?.idem ?? '')
  if (!/^[\w-]{8,80}$/.test(idem)) fail(422, 'bad_idem', 'Нужен ключ идемпотентности (idem).')
  const pend = await pendingDocuments(u.id)
  if (pend.length) fail(409, 'docs_update_required', 'Обновились условия: ' + pend.map(d => d.title).join(', ') + '. Ознакомьтесь и примите их в разделе «Документы», затем повторите покупку.', { documents: pend.map(d => d.id) })
  const plan = await one(
    `select pp.id, pr.buyer_fields, pr.slug from product_plans pp join products pr on pr.id = pp.product_id where pp.id::text = $1`, [String(b?.plan_id ?? '')])
  if (!plan) fail(404, 'plan_not_found', 'Тариф не найден.')
  const fields: Record<string, string> = validateFields(plan.buyer_fields, b?.fields)
  // пополнение существующей карты: карта должна быть своей и активной
  if (plan.slug === 'virtual-card' && b?.card_id) {
    const card = await one(`select id from cards where id::text = $1 and user_id = $2 and status = 'active' and (gift_to is null or claimed_at is not null)`, [String(b.card_id), u.id])
    if (!card) fail(422, 'card_unavailable', 'Карта заморожена или не найдена.')
    fields.card_id = card.id
  }
  // подарок другу: почта получателя (для карты — кому достанется карта, для сервиса — аккаунт друга)
  const giftTo = b?.gift_to ? normEmail(b.gift_to) : null
  if (giftTo && giftTo === u.email) fail(422, 'gift_self', 'Это ваша почта — выберите «На мою почту».')
  if (giftTo && b?.card_id) fail(422, 'gift_topup', 'Подарить можно новую карту, а не пополнение своей.')
  if (giftTo && plan.slug !== 'virtual-card' && 'account_email' in fields) fields.account_email = giftTo
  const amount = b?.amount_cents != null ? Math.round(Number(b.amount_cents)) : null
  try {
    let o = await one(`select * from place_order($1, $2, $3, $4, $5, $6)`, [u.id, plan.id, fields, 'u:' + u.id + ':' + idem, amount, b?.use_bonus !== false])
    if (giftTo && !o.gift_to) await setGift(o, giftTo, u)
    await fulfillOrder(o.id)
    o = await one(`select * from orders where id = $1`, [o.id])
    trackAction(u.id, 'order', { label: o.product_name + ' · ' + o.plan_label, order_id: o.id, amount_kop: o.amount_kop })
    return { order: orderView(o) }
  } catch (err) { pgFail(err) }
})

function validateFields(spec: any[], input: any) {
  const out: Record<string, string> = {}
  const errors: Record<string, string> = {}
  for (const f of spec || []) {
    const v = String(input?.[f.key] ?? '').trim().slice(0, 500)
    if (!v) { if (f.required) errors[f.key] = `Заполните поле «${f.label}».`; continue }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { errors[f.key] = 'Проверьте почту.'; continue }
    out[f.key] = v
  }
  if (Object.keys(errors).length) fail(422, 'bad_fields', Object.values(errors)[0], { fields: errors })
  return out
}
