// Интеграционные тесты API: нужен запущенный сервер (API_URL) с NUXT_DEV_CODES=true и доступ к той же базе (DATABASE_URL)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const API = process.env.API_URL || 'http://localhost:3100'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const un = (e) => e.split('@')[0].toLowerCase()
await db.query(`update settings set value = value || '["example.ru"]'::jsonb where key = 'email_domains' and not value ? 'example.ru'`)
const uniq = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.ru`

function client() {
  let cookie = ''
  return async function call(method, path, body) {
    const r = await fetch(API + path, {
      method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), 'x-forwarded-for': '10.0.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].includes('=;') ? '' : sc.split(';')[0]
    const j = await r.json().catch(() => null)
    return { status: r.status, body: j, code: j?.data?.code }
  }
}
async function register(call, email, password = 'Secret123') {
  const s = await call('POST', '/api/auth/register/start', { email, username: un(email) })
  assert.equal(s.status, 200); assert.match(s.body.dev_code, /^\d{6}$/)
  const c = await call('POST', '/api/auth/register/complete', { email, username: un(email), password, code: s.body.dev_code, agree: true })
  assert.equal(c.status, 200, JSON.stringify(c.body)); return c.body.user
}
const plan = async (slug, label) => (await db.query(`select pp.id from product_plans pp join products p on p.id = pp.product_id where p.slug = $1 and pp.label = $2`, [slug, label])).rows[0].id

test('регистрация: код → аккаунт, занятая почта, неверный код', async () => {
  const call = client(), email = uniq()
  const s = await call('POST', '/api/auth/register/start', { email, username: un(email) })
  assert.equal((await call('POST', '/api/auth/register/start', { email, username: un(email) })).code, 'resend_too_soon')
  const wrong = s.body.dev_code === '111111' ? '222222' : '111111'
  const w = await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: wrong, agree: true })
  assert.equal(w.code, 'code_wrong'); assert.equal(w.body.data.attempts_left, 4)
  assert.equal((await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: s.body.dev_code, agree: false })).code, 'offer_required')
  assert.equal((await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'short', code: s.body.dev_code, agree: true })).code, 'weak_password')
  const ok = await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: s.body.dev_code, agree: true })
  assert.equal(ok.status, 200); assert.equal(ok.body.user.email, email); assert.equal(ok.body.user.balance_kop, 0)
  assert.equal((await call('GET', '/api/auth/me')).body.user.email, email)
  assert.equal((await client()('POST', '/api/auth/register/start', { email: email.toUpperCase(), username: 'x' + un(email) })).code, 'email_taken')
  assert.equal((await client()('POST', '/api/auth/register/start', { email: uniq(), username: un(email).toUpperCase() })).code, 'username_taken')
  const h = (await db.query(`select password_hash from users where email = $1`, [email])).rows[0].password_hash
  assert.match(h, /^scrypt\$16384\$8\$1\$/)
})

test('вход: пароль, блокировка после 5 ошибок, выход', async () => {
  const email = uniq(); await register(client(), email)
  const call = client()
  assert.equal((await call('POST', '/api/auth/login', { email: 'nobody-' + email, password: 'x' })).code, 'bad_credentials')
  for (let i = 1; i <= 4; i++) {
    const r = await call('POST', '/api/auth/login', { email, password: 'Wrong1234' })
    assert.equal(r.code, 'bad_credentials'); assert.equal(r.body.data.attempts_left, 5 - i)
  }
  assert.equal((await call('POST', '/api/auth/login', { email, password: 'Wrong1234' })).code, 'locked')
  assert.equal((await call('POST', '/api/auth/login', { email, password: 'Secret123' })).code, 'locked')
  await db.query(`update users set locked_until = null where email = $1`, [email])
  const ok = await call('POST', '/api/auth/login', { email, password: 'Secret123' })
  assert.equal(ok.status, 200)
  assert.equal((await call('POST', '/api/auth/logout')).status, 200)
  assert.equal((await call('GET', '/api/auth/me')).body.user, null)
  assert.equal((await call('GET', '/api/balance')).status, 401)
})

test('вход по коду и восстановление пароля', async () => {
  const email = uniq(); await register(client(), email)
  const call = client()
  assert.equal((await call('POST', '/api/auth/login/code-start', { email: uniq() })).code, 'not_registered')
  const s = await call('POST', '/api/auth/login/code-start', { email })
  assert.equal((await call('POST', '/api/auth/login/code', { email, code: s.body.dev_code })).status, 200)
  assert.equal((await call('POST', '/api/auth/login/code', { email, code: s.body.dev_code })).code, 'code_missing')

  const other = client()
  const r = await other('POST', '/api/auth/reset/start', { login: un(email) })
  assert.equal(r.status, 200); const token = r.body.dev_link.split('#reset:')[1]; assert.ok(token)
  assert.equal((await other('POST', '/api/auth/reset/check', { ticket: token })).body.username, un(email))
  assert.equal((await other('POST', '/api/auth/reset/complete', { ticket: token, password: 'short' })).code, 'weak_password')
  const c = await other('POST', '/api/auth/reset/complete', { ticket: token, password: 'NewSecret99' })
  assert.equal(c.status, 200)
  assert.equal((await other('POST', '/api/auth/reset/complete', { ticket: token, password: 'NewSecret99' })).code, 'ticket_invalid')
  assert.equal((await call('GET', '/api/auth/me')).body.user, null, 'старые сессии завершены')
  assert.equal((await client()('POST', '/api/auth/login', { login: un(email), password: 'NewSecret99' })).status, 200)
  assert.equal((await client()('POST', '/api/auth/login', { email, password: 'NewSecret99' })).status, 200)
  const nobody = await client()('POST', '/api/auth/reset/start', { login: uniq() }); assert.equal(nobody.status, 200, 'не выдаёт, есть ли аккаунт'); assert.equal(nobody.body.dev_link, undefined)
})

test('деньги: пополнение, KYC, недостача, покупка, идемпотентность, пополнение под заказ', async () => {
  const call = client(), email = uniq(); const u = await register(call, email)
  const chat = await plan('chatgpt', 'Plus')         // $20 → (20+5)×1.2 = $30 → 2 406,76 ₽
  const card = await plan('virtual-card', 'Своя сумма')

  assert.equal((await call('POST', '/api/topups', { amount_kop: 50 })).code, 'bad_amount')
  const t = await call('POST', '/api/topups', { amount_kop: 1000_00 })
  assert.equal(t.status, 200)
  const paid = await call('POST', `/api/topups/${t.body.payment.id}/test`, { action: 'succeed' })
  assert.equal(paid.body.status, 'succeeded')
  await call('POST', `/api/topups/${t.body.payment.id}/test`, { action: 'succeed' })   // повтор вебхука
  assert.equal((await call('GET', '/api/balance')).body.balance_kop, 1000_00)
  assert.equal((await client()('POST', `/api/topups/${t.body.payment.id}/test`, {})).status, 401)

  const noKyc = await call('POST', '/api/orders', { plan_id: chat, idem: 'idem-kyc-1', fields: { account_email: 'a@b.ru' } })
  assert.equal(noKyc.code, 'insufficient_funds', 'без верификации покупки идут в пределах лимита')
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [u.id])

  assert.equal((await call('POST', '/api/orders', { plan_id: chat, idem: 'idem-f-1', fields: {} })).code, 'bad_fields')
  const short = await call('POST', '/api/orders', { plan_id: chat, idem: 'idem-s-1', fields: { account_email: 'a@b.ru' } })
  assert.equal(short.code, 'insufficient_funds'); assert.equal(short.body.data.shortfall_kop, 240676 - 100000)

  await call('POST', `/api/topups/${(await call('POST', '/api/topups', { amount_kop: 2000_00 })).body.payment.id}/test`, {})
  const o1 = await call('POST', '/api/orders', { plan_id: chat, idem: 'idem-ok-1', fields: { account_email: 'a@b.ru' } })
  const o2 = await call('POST', '/api/orders', { plan_id: chat, idem: 'idem-ok-1', fields: { account_email: 'a@b.ru' } })
  assert.equal(o1.status, 200); assert.match(o1.body.order.id, /^VX-[A-HJKMNP-Z2-9]{8}$/)
  assert.equal(o2.body.order.id, o1.body.order.id); assert.equal(o1.body.order.amount_kop, 240676)
  assert.equal((await call('GET', '/api/balance')).body.balance_kop, 3000_00 - 240676)

  assert.equal((await call('POST', '/api/orders', { plan_id: card, idem: 'idem-c-1', amount_cents: 4000 })).code, 'amount_out_of_range')
  const t2 = await call('POST', '/api/topups', { amount_kop: 15000_00, for_order: { plan_id: card, amount_cents: 12000 } })
  const r2 = await call('POST', `/api/topups/${t2.body.payment.id}/test`, {})
  assert.match(r2.body.order_id, /^VX-/)
  const d = await call('GET', `/api/orders/${r2.body.order_id}`)
  assert.equal(d.body.order.plan_label, '$120'); assert.equal(d.body.order.charged_cents, 15600)
  assert.equal(d.body.events[0].kind, 'created')
  assert.equal((await client()('GET', `/api/orders/${r2.body.order_id}`)).status, 401)
  assert.equal((await call('GET', '/api/orders')).body.orders.length, 2)
  const n = await call('GET', '/api/notifications'); assert.ok(n.body.notifications.length >= 3)
})

test('каталог', async () => {
  const c = await client()('GET', '/api/catalog?category=ai')
  assert.ok(c.body.products.length > 10); assert.ok(c.body.products.every(p => p.category === 'ai'))
  const all = await client()('GET', '/api/catalog'); assert.ok(all.body.products.length >= 105)
  const p = await client()('GET', '/api/catalog/chatgpt'); assert.equal(p.body.plans[0].charged_kop, 240676)
  assert.equal((await client()('GET', '/api/catalog/nope')).status, 404)
})

test('кабинет: профиль, сессии, смена пароля, KYC-загрузка', async () => {
  const a = client(), email = uniq(); await register(a, email)
  const b = client(); assert.equal((await b('POST', '/api/auth/login', { email, password: 'Secret123' })).status, 200)
  const pr = await a('PATCH', '/api/profile', { name: 'Алексей', phone: '8 (900) 123-45-67' })
  assert.equal(pr.body.user.name, 'Алексей'); assert.equal(pr.body.user.phone, '+79001234567')
  assert.equal((await a('PATCH', '/api/profile', { phone: '123' })).code, 'bad_phone')
  const ss = await a('GET', '/api/auth/sessions'); assert.equal(ss.body.sessions.length, 2)
  const mine = ss.body.sessions.find(x => x.current); assert.ok(mine); assert.ok(!/\//.test(mine.ip || ''))
  assert.equal((await a('DELETE', '/api/auth/sessions/' + mine.id)).code, 'current_session')
  assert.equal((await a('POST', '/api/auth/password', { old: 'nope', new: 'Another123' })).code, 'bad_password')
  assert.equal((await a('POST', '/api/auth/password', { old: 'Secret123', new: 'Another123' })).status, 200)
  assert.equal((await b('GET', '/api/auth/me')).body.user, null, 'вторая сессия завершена')
  assert.equal((await client()('POST', '/api/auth/login', { email, password: 'Another123' })).status, 200)

  const cookie = await (async () => { const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Another123' }) }); return r.headers.get('set-cookie').split(';')[0] })()
  const up = async (name, type, bytes) => { const fd = new FormData(); fd.append('files', new Blob([bytes], { type }), name); const r = await fetch(API + '/api/kyc', { method: 'POST', body: fd, headers: { cookie } }); return { status: r.status, body: await r.json() } }
  const bad = await up('x.png', 'image/png', Buffer.from('not a png')); assert.equal(bad.body.data.code, 'bad_type')
  const ok = await up('passport.png', 'image/png', Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')); assert.equal(ok.status, 200)
  assert.equal((await up('again.png', 'image/png', Buffer.from('89504e470d0a1a0a', 'hex'))).body.data.code, 'kyc_pending')
  const st = await fetch(API + '/api/kyc', { headers: { cookie } }).then(r => r.json()); assert.equal(st.status, 'pending'); assert.equal(st.last.files, 1)
  const f = await db.query(`select f.size_bytes, f.purpose from files f join users u on u.id = f.owner_user where u.email = $1`, [email])
  assert.equal(f.rows[0].purpose, 'kyc'); assert.equal(f.rows[0].size_bytes, 16)
})

test('карты: выпуск по заказу, реквизиты по коду, заморозка, пополнение', async () => {
  const call = client(), email = uniq(); const u = await register(call, email)
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [u.id])
  await call('POST', `/api/topups/${(await call('POST', '/api/topups', { amount_kop: 30000_00 })).body.payment.id}/test`, {})
  const p50 = await plan('virtual-card', '$50')
  const o = await call('POST', '/api/orders', { plan_id: p50, idem: 'card-issue-1' })
  assert.equal(o.body.order.status, 'done')
  let cards = (await call('GET', '/api/cards')).body.cards
  assert.equal(cards.length, 1); assert.equal(cards[0].balance_cents, 5000); assert.match(cards[0].last4, /^\d{4}$/); assert.match(cards[0].exp, /^\d\d\/\d\d$/)
  const id = cards[0].id
  assert.equal((await call('POST', `/api/cards/${id}/reveal`, { code: '123456' })).code, 'code_missing')
  const rc = await call('POST', `/api/cards/${id}/reveal-code`, {})
  const rv = await call('POST', `/api/cards/${id}/reveal`, { code: rc.body.dev_code })
  assert.match(rv.body.pan, /^4000 00\d\d \d{4} \d{4}$/); assert.ok(rv.body.pan.endsWith(cards[0].last4)); assert.match(rv.body.cvv, /^\d{3}$/)
  const digits = rv.body.pan.replace(/\D/g, '').split('').map(Number)
  const luhn = digits.reverse().reduce((s, d, i) => s + (i % 2 ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d), 0)
  assert.equal(luhn % 10, 0)
  assert.equal((await client()('GET', '/api/cards')).status, 401)
  const other = client(); await register(other, uniq())
  assert.equal((await other('POST', `/api/cards/${id}/reveal-code`, {})).status, 404)
  // пополнение карты
  const p75 = await plan('virtual-card', '$75')
  const t = await call('POST', '/api/orders', { plan_id: p75, card_id: id, idem: 'card-topup-1' })
  assert.equal(t.body.order.status, 'done')
  assert.equal((await call('GET', '/api/cards')).body.cards[0].balance_cents, 12500)
  assert.equal((await other('POST', '/api/orders', { plan_id: p75, card_id: id, idem: 'steal-card-1' })).code, 'card_unavailable')
  // заморозка
  assert.equal((await call('POST', `/api/cards/${id}/freeze`, { frozen: true })).body.card.status, 'frozen')
  assert.equal((await call('POST', `/api/cards/${id}/reveal-code`, {})).code, 'card_frozen')
  assert.equal((await call('POST', '/api/orders', { plan_id: p75, card_id: id, idem: 'card-topup-2' })).code, 'card_unavailable')
  await call('POST', `/api/cards/${id}/freeze`, { frozen: false })
  // пополнение карты «под заказ» при нехватке баланса
  const cu = await plan('virtual-card', 'Своя сумма')
  const bal = (await call('GET', '/api/balance')).body.balance_kop
  const tp = await call('POST', '/api/topups', { amount_kop: 50000_00, for_order: { plan_id: cu, amount_cents: 20000, fields: { card_id: id } } })
  const done = await call('POST', `/api/topups/${tp.body.payment.id}/test`, {})
  assert.match(done.body.order_id, /^VX-/)
  assert.equal((await call('GET', '/api/cards')).body.cards[0].balance_cents, 32500)
  const ord = await call('GET', `/api/orders/${done.body.order_id}`)
  assert.equal(ord.body.order.status, 'done'); assert.match(ord.body.order.delivery, /пополнена/)
  assert.ok(bal > 0)
})

test('логин и почта: вход по логину, домены, занятые логины', async () => {
  const email = uniq(); await register(client(), email)
  const c = client()
  const s = await c('POST', '/api/auth/login/code-start', { login: un(email) }); assert.match(s.body.to, /•••@example\.ru$/)
  assert.equal((await c('POST', '/api/auth/login/code', { login: un(email), code: s.body.dev_code })).status, 200)
  assert.equal((await c('GET', '/api/auth/me')).body.user.username, un(email))
  // временная почта не проходит
  assert.equal((await client()('POST', '/api/auth/register/start', { email: 'x' + Date.now() + '@mailinator.com', username: 'tmp' + Date.now().toString(36) })).code, 'email_domain')
  assert.equal((await client()('POST', '/api/auth/register/start', { email: 'x' + Date.now() + '@gmail.com', username: 'admin' })).code, 'username_reserved')
  assert.equal((await client()('POST', '/api/auth/register/start', { email: 'x' + Date.now() + '@gmail.com', username: 'a b' })).code, 'bad_username')
  assert.equal((await client()('GET', '/api/auth/username-check?u=' + un(email))).body.available, false)
  assert.equal((await client()('GET', '/api/auth/username-check?u=free' + Date.now().toString(36))).body.available, true)
})

test.after(() => db.end())
