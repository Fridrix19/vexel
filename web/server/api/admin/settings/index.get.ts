// настройки сервиса: домены почты, контакты сайта, документы, состояние почты
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'settings')
  const cfg = useRuntimeConfig()
  const d = await one<{ v: string[] }>(`select value v from settings where key = 'email_domains'`)
  const c = await one(`select value v from settings where key = 'contacts'`)
  const docs = await q(`select d.id, d.kind, d.version, d.title, d.url, d.file_id, d.note, d.published_at, a.name published_by_name,
      (select count(*)::int from user_consents uc where uc.document_id = d.id) accepted
    from documents d left join admins a on a.id = d.published_by order by d.kind, d.published_at desc`)
  const cur = new Set((await currentDocuments()).map(x => x.id))
  return {
    email_domains: d?.v || [],
    contacts: c?.v || {},
    documents: docs.map(x => ({ ...x, url: docUrl(x), current: cur.has(x.id) })),
    limits: await limitSettings(),
    users_total: (await one(`select count(*)::int n from users`)).n,
    mail: {
      provider: cfg.mailProvider === 'unisender' && cfg.unisenderKey ? 'unisender' : 'log',
      configured_provider: cfg.mailProvider, has_key: !!cfg.unisenderKey, from: cfg.mailFrom,
      site_url: cfg.public.siteUrl || null, admin_notify: cfg.adminNotifyEmail || null,
      codes_on_screen: devCodesVisible(),
    },
  }
})
