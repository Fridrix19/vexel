// тестовое письмо: показывает, уходит ли почта на самом деле и что ответил провайдер
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'settings')
  const to = normEmail((await readBody(e))?.to)
  const r: any = await sendMail({ to, subject: 'Проверка почты Vexel', text: 'Если вы читаете это письмо — почта сайта работает.\n\nVexel' })
  await audit(e, a, 'settings.mail_test', null, { to, ok: r.ok, provider: r.provider })
  if (r.provider === 'log') fail(409, 'mail_log_mode', 'Почта в режиме log — письма не уходят, а пишутся в журнал сервера. В Render поставьте NUXT_MAIL_PROVIDER=unisender и ключ NUXT_UNISENDER_KEY.')
  if (!r.ok) fail(502, 'mail_failed', 'Unisender не принял письмо: ' + (r.error || 'ошибка') + '. Проверьте ключ, адрес отправителя (NUXT_MAIL_FROM) и подтверждение домена.')
  return { ok: true, provider: r.provider }
})
