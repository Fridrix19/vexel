// история действий пользователя по логину или почте: страницы со временем, клики, вход, заказы (и гостевые визиты до входа с того же браузера)
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'analytics')
  const qy = getQuery(e)
  const s = String(qy.login ?? '').trim().toLowerCase()
  if (!s) fail(422, 'login_required', 'Введите логин или почту.')
  const u = await one(`select id, username, email, name, kyc_status, status, created_at, last_login_at from users where ${s.includes('@') ? 'email' : 'username'} = $1`, [s])
  if (!u) fail(404, 'not_found', 'Пользователь не найден.')
  const from = dateOrNull(qy.from), to = dateOrNull(qy.to)
  const events = await q(`select e.id, e.type, e.path, e.target, e.label, e.duration_ms, e.scroll_pct, e.device, e.referrer, e.session_id, e.created_at, e.meta
      from events e
     where (e.user_id = $1 or e.anon_id in (select anon_id from user_devices where user_id = $1))
       and ($2::date is null or e.created_at >= $2::date) and ($3::date is null or e.created_at < $3::date + 1)
     order by e.created_at desc, e.id desc limit 1000`, [u.id, from, to])
  const stats = await one(`select count(distinct session_id) filter (where session_id <> 'server')::int sessions,
      count(*) filter (where type = 'view')::int views, coalesce(round(sum(duration_ms) filter (where type = 'leave') / 60000.0), 0)::int total_min,
      min(created_at) first_seen, max(created_at) last_seen
    from events where user_id = $1 or anon_id in (select anon_id from user_devices where user_id = $1)`, [u.id])
  const top = await q(`select path, count(*) filter (where type = 'view')::int views, coalesce(round(sum(duration_ms) filter (where type = 'leave') / 1000.0), 0)::int sec
    from events where (user_id = $1 or anon_id in (select anon_id from user_devices where user_id = $1)) and anon_id <> 'server'
    group by path order by sec desc limit 10`, [u.id])
  return { user: u, stats, top, events }
})
