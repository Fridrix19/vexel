// вход по логину или почте и паролю; 5 ошибок подряд — блокировка на 15 минут
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const password = String(b?.password ?? '')
  const u = await findAccount(b?.login ?? b?.email)
  if (!password) fail(422, 'bad_password', 'Введите пароль.')
  if (!u) { await verifyPassword(password, await dummyHash()); fail(401, 'bad_credentials', 'Неверный логин, почта или пароль.') }
  if (u.locked) fail(429, 'locked', `Слишком много попыток. Вход откроется через ${u.wait} мин. или восстановите пароль.`, { retry_min: u.wait })
  if (!(await verifyPassword(password, u.password_hash))) {
    const r = await one<{ n: number }>(
      `update users set failed_logins = failed_logins + 1,
              locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end
        where id = $1 returning failed_logins as n`, [u.id])
    const n = r?.n ?? 0
    if (n >= 5) { await q(`update users set failed_logins = 0 where id = $1`, [u.id]); fail(429, 'locked', 'Слишком много попыток. Вход закрыт на 15 минут — или восстановите пароль.', { retry_min: 15 }) }
    fail(401, 'bad_credentials', `Неверный логин, почта или пароль. Осталось попыток: ${5 - n}.`, { attempts_left: 5 - n })
  }
  if (u.status === 'blocked') fail(403, 'user_blocked', 'Аккаунт заблокирован. Напишите в поддержку.')
  trackAction(u.id, 'login', { label: 'пароль' }, '/login.html')
  await startSession(e, u.id)
  return { ok: true, user: await me(e, u.id) }
})
