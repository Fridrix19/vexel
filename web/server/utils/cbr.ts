// курс ЦБ: https://www.cbr.ru/scripts/XML_daily.asp (windows-1251), USD
export async function fetchCbrUsd(): Promise<{ value: number; date: string } | null> {
  try {
    const res = await fetch('https://www.cbr.ru/scripts/XML_daily.asp', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const xml = new TextDecoder('windows-1251').decode(await res.arrayBuffer())
    const m = xml.match(/<CharCode>USD<\/CharCode>\s*<Nominal>(\d+)<\/Nominal>.*?<Value>([\d,]+)<\/Value>/s)
    const d = xml.match(/Date="([\d.]+)"/)
    if (!m) return null
    return { value: Number(m[2].replace(',', '.')) / Number(m[1]), date: d?.[1] ?? '' }
  } catch { return null }
}

export async function rateSettings() {
  const r = await one<{ v: any }>(`select value v from settings where key = 'rate_auto'`)
  return { on: false, markup_pct: 0, cbr: null as number | null, cbr_date: '', updated_at: null as string | null, ...(r?.v || {}) }
}

// обновить курс, если включён автокурс (раз в 3 часа; при ошибке ЦБ курс не трогаем)
export async function refreshRate(force = false) {
  const s = await rateSettings()
  if (!s.on) return null
  if (!force && s.updated_at && Date.now() - new Date(s.updated_at).getTime() < 3 * 3600_000) return null
  const c = await fetchCbrUsd()
  if (!c) return null
  // пока ходили в ЦБ, автокурс могли выключить или задать курс вручную — проверяем под блокировкой
  return tx(async (db) => {
    const cur = (await db.query(`select value from settings where key = 'rate_auto' for update`)).rows[0]?.value || {}
    if (!cur.on) return null
    const value = Math.round(c.value * (1 + (Number(cur.markup_pct) || 0) / 100) * 10000) / 10000
    await db.query(`insert into settings (key, value) values ('rate_rub_per_usd', $1::text::jsonb) on conflict (key) do update set value = excluded.value`, [String(value)])
    await db.query(`update settings set value = $1 where key = 'rate_auto'`, [JSON.stringify({ ...cur, cbr: c.value, cbr_date: c.date, updated_at: new Date().toISOString() })])
    return value
  })
}
