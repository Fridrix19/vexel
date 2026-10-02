// 008: старший админ и журнал, документы с согласиями, подарок, аналитика, контакты, Telegram
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const API = process.env.API_URL || 'http://localhost:3100'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
await db.query(`update settings set value = value || '["example.ru"]'::jsonb where key = 'email_domains' and not value ? 'example.ru'`)
const uniq = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.ru`
const un = (e) => e.split('@')[0].toLowerCase()
function client() {
  const cookies = {}
  return async function call(method, path, body, opts = {}) {
    const isForm = body instanceof FormData
    const r = await fetch(API + path, { method, headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), cookie: Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; '), 'x-forwarded-for': '10.8.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined })
    for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(';'); const [k, v] = kv.split('='); if (v) cookies[k] = v; else delete cookies[k] }
    const j = r.status === 204 ? null : await r.json().catch(() => null)
    return { status: r.status, body: j, code: j?.data?.code }
  }
}
async function register(call, email = uniq()) {
  const s = await call('POST', '/api/auth/register/start', { email, username: un(email) })
  const c = await call('POST', '/api/auth/register/complete', { email, username: un(email), password: 'Secret123', code: s.body.dev_code, agree: true })
  assert.equal(c.status, 200, JSON.stringify(c.body))
  return c.body.user
}
async function owner() {
  const a = client()
  let r = await a('POST', '/api/admin/auth/login', { login: 'admin', password: 'AdminTest2026x' })
  if (r.status !== 200) { r = await a('POST', '/api/admin/auth/login', { login: 'admin', password: 'admin' }); await a('POST', '/api/admin/auth/password', { old: 'admin', new: 'AdminTest2026x' }) }
  return a
}
async function newAdmin(a, role) {
  const login = role + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  assert.equal((await a('POST', '/api/admin/admins', { login, name: role, role, password: 'TempPass12345' })).status, 200)
  const c = client(); await c('POST', '/api/admin/auth/login', { login, password: 'TempPass12345' })
  assert.equal((await c('POST', '/api/admin/auth/password', { old: 'TempPass12345', new: 'NewPass2026xx' })).status, 200)
  return { c, login }
}
async function richUser(call) {
  const u = await register(call)
  await db.query(`update users set kyc_status = 'approved' where id = $1`, [u.id])
  const t = await call('POST', '/api/topups', { amount_kop: 50000_00 })
  await call('POST', `/api/topups/${t.body.payment.id}/test`, { action: 'succeed' })
  return u
}

test('старший админ: журнал только младших и свой, у оператора журнала нет; назначение роли с датой', async () => {
  const a = await owner()
  const sr = await newAdmin(a, 'senior'), op = await newAdmin(a, 'operator')
  const list = (await a('GET', '/api/admin/admins')).body
  const opRow = list.admins.find(x => x.login === op.login)
  assert.ok(opRow.role_set_at, 'дата назначения'); assert.ok(opRow.role_set_by_name || opRow.created_by_name)
  assert.ok(list.roles.senior.includes('audit') && !list.roles.operator.includes('audit'))
  assert.equal((await op.c('GET', '/api/admin/audit')).code, 'forbidden')
  // оператор что-то сделал (сменил пароль при входе) — старший это видит, а действия владельца — нет
  const seen = (await sr.c('GET', '/api/admin/audit?limit=200')).body.entries
  assert.ok(seen.some(x => x.login === op.login || x.name === 'operator'))
  assert.ok(!seen.some(x => x.role === 'owner'), 'действия владельца старшему не видны')
  assert.ok((await a('GET', '/api/admin/audit?limit=200')).body.entries.some(x => x.role === 'owner'))
  assert.equal((await sr.c('GET', '/api/admin/settings')).code, 'forbidden', 'настройки — только владелец')
  assert.equal((await sr.c('GET', '/api/admin/analytics')).status, 200)
  // смена роли фиксирует, кто и когда
  assert.equal((await a('PATCH', '/api/admin/admins/' + opRow.id, { role: 'kyc' })).status, 200)
  const after = (await a('GET', '/api/admin/admins')).body.admins.find(x => x.id === opRow.id)
  assert.equal(after.role, 'kyc'); assert.ok(new Date(after.role_set_at) >= new Date(opRow.role_set_at))
})

test('контакты сайта и Telegram пользователя', async () => {
  const a = await owner()
  const before = (await client()('GET', '/api/site')).body.contacts
  assert.equal((await a('POST', '/api/admin/settings/contacts', { email: 'help@vexel.ru', telegram: '@mc_help', max: 'https://max.ru/mc_help' })).status, 200)
  const site = (await client()('GET', '/api/site')).body
  assert.deepEqual(site.contacts, { email: 'help@vexel.ru', telegram: 'mc_help', max: 'mc_help' })
  assert.ok(site.documents.some(d => d.kind === 'tariffs'))
  assert.equal((await a('POST', '/api/admin/settings/contacts', { email: 'help@vexel.ru', telegram: 'a b', max: 'x' })).code, 'bad_contact')
  await a('POST', '/api/admin/settings/contacts', before)
  const u = client(); await register(u)
  assert.equal((await u('PATCH', '/api/profile', { telegram: 'https://t.me/ivan_petrov' })).body.user.telegram, 'ivan_petrov')
  assert.equal((await u('PATCH', '/api/profile', { telegram: '12' })).code, 'bad_telegram')
  assert.equal((await u('PATCH', '/api/profile', { telegram: '' })).body.user.telegram, null)
})

test('новая редакция документа: уведомление, покупка ждёт согласия, дата согласия', async () => {
  const u = client(); await richUser(u)
  const a = await owner()
  const fd = new FormData(); fd.append('kind', 'tariffs'); fd.append('version', 't' + Date.now().toString(36)); fd.append('note', 'Тест: новая комиссия'); fd.append('url', '/tariffs.html')
  const pub = await a('POST', '/api/admin/settings/documents', fd); assert.equal(pub.status, 200, JSON.stringify(pub.body))
  const me = (await u('GET', '/api/auth/me')).body.user; assert.equal(me.docs_pending.length, 1); assert.equal(me.docs_pending[0].kind, 'tariffs')
  assert.ok((await u('GET', '/api/notifications')).body.notifications.some(n => n.link === '/dashboard.html#docs'))
  const docs = (await u('GET', '/api/me/documents')).body
  const cur = docs.current.find(d => d.kind === 'tariffs'); assert.equal(cur.accepted_at, null); assert.equal(cur.note, 'Тест: новая комиссия')
  const plan = (await u('GET', '/api/catalog/virtual-card')).body.plans.find(p => !p.custom && p.purchasable)
  const o = await u('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID() })
  assert.equal(o.status, 409); assert.equal(o.code, 'docs_update_required')
  assert.equal((await u('POST', '/api/me/documents', {})).body.pending, 0)
  const after = (await u('GET', '/api/me/documents')).body
  assert.ok(after.current.find(d => d.kind === 'tariffs').accepted_at)
  assert.ok(after.history.length >= 4, 'старые согласия сохраняются')
  assert.equal((await u('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID() })).status, 200)
  const st = (await a('GET', '/api/admin/settings')).body.documents.find(d => d.id === cur.id); assert.ok(st.current); assert.ok(st.accepted >= 1)
})

test('подарок: карта ждёт друга и переходит к нему при регистрации', async () => {
  const buyer = client(); const me = await richUser(buyer)
  const plan = (await buyer('GET', '/api/catalog/virtual-card')).body.plans.find(p => !p.custom && p.purchasable)
  assert.equal((await buyer('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID(), gift_to: me.email })).code, 'gift_self')
  const friend = uniq()
  const o = await buyer('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID(), gift_to: friend.toUpperCase() })
  assert.equal(o.status, 200, JSON.stringify(o.body)); assert.equal(o.body.order.status, 'done')
  let mine = (await buyer('GET', '/api/cards')).body.cards.find(c => c.gift_to === friend)
  assert.ok(mine, 'пока друг не вошёл — карта у покупателя с пометкой')
  assert.equal((await buyer('POST', `/api/cards/${mine.id}/reveal-code`, {})).code, 'gift_pending')
  assert.equal((await buyer('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID(), card_id: mine.id })).code, 'card_unavailable')
  const f = client(); await register(f, friend)
  const got = (await f('GET', '/api/cards')).body.cards
  assert.equal(got.length, 1); assert.equal(got[0].gift, true); assert.equal(got[0].gift_to, null)
  assert.ok(!(await buyer('GET', '/api/cards')).body.cards.some(c => c.id === got[0].id))
  // уже зарегистрированному другу — сразу
  const f2 = client(); const u2 = await register(f2)
  assert.equal((await buyer('POST', '/api/orders', { plan_id: plan.id, idem: crypto.randomUUID(), gift_to: u2.email })).status, 200)
  assert.equal((await f2('GET', '/api/cards')).body.cards.length, 1)
})

test('аналитика: гость → вход, время на странице, клики, история пользователя', async () => {
  const anon = 'test' + Date.now().toString(36), s = 's' + Date.now().toString(36)
  const g = client()
  const ev = (arr) => g('POST', '/api/t', { a: anon, s, r: 'https://yandex.ru/search', e: arr })
  assert.equal((await ev([{ t: 'view', p: '/virtual-card.html' }, { t: 'click', p: '/virtual-card.html', tg: '#pay', l: 'Оплатить 5 000 ₽' }, { t: 'leave', p: '/virtual-card.html', d: 42000, sp: 80 }])).status, 204)
  assert.equal((await g('POST', '/api/t', { a: 'bad id!', s, e: [{ t: 'view', p: '/' }] })).status, 204)
  const u = await register(g)
  await ev([{ t: 'view', p: '/dashboard.html#overview' }, { t: 'leave', p: '/dashboard.html#overview', d: 15000, sp: 30 }])
  const a = await owner()
  const today = new Date().toISOString().slice(0, 10)
  const r = (await a('GET', `/api/admin/analytics?from=${today}&to=${today}`)).body
  const vc = r.pages.find(p => p.path === '/virtual-card.html'); assert.ok(vc && vc.views >= 1 && vc.avg_sec > 0)
  assert.ok(r.clicks.some(c => c.target === '#pay')); assert.ok(r.funnel.pay_click >= 1); assert.ok(r.sources.some(x => x.source === 'yandex.ru'))
  const h = (await a('GET', '/api/admin/analytics/user?login=' + u.username)).body
  assert.ok(h.events.some(e => e.path === '/virtual-card.html' && e.type === 'view'), 'гостевые события до регистрации — в истории')
  assert.ok(h.events.some(e => e.type === 'action' && e.target === 'register'))
  assert.ok(h.stats.total_min >= 0 && h.top.some(t => t.path === '/virtual-card.html' && t.sec === 42))
  assert.equal((await a('GET', '/api/admin/analytics/user?login=nobody_' + Date.now())).code, 'not_found')
})
