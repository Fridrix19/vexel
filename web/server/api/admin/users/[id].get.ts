// карточка пользователя: профиль, баланс и журнал, заказы, платежи, карты, KYC, сессии
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'users')
  const id = getRouterParam(e, 'id')
  const u = await one(`select id, email, username, name, phone, telegram, status, kyc_status, kyc_reason, consent_offer, consent_news, created_at, last_login_at, failed_logins, locked_until,
                              user_balance(id) balance_kop from users where id::text = $1`, [id])
  if (!u) fail(404, 'not_found', 'Пользователь не найден.')
  const [ledger, orders, payments, cards, kyc, sessions, refunds] = await Promise.all([
    q(`select l.id, l.amount_kop, l.kind, l.balance_after, l.order_id, l.payment_id, l.comment, l.created_at, a.name admin_name
         from ledger_entries l left join admins a on a.id = l.admin_id where l.user_id = $1 order by l.id desc limit 200`, [u.id]),
    q(`select id, product_name, plan_label, amount_kop, bonus_kop, status, created_at from orders where user_id = $1 order by created_at desc limit 200`, [u.id]),
    q(`select id, amount_kop, provider, status, created_at, paid_at from payments where user_id = $1 order by created_at desc limit 100`, [u.id]),
    q(`select id, brand, last4, exp, balance_cents, status, created_at from cards where user_id = $1 order by created_at`, [u.id]),
    q(`select id, status, reason, array_length(file_ids,1) files, created_at, reviewed_at from kyc_submissions where user_id = $1 order by created_at desc`, [u.id]),
    q(`select host(ip) ip, user_agent, created_at, last_seen_at from sessions where user_id = $1 and expires_at > now() order by last_seen_at desc`, [u.id]),
    q(`select id, order_id, amount_kop, destination, status, created_at from refund_requests where user_id = $1 order by created_at desc`, [u.id]),
  ])
  const limit = await spendState(u.id)
  const bonus = await q(`select b.id, b.kind, b.reason, b.amount_kop, b.order_id, b.note, b.created_at, a.name admin_name from bonus_entries b left join admins a on a.id = b.by_admin where b.user_id = $1 order by b.id desc limit 100`, [u.id])
  return { user: { ...u, bonus_kop: await bonusBalance(u.id) }, limit, bonus, ledger, orders, payments, cards, kyc, sessions, refunds }
})
