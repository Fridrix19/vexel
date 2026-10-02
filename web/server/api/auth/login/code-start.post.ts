// вход без пароля: код на почту аккаунта (по логину или почте)
export default defineEventHandler(async (e) => {
  const b = await readBody(e)
  const u = await findAccount(b?.login ?? b?.email)
  if (!u) fail(404, 'not_registered', 'Аккаунт не найден. Проверьте логин или почту — или зарегистрируйтесь.')
  return { ...(await issueCode(e, u.email, 'login')), to: maskEmail(u.email) }
})
