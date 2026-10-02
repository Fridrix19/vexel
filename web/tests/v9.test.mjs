// 009: лимит без верификации, бонус за KYC, отзывы, избранное, чат
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const API = process.env.API_URL || 'http://localhost:3100'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
await db.query(`update settings set value = value || '["example.ru"]'::jsonb where key = 'email_domains' and not value ? 'example.ru'`)
await db.query(`update settings set value = '{"unverified_kop": 1500000, "verified_kop": null}' where key = 'spend_limits'`)
await db.query(`update settings set value = '{"kyc_kop": 50000}' where key = 'bonus'`)
const uniq = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.ru`
const un = (e) => e.split('@')[0].toLowerCase()
function client() {
  const cookies = {}
  return async function call(method, path, body) {
    const isForm = body instanceof FormData
    const r = await fetch(API + path, { method, headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), cookie: Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; '), 'x-forwarded-for': '10.7.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined })
    for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(';'); const [k, v] = kv.split('='); if (v) cookies[k] = v; else delete cookies[k] }
    const ct = r.headers.get('content-type') || ''
    const j = ct.includes('json') ? await r.json().catch(() => null) : null
    return { status: r.status, body: j, code: j?.data?.code, type: ct }
  }
}
async function register(call) {
  const email = uniq()
  const s = await call('POST', '/api/auth/register/start', { email, username: un(email) })
  const c = await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: s.body.dev_code, agree: true })
  return c.body.user
}
async function topup(call, rub) { const t = await call('POST', '/api/topups', { amount_kop: rub * 100 }); await call('POST', `/api/topups/${t.body.payment.id}/test`, { action: 'succeed' }) }
async function owner() {
  const a = client()
  let r = await a('POST', '/api/admin/auth/login', { login: 'admin', password: 'AdminTest2026x' })
  if (r.status !== 200) { await a('POST', '/api/admin/auth/login', { login: 'admin', password: 'admin' }); await a('POST', '/api/admin/auth/password', { old: 'admin', new: 'AdminTest2026x' }) }
  return a
}
const cardPlans = async (call) => (await call('GET', '/api/catalog/virtual-card')).body.plans
const idem = () => crypto.randomUUID()

test('лимит 15 000 ₽ без верификации: период с первой траты, сброс через месяц, верификация снимает', async () => {
  const u = client(); const me = await register(u)
  let m = (await u('GET', '/api/auth/me')).body.user
  assert.equal(m.limit.limit_kop, 1500000); assert.equal(m.limit.spent_kop, 0); assert.equal(m.limit.resets_at, null)
  await topup(u, 40000)
  const pl = await cardPlans(u), p100 = pl.find(p => p.price_cents === 10000), p50 = pl.find(p => p.price_cents === 5000)
  const o1 = await u('POST', '/api/orders', { plan_id: p100.id, idem: idem() }); assert.equal(o1.status, 200, JSON.stringify(o1.body))
  m = (await u('GET', '/api/auth/me')).body.user
  assert.equal(m.limit.spent_kop, o1.body.order.amount_kop); assert.ok(m.limit.resets_at)
  const reset = new Date(m.limit.resets_at), since = new Date(m.limit.period_start)
  assert.ok(Math.abs((reset - since) / 86400000 - 30) <= 1.1, 'обнуление через месяц')
  const over = await u('POST', '/api/orders', { plan_id: p100.id, idem: idem() })
  assert.equal(over.status, 403); assert.equal(over.code, 'limit_exceeded'); assert.equal(over.body.data.remaining_kop, 1500000 - o1.body.order.amount_kop)
  assert.match(over.body.message, /15\s000 ₽/)
  // период истёк — следующая трата открывает новый
  await db.query(`update users set limit_since = now() - interval '32 days' where id = $1`, [me.id])
  assert.equal((await u('GET', '/api/auth/me')).body.user.limit.spent_kop, 0)
  assert.equal((await u('POST', '/api/orders', { plan_id: p100.id, idem: idem() })).status, 200)
  // возврат возвращает лимит
  const a = await owner()
  const before = (await u('GET', '/api/auth/me')).body.user.limit.spent_kop
  const last = (await db.query(`select id from orders where user_id = $1 order by created_at desc limit 1`, [me.id])).rows[0].id
  assert.equal((await a('POST', `/api/admin/orders/${last}/refund`, { reason: 'тест' })).status, 200)
  assert.ok((await u('GET', '/api/auth/me')).body.user.limit.spent_kop < before)
  // список пользователей в админке — шкала лимита
  const row = (await a('GET', '/api/admin/users?q=' + me.username)).body.users[0]
  assert.equal(row.limit_kop, 1500000); assert.ok('spent_kop' in row && 'resets_at' in row)
  // верификация: лимит снят (verified_kop = null) и бонус 500 ₽ — один раз
  await db.query(`update users set kyc_status = 'pending' where id = $1`, [me.id])
  const sub = (await db.query(`insert into kyc_submissions (user_id, file_ids) values ($1, '{}') returning id`, [me.id])).rows[0].id
  assert.equal((await a('POST', `/api/admin/kyc/${sub}/decide`, { action: 'approve' })).status, 200)
  m = (await u('GET', '/api/auth/me')).body.user
  assert.equal(m.limit.limit_kop, null); assert.equal(m.bonus_kop, 50000)
  const n = (await u('GET', '/api/notifications')).body.notifications[0]; assert.match(n.body, /бонус 500/)
  const sub2 = (await db.query(`insert into kyc_submissions (user_id, file_ids) values ($1, '{}') returning id`, [me.id])).rows[0].id
  await db.query(`update users set kyc_status = 'pending' where id = $1`, [me.id])
  await a('POST', `/api/admin/kyc/${sub2}/decide`, { action: 'approve' })
  assert.equal((await u('GET', '/api/auth/me')).body.user.bonus_kop, 50000, 'бонус за верификацию — один раз')
  // бонус — скидка при оплате
  const bal = (await u('GET', '/api/balance')).body.balance_kop
  const o = (await u('POST', '/api/orders', { plan_id: p50.id, idem: idem() })).body.order
  assert.equal(o.bonus_kop, 50000); assert.equal((await u('GET', '/api/balance')).body.balance_kop, bal - o.amount_kop)
  assert.equal((await u('GET', '/api/auth/me')).body.user.bonus_kop, 0)
  const ev = (await u('GET', '/api/orders/' + o.id)).body.events[0]; assert.match(ev.text, /бонусом 500/)
  // возврат — бонус обратно
  await a('POST', `/api/admin/orders/${o.id}/refund`, { reason: 'тест' })
  assert.equal((await u('GET', '/api/auth/me')).body.user.bonus_kop, 50000)
  // отказ от бонуса и остаток сгорает
  const keep = (await u('POST', '/api/orders', { plan_id: p50.id, idem: idem(), use_bonus: false })).body.order
  assert.equal(keep.bonus_kop, 0); assert.equal((await u('GET', '/api/auth/me')).body.user.bonus_kop, 50000)
  // карточка в админке
  const card = (await a('GET', '/api/admin/users/' + me.id)).body
  assert.equal(card.user.bonus_kop, 50000); assert.ok(card.bonus.some(b => b.reason === 'kyc')); assert.equal(card.limit.limit_kop, null)
  assert.equal((await a('POST', `/api/admin/users/${me.id}/bonus`, { amount_kop: -60000, note: 'x' })).code, 'insufficient_funds')
})

test('бонус больше цены: остаток сгорает; настройки лимитов', async () => {
  const a = await owner()
  const u = client(); const me = await register(u)
  await a('POST', `/api/admin/users/${me.id}/bonus`, { amount_kop: 700000, note: 'акция' })
  await topup(u, 1000)
  const p50 = (await cardPlans(u)).find(p => p.price_cents === 5000)
  const o = (await u('POST', '/api/orders', { plan_id: p50.id, idem: idem() })).body.order
  assert.equal(o.amount_kop, 0); assert.ok(o.bonus_kop > 0)
  assert.equal((await u('GET', '/api/auth/me')).body.user.bonus_kop, 0)
  assert.equal((await u('GET', '/api/auth/me')).body.user.limit.spent_kop, 0, 'оплата бонусом не тратит лимит')
  const s = await a('POST', '/api/admin/settings/limits', { unverified_rub: '20 000', verified_rub: '', kyc_bonus_rub: 300 })
  assert.equal(s.body.unverified_kop, 2000000); assert.equal(s.body.verified_kop, null); assert.equal(s.body.kyc_bonus_kop, 30000)
  assert.equal((await client()('GET', '/api/site')).body.limits.unverified_kop, 2000000)
  await a('POST', '/api/admin/settings/limits', { unverified_rub: 15000, verified_rub: '', kyc_bonus_rub: 500 })
})

test('отзывы: только после исполнения, на странице товара и все вместе; модерация', async () => {
  const u = client(); const me = await register(u)
  await topup(u, 10000)
  const p50 = (await cardPlans(u)).find(p => p.price_cents === 5000)
  const o = (await u('POST', '/api/orders', { plan_id: p50.id, idem: idem() })).body.order
  assert.equal(o.status, 'done')
  assert.equal((await u('POST', '/api/reviews', { order_id: o.id, rating: 6, text: 'Отлично' })).code, 'bad_rating')
  const r = await u('POST', '/api/reviews', { order_id: o.id, rating: 5, text: 'Карта пришла за минуту', author: 'Иван' })
  assert.equal(r.status, 200); assert.equal(r.body.review.author, 'Иван')
  assert.equal((await u('POST', '/api/reviews', { order_id: o.id, rating: 4, text: 'Карта пришла за минуту, поправил', author: 'Иван' })).body.review.rating, 4)
  const mine = (await u('GET', '/api/orders')).body.orders.find(x => x.id === o.id); assert.equal(mine.reviewed, true)
  const vc = (await client()('GET', '/api/reviews?product=virtual-card')).body
  assert.ok(vc.reviews.some(x => x.id === r.body.review.id)); assert.ok(vc.total >= 1 && vc.avg > 0)
  assert.ok((await client()('GET', '/api/reviews')).body.reviews.some(x => x.id === r.body.review.id), 'все отзывы вместе')
  assert.ok(!(await client()('GET', '/api/reviews?product=chatgpt')).body.reviews.some(x => x.id === r.body.review.id), 'чужой товар не показывает')
  assert.equal((await client()('GET', '/api/reviews?product=zoom')).body.total >= 0, true)
  // чужой заказ и неисполненный
  const other = client(); await register(other)
  assert.equal((await other('POST', '/api/reviews', { order_id: o.id, rating: 5, text: 'Чужой' })).code, 'not_found')
  const a = await owner()
  assert.equal((await a('PATCH', '/api/admin/reviews/' + r.body.review.id, { status: 'hidden' })).status, 200)
  assert.ok(!(await client()('GET', '/api/reviews?product=virtual-card')).body.reviews.some(x => x.id === r.body.review.id))
  await a('PATCH', '/api/admin/reviews/' + r.body.review.id, { status: 'published', reply: 'Спасибо!' })
  assert.equal((await client()('GET', '/api/reviews?product=virtual-card')).body.reviews.find(x => x.id === r.body.review.id).reply, 'Спасибо!')
  assert.ok((await a('GET', '/api/admin/reviews?q=' + o.id)).body.reviews.length === 1)
})

test('избранное', async () => {
  const u = client(); await register(u)
  assert.equal((await client()('GET', '/api/favorites')).status, 401)
  assert.equal((await u('POST', '/api/favorites', { slug: 'chatgpt' })).status, 200)
  await u('POST', '/api/favorites', { slug: 'chatgpt' }); await u('POST', '/api/favorites', { slug: 'figma' })
  assert.equal((await u('POST', '/api/favorites', { slug: 'nope-x' })).code, 'not_found')
  let f = (await u('GET', '/api/favorites')).body.favorites; assert.deepEqual(f.map(x => x.slug).sort(), ['chatgpt', 'figma'])
  await u('DELETE', '/api/favorites/chatgpt')
  f = (await u('GET', '/api/favorites')).body.favorites; assert.deepEqual(f.map(x => x.slug), ['figma'])
})

test('чат: по заказу и общий, очередь в админке, ответ и уведомление, вложение', async () => {
  const u = client(); const me = await register(u)
  await topup(u, 10000)
  const p50 = (await cardPlans(u)).find(p => p.price_cents === 5000)
  const o = (await u('POST', '/api/orders', { plan_id: p50.id, idem: idem() })).body.order
  assert.equal((await u('POST', '/api/chats/send', { text: '' })).code, 'empty')
  const s1 = await u('POST', '/api/chats/send', { order_id: o.id, text: 'Где реквизиты?' }); assert.equal(s1.status, 200)
  await u('POST', '/api/chats/send', { text: 'Общий вопрос' })
  const fd = new FormData(); fd.append('order_id', o.id); fd.append('text', 'скрин'); fd.append('file', new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' }), 'screen.png')
  const s3 = await u('POST', '/api/chats/send', fd); assert.equal(s3.status, 200); assert.ok(s3.body.message.file)
  assert.equal((await u('GET', s3.body.message.file.url)).type, 'image/png')
  assert.equal((await client()('GET', s3.body.message.file.url)).status, 401)
  const bad = new FormData(); bad.append('file', new Blob(['hello'], { type: 'image/png' }), 'x.png')
  assert.equal((await u('POST', '/api/chats/send', bad)).code, 'bad_type')
  const a = await owner()
  const q = (await a('GET', '/api/admin/chats?filter=waiting&q=' + me.username)).body
  assert.equal(q.threads.length, 2); assert.ok(q.counts.waiting >= 2)
  const t = q.threads.find(x => x.order_id === o.id); assert.equal(t.unread_admin, 2)
  const d = (await a('GET', '/api/admin/chats/' + t.id)).body
  assert.equal(d.messages.length, 2); assert.equal(d.thread.order_id, o.id); assert.equal(d.other.length, 1)
  assert.equal((await a('GET', d.messages[1].file.url)).type, 'image/png')
  assert.equal((await a('POST', `/api/admin/chats/${t.id}/send`, { text: 'Реквизиты в разделе «Мои карты»' })).status, 200)
  assert.ok(!(await a('GET', '/api/admin/chats?filter=waiting&q=' + me.username)).body.threads.some(x => x.id === t.id), 'ответили — ушёл из очереди')
  const list = (await u('GET', '/api/chats')).body; assert.equal(list.unread, 1)
  const n = (await u('GET', '/api/notifications')).body.notifications[0]; assert.equal(n.link, '/dashboard.html#order:' + o.id)
  const th = (await u('GET', '/api/chats/thread?order=' + o.id)).body
  assert.equal(th.messages.length, 3); assert.equal(th.messages[2].author, 'admin'); assert.ok(th.messages[2].admin_name)
  assert.equal((await u('GET', '/api/chats')).body.unread, 0)
  assert.equal((await u('GET', '/api/chats/thread?order=' + o.id + '&after=' + th.messages[2].id)).body.messages.length, 0)
  const other = client(); await register(other)
  assert.equal((await other('GET', '/api/chats/thread?order=' + o.id)).code, 'not_found')
  const od = (await u('GET', '/api/orders/' + o.id)).body; assert.ok(od.chat)
  // оператор видит чаты, модератор KYC — нет
  const login = 'kyc' + Date.now().toString(36)
  await a('POST', '/api/admin/admins', { login, name: 'k', role: 'kyc', password: 'TempPass12345' })
  const k = client(); await k('POST', '/api/admin/auth/login', { login, password: 'TempPass12345' }); await k('POST', '/api/admin/auth/password', { old: 'TempPass12345', new: 'NewPass2026xx' })
  assert.equal((await k('GET', '/api/admin/chats')).code, 'forbidden')
  assert.ok((await a('GET', '/api/admin/summary')).body.chats_waiting >= 1)
})
