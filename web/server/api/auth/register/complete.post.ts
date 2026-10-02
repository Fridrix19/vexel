// шаг 2: код верный → создаём аккаунт с логином и паролем и сессию
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const email = normEmail(b?.email)
  const username = normUsername(b?.username)
  const password = checkPassword(b?.password)
  const code = checkCode(b?.code)
  if (b?.agree !== true) fail(422, 'offer_required', 'Без согласия с офертой создать аккаунт нельзя.')
  await checkEmailDomain(email)
  if (await one(`select 1 from users where email = $1`, [email]))
    fail(409, 'email_taken', 'Аккаунт с этой почтой уже есть. Войдите или восстановите пароль.')
  if (await one(`select 1 from users where username = $1`, [username]))
    fail(409, 'username_taken', 'Этот логин заняли, пока вы вводили код. Выберите другой.')
  await consumeCode(email, 'register', code)
  const offer = (await one<{ v: string }>(`select value #>> '{}' as v from settings where key = 'offer_version'`))?.v ?? null
  const hash = await hashPassword(password)
  const user = await one<{ id: string }>(
    `insert into users (email, username, password_hash, consent_offer, consent_news) values ($1, $2, $3, $4, $5)
     on conflict do nothing returning id`, [email, username, hash, offer, b?.news === true])
  if (!user) fail(409, 'email_taken', 'Аккаунт уже зарегистрирован. Войдите или восстановите пароль.')
  await q(`insert into notifications (user_id, title, body, link) values ($1, 'Добро пожаловать в Vexel', 'Пройдите верификацию, чтобы открыть покупки.', '/dashboard.html#kyc')`, [user.id])
  await acceptDocuments(user.id, (await currentDocuments()).map(d => d.id), clientIp(e))
  trackAction(user.id, 'register', { label: username }, '/login.html')
  await startSession(e, user.id)
  return { ok: true, user: await me(e, user.id) }
})
