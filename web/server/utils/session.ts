import type { H3Event } from 'h3'

export const COOKIE = 'mc_sid'
const DAYS = 30

export type SessionUser = {
  id: string; email: string; name: string | null; phone: string | null
  status: string; kyc_status: string; kyc_reason: string | null; created_at: string; session_id: string
}

export async function startSession(e: H3Event, userId: string) {
  const token = newToken()
  const ua = (getHeader(e, 'user-agent') || '').slice(0, 300)
  await q(`insert into sessions (user_id, token_hash, ip, user_agent, expires_at) values ($1, $2, $3, $4, now() + interval '${DAYS} days')`,
    [userId, sha256(token), clientIp(e), ua])
  await q(`update users set last_login_at = now(), failed_logins = 0, locked_until = null where id = $1`, [userId])
  await claimGiftCards(userId).catch(() => 0)
  const cfg = useRuntimeConfig()
  setCookie(e, COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: DAYS * 86400,
    secure: cfg.cookieSecure === true || String(cfg.cookieSecure) === 'true',
  })
}

export async function currentUser(e: H3Event): Promise<SessionUser | null> {
  if (e.context.user !== undefined) return e.context.user
  const token = getCookie(e, COOKIE)
  let u: SessionUser | null = null
  if (token) {
    u = await one<SessionUser>(
      `update sessions s set last_seen_at = now() from users u
        where s.token_hash = $1 and s.expires_at > now() and u.id = s.user_id
        returning u.id, u.email, u.name, u.phone, u.status, u.kyc_status, u.kyc_reason, u.created_at, s.id as session_id`, [sha256(token)])
  }
  e.context.user = u
  return u
}

export async function requireUser(e: H3Event) {
  const u = await currentUser(e)
  if (!u) fail(401, 'unauthorized', 'Войдите в аккаунт.')
  if (u.status === 'blocked') fail(403, 'user_blocked', 'Аккаунт заблокирован. Напишите в поддержку.')
  return u
}

export async function endSession(e: H3Event) {
  const token = getCookie(e, COOKIE)
  if (token) await q(`delete from sessions where token_hash = $1`, [sha256(token)])
  deleteCookie(e, COOKIE, { path: '/' })
}
