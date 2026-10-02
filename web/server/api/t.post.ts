// сбор событий поведения (страницы, время, клики) — и гостей, и пользователей. Ответ всегда 204, чтобы не мешать сайту.
const TYPES = ['view', 'leave', 'click', 'action']
const cut = (v: any, n: number) => v == null ? null : String(v).slice(0, n)
export default defineEventHandler(async (e) => {
  setResponseStatus(e, 204)
  let b: any
  try { b = await readBody(e); if (typeof b === 'string') b = JSON.parse(b) } catch { return null }
  const anon = cut(b?.a, 64), sid = cut(b?.s, 64)
  if (!anon || !/^[\w-]{8,64}$/.test(anon) || !sid || !Array.isArray(b?.e)) return null
  const u = await currentUser(e).catch(() => null)
  const ua = getHeader(e, 'user-agent') || ''
  const device = /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : /iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop'
  const evs = b.e.slice(0, 50).filter((x: any) => TYPES.includes(x?.t) && x.t !== 'action' && typeof x.p === 'string')
  if (!evs.length) return null
  const vals: any[] = [], rows: string[] = []
  evs.forEach((x: any, i: number) => {
    const o = i * 12
    rows.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12})`)
    const d = Number.isFinite(+x.d) ? Math.max(0, Math.min(+x.d, 6 * 3600_000)) : null
    const ts = Number.isFinite(+x.ts) && Math.abs(Date.now() - +x.ts) < 86400_000 ? new Date(+x.ts) : new Date()
    vals.push(anon, sid, u?.id ?? null, x.t, cut(x.p, 300), cut(x.tg, 200), cut(x.l, 120), d, Number.isFinite(+x.sp) ? Math.max(0, Math.min(100, Math.round(+x.sp))) : null,
      x.t === 'view' ? cut(b.r, 300) : null, device, ts)
  })
  await q(`insert into events (anon_id, session_id, user_id, type, path, target, label, duration_ms, scroll_pct, referrer, device, created_at) values ${rows.join(',')}`, vals)
  if (u) {
    // браузер принадлежит этому пользователю — гостевые события до входа тоже его
    await q(`insert into user_devices (anon_id, user_id) values ($1, $2) on conflict (anon_id, user_id) do update set last_seen = now()`, [anon, u.id])
    await q(`update events set user_id = $2 where anon_id = $1 and user_id is null`, [anon, u.id])
  }
  return null
})
