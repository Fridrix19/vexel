import { randomInt } from 'node:crypto'

// бета: тестовый номер Visa с правильной контрольной суммой (Luhn)
function testPan() {
  const d = [4, 0, 0, 0, 0, 0]
  while (d.length < 15) d.push(randomInt(0, 10))
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let x = d[14 - i]
    if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9 }
    sum += x
  }
  d.push((10 - (sum % 10)) % 10)
  return d.join('')
}

export function cardView(c: any) {
  return {
    gift_to: c.claimed_at ? null : c.gift_to || null, gift: !!c.gift_from,
    id: c.id, brand: c.brand, last4: c.last4, exp: c.exp, holder: c.holder,
    balance_cents: c.balance_cents, status: c.status, test: c.test,
    order_id: c.order_id, created_at: c.created_at,
  }
}

// Выпуск или пополнение карты по оплаченному заказу на «Виртуальную карту».
// Идемпотентно: заказ не в статусе paid — ничего не делает.
export async function fulfillCardOrder(orderId: string) {
  return tx(async (c) => {
    const o = (await c.query(
      `select o.*, p.slug from orders o join products p on p.id = o.product_id where o.id = $1 for update of o`, [orderId])).rows[0]
    if (!o || o.slug !== 'virtual-card' || o.status !== 'paid') return null
    const cardId = o.buyer_fields?.card_id
    let card: any, text: string
    if (cardId) {
      card = (await c.query(`update cards set balance_cents = balance_cents + $3, updated_at = now()
                              where id::text = $1 and user_id = $2 and status = 'active' returning *`, [cardId, o.user_id, o.price_cents])).rows[0]
      if (!card) {
        await c.query(`update orders set status = 'need_info', updated_at = now() where id = $1`, [o.id])
        await c.query(`insert into order_events (order_id, kind, status, text) values ($1, 'status', 'need_info', 'Карта для пополнения заморожена или не найдена — напишите в поддержку')`, [o.id])
        return null
      }
      text = `Карта ${card.brand} •• ${card.last4} пополнена на $${(o.price_cents / 100).toFixed(2).replace(/\.00$/, '')}`
    } else {
      const pan = testPan(), cvv = String(randomInt(100, 1000))
      const d = new Date(); const exp = String(d.getMonth() + 1).padStart(2, '0') + '/' + String((d.getFullYear() + 3) % 100).padStart(2, '0')
      // подарок: у друга уже есть аккаунт с этой почтой — карта сразу его; нет — ждёт, пока он войдёт или зарегистрируется
      const friend = o.gift_to ? (await c.query(`select id from users where email = $1`, [o.gift_to])).rows[0] : null
      card = (await c.query(
        `insert into cards (user_id, order_id, last4, exp, pan_enc, cvv_enc, balance_cents, gift_to, gift_from, claimed_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
        [friend ? friend.id : o.user_id, o.id, pan.slice(-4), exp, encrypt(pan), encrypt(cvv), o.price_cents, o.gift_to || null, o.gift_to ? o.user_id : null, friend ? new Date() : null])).rows[0]
      const sum = '$' + (o.price_cents / 100).toFixed(2).replace(/\.00$/, '')
      text = o.gift_to ? `Карта ${card.brand} •• ${card.last4} на ${sum} подарена ${o.gift_to}` + (friend ? ' — уже в её кабинете' : ' — появится у получателя после входа с этой почтой')
                       : `Карта ${card.brand} •• ${card.last4} выпущена, баланс ${sum}`
      if (friend) await c.query(`insert into notifications (user_id, title, body, link) values ($1, 'Вам подарили карту', $2, '/dashboard.html#cards')`, [friend.id, `Виртуальная карта •• ${card.last4} на ${sum} — в разделе «Мои карты».`])
    }
    await c.query(`insert into card_topups (card_id, order_id, amount_cents) values ($1, $2, $3) on conflict (order_id) do nothing`, [card.id, o.id, o.price_cents])
    await c.query(`update orders set status = 'done', delivered_at = now(), updated_at = now(), delivery_enc = $2 where id = $1`,
      [o.id, encrypt(text + (o.gift_to && !cardId ? '.' : '. Реквизиты — в разделе «Мои карты».'))])
    await c.query(`insert into order_events (order_id, kind, status, text) values ($1, 'delivered', 'done', $2)`, [o.id, text])
    await c.query(`insert into notifications (user_id, title, body, link) values ($1, $2, $3, '/dashboard.html#cards')`,
      [o.user_id, cardId ? 'Карта пополнена' : o.gift_to ? 'Подарок оформлен' : 'Карта выпущена', text])
    return card
  })
}

// подарки, ждавшие получателя: переходят к пользователю, когда он входит или регистрируется с этой почтой
export async function claimGiftCards(userId: string) {
  const u = await one(`select email from users where id = $1`, [userId])
  if (!u) return 0
  const rows = await q(`update cards set user_id = $1, claimed_at = now(), updated_at = now() where gift_to = $2 and claimed_at is null returning last4, balance_cents`, [userId, u.email])
  for (const c of rows) await q(`insert into notifications (user_id, title, body, link) values ($1, 'Вам подарили карту', $2, '/dashboard.html#cards')`,
    [userId, `Виртуальная карта •• ${c.last4} на $${(c.balance_cents / 100).toFixed(2).replace(/\.00$/, '')} — в разделе «Мои карты».`])
  return rows.length
}

export function giftMail(to: string, fromName: string, what: string, siteUrl: string) {
  return { to, subject: `Вам подарок от ${fromName} — Vexel`,
    text: `${fromName} дарит вам ${what}.\n\nЧтобы получить, войдите или зарегистрируйтесь на ${siteUrl || 'сайте Vexel'} с этой почтой — подарок появится в личном кабинете.\n\nVexel` }
}
