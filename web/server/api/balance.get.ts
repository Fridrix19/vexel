// баланс и журнал операций
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const { before, limit } = getQuery(e)
  const lim = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const rows = await q(
    `select id, amount_kop, kind, balance_after, order_id, payment_id, comment, created_at
       from ledger_entries where user_id = $1 and ($2::bigint is null or id < $2) order by id desc limit $3`,
    [u.id, before ? Number(before) : null, lim])
  const b = await one<{ b: number }>(`select user_balance($1) as b`, [u.id])
  return { balance_kop: b?.b ?? 0, entries: rows, next: rows.length === lim ? rows[rows.length - 1].id : null }
})
