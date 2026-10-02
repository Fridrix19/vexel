// сводка: очереди (сейчас) и показатели за период ?from=YYYY-MM-DD&to=YYYY-MM-DD (по умолчанию — 30 дней)
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'summary')
  const qy = getQuery(e)
  const to = dateOrNull(qy.to) || new Date().toISOString().slice(0, 10)
  let from = dateOrNull(qy.from) || new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10)
  if (from > to) from = to
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400_000) + 1
  const R = [from, to]
  const now = await one(`select
      (select count(*)::int from users) users_total,
      (select count(*)::int from kyc_submissions where status = 'pending') kyc_pending,
      (select count(*)::int from orders where status in ('paid','in_work')) orders_open,
      (select count(*)::int from orders where status = 'need_info') orders_need_info,
      (select count(*)::int from refund_requests where status = 'new') refunds_new,
      (select count(*)::int from chat_threads where last_from = 'user' and status = 'open') chats_waiting,
      (select count(*)::int from reviews where created_at > now() - interval '7 days') reviews_week,
      (select coalesce(sum(user_bonus(id)), 0) from users) bonus_total_kop,
      (select coalesce(sum(b),0) from (select distinct on (user_id) balance_after b from ledger_entries order by user_id, id desc) t) balances_kop,
      (select value::text::numeric from settings where key = 'rate_rub_per_usd') rate`)
  const per = await one(`select
      (select coalesce(sum(-amount_kop),0) from ledger_entries where kind = 'purchase' and created_at >= $1::date and created_at < $2::date + 1) sales_kop,
      (select count(*)::int from orders where created_at >= $1::date and created_at < $2::date + 1) orders,
      (select count(distinct user_id)::int from orders where created_at >= $1::date and created_at < $2::date + 1) buyers,
      (select coalesce(sum(amount_kop),0) from payments where status = 'succeeded' and paid_at >= $1::date and paid_at < $2::date + 1) topups_kop,
      (select coalesce(sum(amount_kop),0) from ledger_entries where kind = 'refund' and created_at >= $1::date and created_at < $2::date + 1) refunds_kop,
      (select count(*)::int from users where created_at >= $1::date and created_at < $2::date + 1) users_new,
      (select count(*)::int from kyc_submissions where status = 'approved' and reviewed_at >= $1::date and reviewed_at < $2::date + 1) kyc_approved,
      (select count(distinct anon_id)::int from events where type = 'view' and created_at >= $1::date and created_at < $2::date + 1) visitors`, R)
  const days = span <= 92 ? await q(`select to_char(d, 'YYYY-MM-DD') as day,
      coalesce((select sum(-amount_kop) from ledger_entries where kind = 'purchase' and created_at >= d and created_at < d + interval '1 day'), 0) sales_kop,
      coalesce((select sum(amount_kop) from payments where status = 'succeeded' and paid_at >= d and paid_at < d + interval '1 day'), 0) topups_kop
    from generate_series($1::date, $2::date, interval '1 day') d order by d`, R) : []
  const top = await q(`select product_name, count(*)::int n, sum(amount_kop) kop from orders where created_at >= $1::date and created_at < $2::date + 1 group by 1 order by 2 desc limit 8`, R)
  const lowKeys = await q(`select p.name, p.slug, count(k.*) filter (where k.status = 'free')::int free from products p left join product_keys k on k.product_id = p.id
                            where p.delivery = 'auto' and p.active group by p.id having count(k.*) filter (where k.status = 'free') < 5 order by 3`)
  return { ...now, period: { from, to, days: span, ...per }, days, top, low_keys: lowKeys }
})
