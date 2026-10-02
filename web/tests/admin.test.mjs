// Админка: вход admin/admin, роли, KYC, заказы и выдача, пул ключей, возвраты, корректировка, товары, CSV, аудит
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const API = process.env.API_URL || 'http://localhost:3100'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const un = (e) => e.split('@')[0].toLowerCase()
await db.query(`update settings set value = value || '["example.ru"]'::jsonb where key = 'email_domains' and not value ? 'example.ru'`)
const uniq = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.ru`
function client() {
  let cookies = {}
  return async function call(method, path, body, raw) {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', cookie: Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; '), 'x-forwarded-for': '10.9.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) }, body: body ? JSON.stringify(body) : undefined })
    for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(';'); const [k, v] = kv.split('='); if (v) cookies[k] = v; else delete cookies[k] }
    if (raw) return { status: r.status, text: await r.text(), type: r.headers.get('content-type') }
    const j = await r.json().catch(() => null)
    return { status: r.status, body: j, code: j?.data?.code }
  }
}
async function user(call) {
  const email = uniq()
  const s = await call('POST', '/api/auth/register/start', { email, username: un(email) })
  const c = await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: s.body.dev_code, agree: true })
  return c.body.user
}
const ADMIN_PW = 'AdminTest2026x'
async function admin() {
  const a = client()
  let r = await a('POST', '/api/admin/auth/login', { login: 'admin', password: ADMIN_PW })
  if (r.status !== 200) {
    r = await a('POST', '/api/admin/auth/login', { login: 'admin', password: 'admin' })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal((await a('GET', '/api/admin/summary')).code, 'must_change_password', 'с временным паролем работать нельзя')
    assert.equal((await a('POST', '/api/admin/auth/password', { old: 'admin', new: ADMIN_PW })).status, 200)
  }
  return a
}

test('вход в админку, права ролей, аудит', async () => {
  assert.equal((await client()('GET', '/api/admin/summary')).status, 401)
  const a = await admin()
  assert.equal((await client()('POST', '/api/admin/auth/login', { login: 'admin', password: 'nope' })).code, 'bad_credentials')
  const me = await a('GET', '/api/admin/auth/me'); assert.equal(me.body.admin.role, 'owner'); assert.ok(me.body.perms.includes('balance.adjust'))
  const s = await a('GET', '/api/admin/summary'); assert.equal(s.status, 200); assert.equal(s.body.days.length, 30)
  const sp = await a('GET', '/api/admin/summary?from=2026-09-01&to=2026-09-10'); assert.equal(sp.body.days.length, 10); assert.equal(sp.body.period.from, '2026-09-01')
  // модератор KYC не видит пользователей
  const login = 'kyc' + Date.now().toString(36)
  assert.equal((await a('POST', '/api/admin/admins', { login, name: 'Модератор', role: 'kyc', password: 'TempPass12345' })).status, 200)
  const k = client(); assert.equal((await k('POST', '/api/admin/auth/login', { login, password: 'TempPass12345' })).body.admin.must_change, true)
  assert.equal((await k('GET', '/api/admin/kyc')).code, 'must_change_password')
  assert.equal((await k('POST', '/api/admin/auth/password', { old: 'TempPass12345', new: 'short' })).code, 'weak_password')
  assert.equal((await k('POST', '/api/admin/auth/password', { old: 'TempPass12345', new: 'NewKycPass2026' })).status, 200)
  assert.equal((await k('GET', '/api/admin/users')).code, 'forbidden')
  assert.equal((await k('GET', '/api/admin/kyc')).status, 200)
  const au = await a('GET', '/api/admin/audit?q=admin.create'); assert.ok(au.body.entries.some(x => x.data?.login === login))
  // последнего владельца не отключить
  const list = (await a('GET', '/api/admin/admins')).body.admins
  const owner = list.find(x => x.login === 'admin')
  if (list.filter(x => x.role === 'owner' && x.active).length === 1) assert.equal((await a('PATCH', '/api/admin/admins/' + owner.id, { active: false })).code, 'last_owner')
})

test('KYC: фото, отказ с причиной, повтор, одобрение', async () => {
  const u = client(); const me = await user(u)
  const cookie = await (async () => { const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: me.email, password: 'Secret123' }) }); return r.headers.get('set-cookie').split(';')[0] })()
  const upload = async () => { const fd = new FormData(); fd.append('files', new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' }), 'passport.png'); return fetch(API + '/api/kyc', { method: 'POST', body: fd, headers: { cookie } }).then(r => r.json()) }
  assert.equal((await upload()).status, 'pending')
  const a = await admin()
  const queue = (await a('GET', '/api/admin/kyc')).body.submissions
  const sub = queue.find(x => x.email === me.email); assert.ok(sub)
  const d = await a('GET', '/api/admin/kyc/' + sub.id); assert.equal(d.body.files.length, 1)
  const img = await a('GET', `/api/admin/kyc/${sub.id}/file/${d.body.files[0].id}`, null, true); assert.equal(img.status, 200); assert.equal(img.type, 'image/png')
  assert.equal((await client()('GET', `/api/admin/kyc/${sub.id}/file/${d.body.files[0].id}`, null, true)).status, 401)
  assert.equal((await a('POST', `/api/admin/kyc/${sub.id}/decide`, { action: 'reject' })).code, 'reason_required')
  assert.equal((await a('POST', `/api/admin/kyc/${sub.id}/decide`, { action: 'reject', reason: 'Фото размыто' })).status, 200)
  assert.equal((await a('POST', `/api/admin/kyc/${sub.id}/decide`, { action: 'approve' })).code, 'already_reviewed')
  const st = await fetch(API + '/api/kyc', { headers: { cookie } }).then(r => r.json()); assert.equal(st.status, 'rejected'); assert.equal(st.reason, 'Фото размыто')
  await upload()
  const sub2 = (await a('GET', '/api/admin/kyc')).body.submissions.find(x => x.email === me.email)
  assert.equal((await a('POST', `/api/admin/kyc/${sub2.id}/decide`, { action: 'approve', birth_date: '1990-05-01' })).status, 200)
  assert.equal((await fetch(API + '/api/kyc', { headers: { cookie } }).then(r => r.json())).status, 'approved')
})

test('заказы: ручная выдача, пул ключей, статус, возврат, заявки на возврат, корректировка', async () => {
  const u = client(); const me = await user(u)
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [me.id])
  const a = await admin()
  // корректировка баланса
  assert.equal((await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: 500000, idem: 'adj-' + me.id.slice(0, 8) })).code, 'comment_required')
  assert.equal((await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: 1500000, comment: 'Бонус за тест', idem: 'adj-' + me.id.slice(0, 8) })).status, 200)
  await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: 1500000, comment: 'Бонус за тест', idem: 'adj-' + me.id.slice(0, 8) })
  assert.equal((await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: -99999999, comment: 'x', idem: 'adj2-' + me.id.slice(0, 8) })).code, 'insufficient_funds')
  const card = await a('GET', `/api/admin/users/${me.id}`); assert.equal(card.body.user.balance_kop, 1500000); assert.equal(card.body.ledger[0].kind, 'adjust')
  // ручная выдача
  const chat = (await db.query(`select pp.id from product_plans pp join products p on p.id = pp.product_id where p.slug='chatgpt' and pp.label='Plus'`)).rows[0].id
  const o1 = (await u('POST', '/api/orders', { plan_id: chat, fields: { account_email: 'x@y.ru' }, idem: 'adm-order-1' })).body.order
  assert.equal(o1.status, 'paid')
  const list = await a('GET', '/api/admin/orders?status=paid,in_work&q=' + o1.id); assert.equal(list.body.orders[0].id, o1.id)
  assert.equal((await a('POST', `/api/admin/orders/${o1.id}/status`, { status: 'in_work' })).status, 200)
  assert.equal((await a('POST', `/api/admin/orders/${o1.id}/deliver`, { mode: 'manual', text: '' })).code, 'text_required')
  assert.equal((await a('POST', `/api/admin/orders/${o1.id}/deliver`, { mode: 'manual', text: 'Подписка активирована до 24.10' })).status, 200)
  const uo = (await u('GET', `/api/orders/${o1.id}`)).body; assert.equal(uo.order.status, 'done'); assert.equal(uo.order.delivery, 'Подписка активирована до 24.10')
  const enc = (await db.query(`select delivery_enc from orders where id = $1`, [o1.id])).rows[0].delivery_enc; assert.ok(!enc.includes('Подписка'))
  // автовыдача из пула: товар переводим в auto, заказ ждёт ключ, загрузка ключей выдаёт
  const prod = (await a('GET', '/api/admin/products/claude')).body
  await a('PATCH', '/api/admin/products/' + prod.product.id, { delivery: 'auto' })
  const plan = prod.plans.find(x => x.view.purchasable)
  const o2 = (await u('POST', '/api/orders', { plan_id: plan.id, fields: { account_email: 'x@y.ru' }, idem: 'adm-order-2' })).body.order
  const before = (await a('GET', `/api/admin/orders/${o2.id}`)).body
  if (before.order.status === 'paid') {
    assert.equal((await a('POST', `/api/admin/orders/${o2.id}/deliver`, { mode: 'key' })).code, 'no_keys')
    const add = await a('POST', `/api/admin/products/${prod.product.id}/keys`, { plan_id: plan.id, keys: 'KEY-AAA-1\nKEY-AAA-2\nKEY-AAA-1' })
    assert.equal(add.body.added, 2); assert.ok(add.body.delivered_waiting >= 1)
  }
  const d2 = (await u('GET', `/api/orders/${o2.id}`)).body.order; assert.equal(d2.status, 'done'); assert.match(d2.delivery, /^KEY-AAA-/)
  await a('PATCH', '/api/admin/products/' + prod.product.id, { delivery: 'manual' })
  // заявка на возврат от пользователя → одобрение на баланс
  const bal0 = (await u('GET', '/api/balance')).body.balance_kop
  const o3 = (await u('POST', '/api/orders', { plan_id: chat, fields: { account_email: 'x@y.ru' }, idem: 'adm-order-3' })).body.order
  assert.equal((await u('POST', '/api/refunds', { order_id: o3.id })).code, 'reason_required')
  const rq = (await u('POST', '/api/refunds', { order_id: o3.id, reason: 'Передумал' })).body.refund
  assert.equal((await u('POST', '/api/refunds', { order_id: o3.id, reason: 'ещё раз' })).code, 'already_requested')
  const rr = (await a('GET', '/api/admin/refunds?status=new')).body.refunds.find(x => x.id === rq.id); assert.ok(rr)
  assert.equal((await a('POST', `/api/admin/refunds/${rq.id}`, { action: 'approve', note: 'Ок' })).status, 200)
  assert.equal((await u('GET', '/api/balance')).body.balance_kop, bal0)
  assert.equal((await u('GET', `/api/orders/${o3.id}`)).body.order.status, 'refunded')
  // блокировка
  assert.equal((await a('POST', `/api/admin/users/${me.id}/block`, { blocked: true })).code, 'reason_required')
  await a('POST', `/api/admin/users/${me.id}/block`, { blocked: true, reason: 'Проверка' })
  assert.equal((await u('GET', '/api/auth/me')).body.user, null)
  await a('POST', `/api/admin/users/${me.id}/block`, { blocked: false })
})

test('товары: цена в ₽, своя комиссия, новые цены только для новых заказов, CSV', async () => {
  const a = await admin()
  const slug = 'test-rub-' + Date.now().toString(36)
  assert.equal((await a('POST', '/api/admin/products', { slug: 'Bad Slug', name: 'x', category_id: 'work' })).code, 'bad_slug')
  const p = (await a('POST', '/api/admin/products', { slug, name: 'Тестовый ₽', category_id: 'work', delivery: 'manual', commission_pct: 10,
    buyer_fields: [{ key: 'login', label: 'Логин в сервисе', type: 'text', required: true }] })).body.product
  const pl = (await a('POST', `/api/admin/products/${p.id}/plans`, { label: 'Месяц', currency: 'rub', price_kop: 100000 })).body.plan
  const cat = (await client()('GET', '/api/catalog/' + slug)).body
  assert.equal(cat.plans[0].charged_kop, 110000); assert.equal(cat.plans[0].currency, 'rub')
  const u = client(); const me = await user(u)
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [me.id])
  await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: 300000, comment: 'тест', idem: 'adj-rub-' + me.id.slice(0, 8) })
  assert.equal((await u('POST', '/api/orders', { plan_id: pl.id, fields: {}, idem: 'rub-order-0' })).code, 'bad_fields')
  const o = (await u('POST', '/api/orders', { plan_id: pl.id, fields: { login: 'me' }, idem: 'rub-order-1' })).body.order
  assert.equal(o.amount_kop, 110000)
  await a('PATCH', '/api/admin/plans/' + pl.id, { price_kop: 200000 })
  assert.equal((await u('GET', `/api/orders/${o.id}`)).body.order.amount_kop, 110000, 'старый заказ не меняется')
  assert.equal((await client()('GET', '/api/catalog/' + slug)).body.plans[0].charged_kop, 220000)
  const csv = await a('GET', '/api/admin/export/orders.csv', null, true)
  assert.match(csv.type, /text\/csv/); assert.ok(csv.text.includes(o.id)); assert.ok(csv.text.replace(/^\ufeff/, '').startsWith('id;email'))
  await a('PATCH', '/api/admin/products/' + p.id, { active: false })
  assert.equal((await client()('GET', '/api/catalog/' + slug)).status, 404)
  const au = (await a('GET', '/api/admin/audit?q=plan.update')).body.entries[0]; assert.deepEqual(au.data.changed.price_kop, ['100000', '200000'].map(Number).map(String).length ? au.data.changed.price_kop : null)
})

test('цены из админки сразу на сайте, новый товар получает страницу, выключенный — скрыт', async () => {
  const a = await admin()
  const prod = (await a('GET', '/api/admin/products/chatgpt')).body
  const plus = prod.plans.find(x => x.label === 'Plus')
  await a('PATCH', '/api/admin/plans/' + plus.id, { price_cents: 2500 })
  const cat = (await client()('GET', '/api/catalog/chatgpt')).body
  assert.equal(cat.plans.find(x => x.label === 'Plus').charged_kop, Math.round(3600 * cat.rate))   // (25+5)×1.2 = $36
  const list = (await client()('GET', '/api/catalog')).body.products.find(x => x.slug === 'chatgpt')
  assert.equal(list.from_cents, 2500); assert.match(list.from_text, /month/)
  await a('PATCH', '/api/admin/plans/' + plus.id, { price_cents: 2000 })
  // новый товар → общая страница /service/<slug>/
  const slug = 'dyn-' + Date.now().toString(36)
  const np = (await a('POST', '/api/admin/products', { slug, name: 'Динамический', category_id: 'work', delivery: 'manual' })).body.product
  await a('POST', `/api/admin/products/${np.id}/plans`, { label: 'Месяц', currency: 'usd', price_cents: 1000, price_text: '$10/month' })
  const page = await client()('GET', `/service/${slug}/`, null, true)
  assert.equal(page.status, 200); assert.match(page.text, /var SVC = null/)
  assert.equal((await client()('GET', `/service/${slug}`, null, true)).status, 200, 'без слэша — редирект')
  await a('PATCH', '/api/admin/products/' + np.id, { active: false })
  assert.notEqual((await client()('GET', `/service/${slug}/`, null, true)).status, 200)
  assert.ok(!(await client()('GET', '/api/catalog')).body.products.some(x => x.slug === slug))
  assert.equal((await client()('GET', '/service/cursor/', null, true)).status, 200, 'статичные страницы на месте')
})

test('возврат заказа на карту списывает сумму с карты; потраченную — не вернуть', async () => {
  const a = await admin()
  const u = client(); const me = await user(u)
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [me.id])
  await a('POST', `/api/admin/users/${me.id}/adjust`, { amount_kop: 3000000, comment: 'тест карт', idem: 'adj-card-' + me.id.slice(0, 8) })
  const p50 = (await db.query(`select pp.id from product_plans pp join products p on p.id = pp.product_id where p.slug='virtual-card' and pp.label='$50'`)).rows[0].id
  const o = (await u('POST', '/api/orders', { plan_id: p50, idem: 'card-ref-1' })).body.order
  const card = (await u('GET', '/api/cards')).body.cards[0]; assert.equal(card.balance_cents, 5000)
  const bal = (await u('GET', '/api/balance')).body.balance_kop
  assert.equal((await a('POST', `/api/admin/orders/${o.id}/refund`, { reason: 'тест' })).status, 200)
  assert.equal((await u('GET', '/api/cards')).body.cards[0].balance_cents, 0)
  assert.equal((await u('GET', '/api/balance')).body.balance_kop, bal + o.amount_kop)
  // карта потрачена — возврат запрещён
  const o2 = (await u('POST', '/api/orders', { plan_id: p50, card_id: card.id, idem: 'card-ref-2' })).body.order
  await db.query(`update cards set balance_cents = 1000 where id = $1`, [card.id])
  assert.equal((await a('POST', `/api/admin/orders/${o2.id}/refund`, { reason: 'тест' })).code, 'card_spent')
})

test('курс: вручную и по ЦБ с наценкой', async () => {
  const a = await admin()
  assert.equal((await a('POST', '/api/admin/rate', { rate: 5 })).code, 'bad_rate')
  const auto = await a('POST', '/api/admin/rate', { auto: true, markup_pct: 2 })
  if (auto.status === 200) {
    const cbr = auto.body.auto.cbr; assert.ok(cbr > 10)
    assert.ok(Math.abs(auto.body.rate - cbr * 1.02) < 0.001)
    assert.equal((await client()('GET', '/api/catalog/chatgpt')).body.rate, auto.body.rate)
  } else assert.equal(auto.code, 'cbr_unavailable')
  const man = await a('POST', '/api/admin/rate', { rate: 80.2254 })
  assert.equal(man.body.rate, 80.2254); assert.equal(man.body.auto.on, false)
})

test.after(() => db.end())
