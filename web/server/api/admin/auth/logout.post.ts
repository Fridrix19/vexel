export default defineEventHandler(async (e) => {
  const t = getCookie(e, ADM_COOKIE)
  if (t) await q(`delete from admin_sessions where token_hash = $1`, [sha256(t)])
  deleteCookie(e, ADM_COOKIE, { path: '/' })
  return { ok: true }
})
