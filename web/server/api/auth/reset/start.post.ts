// восстановление пароля по логину или почте: одноразовая ссылка на почту аккаунта (30 минут).
// Ответ одинаковый, есть аккаунт или нет, — чтобы нельзя было перебирать логины.
const PER_HOUR = 5
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const u = await findAccount(b?.login ?? b?.email)
  const done = { sent: true, ttl_min: 30 }
  if (!u || u.status === 'blocked') return done
  const recent = await one<{ n: number }>(`select count(*)::int n from signup_tickets where email = $1 and purpose = 'reset' and created_at > now() - interval '1 hour'`, [u.email])
  if ((recent?.n ?? 0) >= PER_HOUR) fail(429, 'too_many', 'Слишком много запросов. Попробуйте через час или напишите в поддержку.')
  const token = newToken()
  await q(`delete from signup_tickets where email = $1 and purpose = 'reset' and expires_at < now()`, [u.email])
  await q(`insert into signup_tickets (token_hash, email, purpose, expires_at) values ($1, $2, 'reset', now() + interval '30 minutes')`, [sha256(token), u.email])
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(e).origin).replace(/\/$/, '')
  const link = `${site}/login.html#reset:${token}`
  const sent = await sendMail(resetMail(u.email, u.username, link))
  if (!sent.ok) fail(502, 'mail_failed', 'Не удалось отправить письмо. Попробуйте через минуту.')
  return { ...done, to: maskEmail(u.email), ...(devCodesVisible() ? { dev_link: link } : {}) }
})
