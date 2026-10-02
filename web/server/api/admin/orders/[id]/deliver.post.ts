// выдача: {mode: 'manual', text} — данные вводит админ; {mode: 'key'} — ключ из пула
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'orders')
  const b = await readBody(e)
  const id = getRouterParam(e, 'id')!
  if (b?.mode === 'key') {
    const k = await fulfillKeyOrder(id, a.id)
    if (!k) fail(409, 'no_keys', 'Свободных ключей для этого тарифа нет — добавьте в пул или выдайте вручную.')
    await audit(e, a, 'order.deliver_key', id, { key_id: k })
    return { ok: true }
  }
  const text = String(b?.text ?? '').trim()
  if (!text) fail(422, 'text_required', 'Введите данные для выдачи.')
  if (text.length > 4000) fail(422, 'too_long', 'Слишком длинный текст.')
  await deliverManual(id, text, a.id)
  await audit(e, a, 'order.deliver', id, { length: text.length })
  return { ok: true }
})
