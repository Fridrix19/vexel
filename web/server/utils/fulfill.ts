// после оплаты заказа: карта — выпуск/пополнение, товар с автовыдачей — ключ из пула; ручная — сообщить команде
export async function fulfillOrder(orderId: string) {
  const o = await one(`select o.id, o.status, o.product_name, o.plan_label, o.amount_kop, p.delivery from orders o join products p on p.id = o.product_id where o.id = $1`, [orderId])
  if (!o || o.status !== 'paid') return
  if (o.delivery === 'card_topup') return fulfillCardOrder(orderId)
  if (o.delivery === 'auto') {
    const k = await fulfillKeyOrder(orderId)
    if (k) return k
    notifyAdmins(`Закончились ключи: ${o.product_name}`, `Заказ ${o.id} (${o.plan_label}) ждёт ключ. Загрузите ключи в пул — заказ выдастся сам.`, '/admin/orders/' + o.id)
    return
  }
  notifyAdmins(`Новый заказ ${o.id}: ${o.product_name}`, `${o.product_name} · ${o.plan_label} · ${(o.amount_kop / 100).toFixed(2)} ₽. Нужна ручная выдача.`, '/admin/orders/' + o.id)
}

export async function fulfillKeyOrder(orderId: string, adminId: string | null = null) {
  const res = await tx(async (c) => {
    const o = (await c.query(`select * from orders where id = $1 for update`, [orderId])).rows[0]
    if (!o || !['paid', 'in_work', 'need_info'].includes(o.status)) return null
    const k = (await c.query(
      `select * from product_keys where product_id = $1 and status = 'free' and (plan_id = $2 or plan_id is null)
        order by (plan_id is null), created_at limit 1 for update skip locked`, [o.product_id, o.plan_id])).rows[0]
    if (!k) {
      const had = (await c.query(`select 1 from order_events where order_id = $1 and kind = 'note' and text like 'Ключи закончились%'`, [o.id])).rowCount
      if (!had) await c.query(`insert into order_events (order_id, kind, text) values ($1, 'note', 'Ключи закончились — выдадим вручную')`, [o.id])
      return null
    }
    await c.query(`update product_keys set status = 'sold', order_id = $2, sold_at = now() where id = $1`, [k.id, o.id])
    await c.query(`update orders set status = 'done', delivered_at = now(), updated_at = now(), delivery_enc = $2, assigned_admin = coalesce(assigned_admin, $3) where id = $1`,
      [o.id, k.secret_enc, adminId])
    await c.query(`insert into order_events (order_id, kind, status, text, by_admin) values ($1, 'delivered', 'done', 'Выдано автоматически из пула ключей', $2)`, [o.id, adminId])
    return { key: k.id, user: o.user_id, id: o.id, name: o.product_name }
  })
  if (!res) return null
  await notifyUser(res.user, `Заказ ${res.id} выполнен`, `${res.name}: данные для доступа — в карточке заказа.`, '/dashboard.html#order:' + res.id)
  return res.key
}

// ручная выдача админом: данные хранятся зашифрованными
export async function deliverManual(orderId: string, text: string, adminId: string) {
  const o = await tx(async (c) => {
    const o = (await c.query(`select * from orders where id = $1 for update`, [orderId])).rows[0]
    if (!o) fail(404, 'not_found', 'Заказ не найден.')
    if (['canceled', 'refunded'].includes(o.status)) fail(409, 'order_closed', 'Заказ отменён или возвращён.')
    await c.query(`update orders set status = 'done', delivered_at = now(), updated_at = now(), delivery_enc = $2, assigned_admin = $3 where id = $1`,
      [o.id, encrypt(text), adminId])
    await c.query(`insert into order_events (order_id, kind, status, text, by_admin) values ($1, 'delivered', 'done', 'Данные выданы', $2)`, [o.id, adminId])
    return o
  })
  await notifyUser(o.user_id, `Заказ ${o.id} выполнен`, `${o.product_name}: данные для доступа — в карточке заказа.`, '/dashboard.html#order:' + o.id)
  return o.id
}

// возврат заказа на баланс. Для виртуальной карты сначала списываем эту сумму с карты — иначе деньги окажутся и на карте, и на балансе.
export async function refundOrderSafe(orderId: string, adminId: string, reason: string) {
  const o = await tx(async (c) => {
    const o = (await c.query(`select o.*, p.delivery from orders o left join products p on p.id = o.product_id where o.id = $1 for update of o`, [orderId])).rows[0]
    if (!o) fail(404, 'not_found', 'Заказ не найден.')
    if (o.status === 'refunded') return o
    if (o.delivery === 'card_topup' && o.status === 'done') {
      const t = (await c.query(`select ct.card_id, ct.amount_cents, cd.balance_cents, cd.last4 from card_topups ct join cards cd on cd.id = ct.card_id where ct.order_id = $1 for update of cd`, [o.id])).rows[0]
      if (t) {
        if (t.balance_cents < t.amount_cents) fail(409, 'card_spent', `На карте •• ${t.last4} осталось $${(t.balance_cents / 100).toFixed(2)} — меньше суммы заказа. Верните остаток корректировкой баланса.`)
        await c.query(`update cards set balance_cents = balance_cents - $2, updated_at = now() where id = $1`, [t.card_id, t.amount_cents])
        await c.query(`delete from card_topups where order_id = $1`, [o.id])
      }
    }
    return (await c.query(`select * from refund_order($1, $2, $3)`, [o.id, adminId, reason])).rows[0]
  })
  return o
}

// отметить заказ подарком и сообщить другу
export async function setGift(o: any, giftTo: string, buyer: { id: string; email: string }) {
  await q(`update orders set gift_to = $2 where id = $1`, [o.id, giftTo])
  o.gift_to = giftTo
  const b = await one(`select username from users where id = $1`, [buyer.id])
  const what = o.product_name === 'Виртуальная карта' ? `виртуальную карту Vexel на $${(o.price_cents / 100).toFixed(2).replace(/\.00$/, '')}` : `${o.product_name} (${o.plan_label}) — оформим на эту почту`
  sendMail(giftMail(giftTo, b?.username || 'Друг', what, String(useRuntimeConfig().public.siteUrl || ''))).catch(() => {})
}
