// пользователи: поиск по почте / телефону / id, фильтр KYC и статуса
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'users')
  const { limit, offset, q: s } = page(e)
  const { kyc, status } = getQuery(e)
  const where = [`($1 = '' or u.email ilike '%' || $1 || '%' or u.username ilike '%' || $1 || '%' or coalesce(u.phone,'') like '%' || $1 || '%' or u.id::text = $1 or coalesce(u.name,'') ilike '%' || $1 || '%')`,
                 `($2::text is null or u.kyc_status = $2)`, `($3::text is null or u.status = $3)`].join(' and ')
  const args = [s, kyc ? String(kyc) : null, status ? String(status) : null]
  const rows = await q(`select u.id, u.email, u.username, u.name, u.phone, u.status, u.kyc_status, u.created_at, u.last_login_at, user_balance(u.id) balance_kop,
      (select count(*)::int from orders o where o.user_id = u.id) orders,
      ss.limit_kop, ss.spent_kop, ss.resets_at, user_bonus(u.id) bonus_kop
    from users u cross join lateral spend_state(u.id) ss where ${where} order by u.created_at desc limit ${limit} offset ${offset}`, args)
  const total = (await one(`select count(*)::int n from users u where ${where}`, args)).n
  return { users: rows, total }
})
