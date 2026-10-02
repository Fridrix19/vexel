// курс ₽/$ для новых заказов: вручную {rate} или автоматически по ЦБ {auto: true, markup_pct}
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'products.write')
  const b = await readBody(e)
  const before = await rate()
  const s = await rateSettings()
  if (b?.auto !== undefined) {
    const markup = Number(b.markup_pct ?? s.markup_pct ?? 0)
    if (!Number.isFinite(markup) || markup < -20 || markup > 50) fail(422, 'bad_markup', 'Наценка к курсу ЦБ — от −20 до 50 %.')
    await q(`insert into settings (key, value) values ('rate_auto', $1) on conflict (key) do update set value = excluded.value`,
      [JSON.stringify({ ...s, on: b.auto === true, markup_pct: markup, updated_at: null })])
    if (b.auto === true && !(await refreshRate(true))) fail(502, 'cbr_unavailable', 'Не удалось получить курс ЦБ. Попробуйте позже или задайте курс вручную.')
  } else {
    const r = Number(b?.rate)
    if (!Number.isFinite(r) || r < 10 || r > 1000) fail(422, 'bad_rate', 'Курс — число от 10 до 1000.')
    await tx(async (db) => {
      await db.query(`select 1 from settings where key = 'rate_auto' for update`)
      await db.query(`insert into settings (key, value) values ('rate_auto', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ ...s, on: false })])
      await db.query(`insert into settings (key, value) values ('rate_rub_per_usd', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [String(Math.round(r * 10000) / 10000)])
    })
  }
  const after = await rate()
  await audit(e, a, 'rate.update', null, { before, after, auto: b?.auto ?? false, markup_pct: b?.markup_pct })
  return { rate: after, auto: await rateSettings() }
})
