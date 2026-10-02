// ссылка из письма ещё действует? (чтобы сразу сказать, если устарела)
export default defineEventHandler(async (e) => {
  const t = await one(`select s.email, u.username from signup_tickets s join users u on u.email = s.email
                        where s.token_hash = $1 and s.purpose = 'reset' and s.expires_at > now()`, [sha256(String((await readBody(e))?.ticket ?? ''))])
  if (!t) fail(400, 'ticket_invalid', 'Ссылка устарела или уже использована. Запросите новую.')
  return { ok: true, username: t.username, email: maskEmail(t.email) }
})
