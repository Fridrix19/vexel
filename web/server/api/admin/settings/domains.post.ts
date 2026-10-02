// список разрешённых доменов почты: {domains: ["gmail.com", ...]}; пустой список — принимать любые
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'settings')
  const raw = (await readBody(e))?.domains
  const list = [...new Set((Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/)).map((x: any) => String(x).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))]
  for (const d of list) if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) fail(422, 'bad_domain', `«${d}» — не похоже на домен.`)
  if (list.length > 500) fail(422, 'too_many', 'Не больше 500 доменов.')
  const before = (await one(`select value v from settings where key = 'email_domains'`))?.v || []
  await q(`insert into settings (key, value) values ('email_domains', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(list)])
  await audit(e, a, 'settings.domains', null, { added: list.filter(x => !before.includes(x)), removed: before.filter((x: string) => !list.includes(x)) })
  return { email_domains: list }
})
