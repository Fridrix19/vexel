// аналитика поведения за период: посетители, страницы (время, прокрутка), клики, источники, устройства, воронка
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'analytics')
  const qy = getQuery(e)
  const to = dateOrNull(qy.to) || new Date().toISOString().slice(0, 10)
  const from = dateOrNull(qy.from) || new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10)
  const page = qy.page ? String(qy.page) : null
  const R = [from, to]
  const W = `created_at >= $1::date and created_at < $2::date + 1 and anon_id <> 'server'`
  const totals = await one(`select count(distinct anon_id)::int visitors, count(distinct session_id)::int sessions,
      count(*) filter (where type = 'view')::int views, count(*) filter (where type = 'click')::int clicks,
      count(distinct user_id)::int known_users,
      coalesce(round(sum(duration_ms) filter (where type = 'leave') / 1000.0 / nullif(count(*) filter (where type = 'view'), 0)), 0)::int avg_page_sec
    from events where ${W}`, R)
  const sess = await one(`select coalesce(round(avg(t) / 1000.0), 0)::int avg_session_sec, coalesce(round(avg(v), 1), 0) views_per_session
    from (select session_id, sum(duration_ms) filter (where type = 'leave') t, count(*) filter (where type = 'view') v from events where ${W} group by session_id) s`, R)
  const pages = await q(`select path, count(*) filter (where type = 'view')::int views, count(distinct anon_id)::int visitors,
      coalesce(round(sum(duration_ms) filter (where type = 'leave') / 1000.0 / nullif(count(*) filter (where type = 'view'), 0)), 0)::int avg_sec,
      coalesce(round(sum(duration_ms) filter (where type = 'leave') / 60000.0), 0)::int total_min,
      coalesce(max(scroll_pct) filter (where type = 'leave'), 0)::int max_scroll, coalesce(round(avg(scroll_pct) filter (where type = 'leave')), 0)::int scroll,
      count(*) filter (where type = 'click')::int clicks
    from events where ${W} group by path order by views desc limit 100`, R)
  const clicks = await q(`select path, target, coalesce(label, '') label, count(*)::int n, count(distinct anon_id)::int visitors
    from events where ${W} and type = 'click' and ($3::text is null or path = $3) group by 1, 2, 3 order by n desc limit 100`, [...R, page])
  const sources = await q(`select coalesce(nullif(substring(referrer from '^https?://([^/]+)'), ''), 'прямой заход') source, count(distinct session_id)::int sessions
    from events where ${W} and type = 'view' and (referrer is null or referrer = '' or referrer not like '%' || $3 || '%') group by 1 order by 2 desc limit 15`, [...R, String(getRequestURL(e).host)])
  const devices = await q(`select device, count(distinct anon_id)::int visitors from events where ${W} group by 1 order by 2 desc`, R)
  const funnel = await one(`select
      (select count(distinct anon_id)::int from events where ${W}) visitors,
      (select count(distinct anon_id)::int from events where ${W} and type = 'view' and (path like '/service/%' or path like '/virtual-card%')) product_view,
      (select count(distinct anon_id)::int from events where ${W} and type = 'click' and target like '%pay%') pay_click,
      (select count(*)::int from users where created_at >= $1::date and created_at < $2::date + 1) registered,
      (select count(distinct user_id)::int from kyc_submissions where created_at >= $1::date and created_at < $2::date + 1) kyc,
      (select count(distinct user_id)::int from payments where status = 'succeeded' and paid_at >= $1::date and paid_at < $2::date + 1) topped_up,
      (select count(distinct user_id)::int from orders where created_at >= $1::date and created_at < $2::date + 1) bought`, R)
  return { period: { from, to }, totals: { ...totals, ...sess }, pages, clicks, sources, devices, funnel }
})
