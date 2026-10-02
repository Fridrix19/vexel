// новый пароль: все прежние сессии завершаются, эта — новая
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const password = checkPassword(b?.password)
  const t = await one<{ email: string }>(
    `delete from signup_tickets where token_hash = $1 and purpose = 'reset' returning email, expires_at > now() as fresh`, [sha256(String(b?.ticket ?? ''))]) as any
  if (!t || !t.fresh) fail(400, 'ticket_invalid', 'Ссылка устарела или уже использована. Запросите новую.')
  const hash = await hashPassword(password)
  const u = await one<{ id: string }>(`update users set password_hash = $2, failed_logins = 0, locked_until = null where email = $1 returning id`, [t.email, hash])
  if (!u) fail(404, 'not_registered', 'Аккаунт не найден.')
  await q(`delete from sessions where user_id = $1`, [u.id])
  await q(`delete from signup_tickets where email = $1 and purpose = 'reset'`, [t.email])
  await notifyUser(u.id, 'Пароль изменён', 'Пароль к аккаунту Vexel только что изменён, все прежние сессии завершены. Если это были не вы — сразу напишите в поддержку.', '/dashboard.html#profile:security')
  await startSession(e, u.id)
  return { ok: true, user: await me(e, u.id) }
})
