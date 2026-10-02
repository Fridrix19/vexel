export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const code = checkCode(b?.code)
  const u = await findAccount(b?.login ?? b?.email)
  if (!u) fail(404, 'not_registered', 'Аккаунт не найден.')
  await consumeCode(u.email, 'login', code)
  if (u.status === 'blocked') fail(403, 'user_blocked', 'Аккаунт заблокирован. Напишите в поддержку.')
  trackAction(u.id, 'login', { label: 'код из письма' }, '/login.html')
  await startSession(e, u.id)
  return { ok: true, user: await me(e, u.id) }
})
