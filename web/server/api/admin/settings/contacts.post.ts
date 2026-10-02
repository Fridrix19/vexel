// контакты на сайте: почта поддержки, Telegram, Max
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'settings')
  const b = await readBody(e)
  const email = normEmail(b?.email)
  const handle = (v: any, what: string) => {
    const t = String(v ?? '').trim().replace(/^https?:\/\/(t\.me|max\.ru)\//i, '').replace(/^@/, '')
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(t)) fail(422, 'bad_contact', `${what}: укажите имя аккаунта, например vexel_support.`)
    return t
  }
  const v = { email, telegram: handle(b?.telegram, 'Telegram'), max: handle(b?.max, 'Max') }
  const before = (await one(`select value v from settings where key = 'contacts'`))?.v
  await q(`insert into settings (key, value) values ('contacts', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)])
  await audit(e, a, 'settings.contacts', null, { before, after: v })
  return { contacts: v }
})
