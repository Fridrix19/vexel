// CSV: users, orders, payments, ledger; ?from=YYYY-MM-DD&to=YYYY-MM-DD
const SQL: Record<string, [string, string[]]> = {
  users: [`select id, username, email, name, phone, status, kyc_status, created_at, last_login_at, user_balance(id) balance_kop from users where created_at between $1 and $2 order by created_at`,
          ['id','username','email','name','phone','status','kyc_status','created_at','last_login_at','balance_kop']],
  orders: [`select o.id, u.email, o.product_name, o.plan_label, o.currency, o.price_cents, o.charged_cents, o.rate, o.amount_kop, o.status, o.created_at, o.delivered_at
              from orders o join users u on u.id = o.user_id where o.created_at between $1 and $2 order by o.created_at`,
           ['id','email','product_name','plan_label','currency','price_cents','charged_cents','rate','amount_kop','status','created_at','delivered_at']],
  payments: [`select p.id, u.email, p.amount_kop, p.provider, p.provider_id, p.status, p.created_at, p.paid_at from payments p join users u on u.id = p.user_id
               where p.created_at between $1 and $2 order by p.created_at`, ['id','email','amount_kop','provider','provider_id','status','created_at','paid_at']],
  ledger: [`select l.id, u.email, l.kind, l.amount_kop, l.balance_after, l.order_id, l.payment_id, l.comment, a.login admin, l.created_at
              from ledger_entries l join users u on u.id = l.user_id left join admins a on a.id = l.admin_id where l.created_at between $1 and $2 order by l.id`,
           ['id','email','kind','amount_kop','balance_after','order_id','payment_id','comment','admin','created_at']],
}
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'export')
  const kind = String(getRouterParam(e, 'kind')).replace(/\.csv$/, '')
  const def = SQL[kind]
  if (!def) fail(404, 'not_found', 'Нет такой выгрузки.')
  const { from, to } = getQuery(e)
  const f = /^\d{4}-\d{2}-\d{2}$/.test(String(from)) ? String(from) : '2000-01-01'
  const t = /^\d{4}-\d{2}-\d{2}$/.test(String(to)) ? String(to) + ' 23:59:59.999' : '2100-01-01'
  const rows = await q(def[0], [f, t])
  await audit(e, a, 'export.' + kind, null, { from: f, to: t, rows: rows.length })
  return csv(e, `vexel-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, rows, def[1])
})
