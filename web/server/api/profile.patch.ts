// профиль: имя и необязательный телефон
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const name = b?.name != null ? String(b.name).trim().slice(0, 80) || null : undefined
  let phone: string | null | undefined
  if (b?.phone !== undefined) {
    const d = String(b.phone ?? '').replace(/\D/g, '')
    if (!d) phone = null
    else {
      const n = d.length === 11 && (d[0] === '8' || d[0] === '7') ? '7' + d.slice(1) : d.length === 10 ? '7' + d : d
      if (n.length < 11 || n.length > 15) fail(422, 'bad_phone', 'Проверьте номер: +7 900 000-00-00.')
      phone = '+' + n
    }
  }
  let tg: string | null | undefined
  if (b?.telegram !== undefined) {
    const t = String(b.telegram ?? '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
    if (!t) tg = null
    else if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(t)) fail(422, 'bad_telegram', 'Telegram: имя пользователя из 5–32 символов — латиница, цифры и _, например @ivan_petrov.')
    else tg = t
  }
  await q(`update users set name = coalesce($2, name), phone = case when $4 then $3 else phone end, telegram = case when $6 then $5 else telegram end where id = $1`,
    [u.id, name === undefined ? null : name, phone ?? null, phone !== undefined, tg ?? null, tg !== undefined])
  return { user: await me(e, u.id) }
})
