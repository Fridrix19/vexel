// шаг 2: код верный → полный номер, срок и CVV (фронт скрывает через 60 с)
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const c = await one(`select * from cards where id::text = $1 and user_id = $2`, [getRouterParam(e, 'id'), u.id])
  if (!c) fail(404, 'not_found', 'Карта не найдена.')
  if (c.gift_to && !c.claimed_at) fail(422, 'gift_pending', 'Это подарок — реквизиты увидит получатель после входа.')
  if (c.status !== 'active') fail(422, 'card_frozen', 'Карта заморожена — сначала разморозьте её.')
  await consumeCode(u.email, 'reveal', checkCode((await readBody(e))?.code))
  const pan = decrypt(c.pan_enc)
  return { pan: pan.replace(/(\d{4})(?=\d)/g, '$1 '), exp: c.exp, cvv: decrypt(c.cvv_enc), holder: c.holder, test: c.test, ttl_sec: 60 }
})
