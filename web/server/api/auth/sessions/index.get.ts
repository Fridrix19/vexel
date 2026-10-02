// устройства и сессии пользователя
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const rows = await q(`select id, host(ip) as ip, user_agent, created_at, last_seen_at from sessions where user_id = $1 and expires_at > now() order by last_seen_at desc`, [u.id])
  return { sessions: rows.map(s => ({ ...s, current: s.id === u.session_id, device: device(s.user_agent) })) }
})
function device(ua: string | null) {
  const s = ua || ''
  const os = /iPhone|iPad/.test(s) ? 'iPhone' : /Android/.test(s) ? 'Android' : /Mac OS/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'Устройство'
  const br = /Edg\//.test(s) ? 'Edge' : /YaBrowser/.test(s) ? 'Яндекс' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'браузер'
  return `${os} · ${br}`
}
