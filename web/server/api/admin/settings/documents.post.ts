// новая версия документа: multipart {kind, version, title?, note?, url? | file (PDF)}. Пользователи увидят её в «Документах» и примут перед следующей покупкой.
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'settings')
  const parts = (await readMultipartFormData(e)) || []
  const field = (n: string) => { const p = parts.find(x => x.name === n && !x.filename); return p ? p.data.toString('utf8').trim() : '' }
  const kind = field('kind')
  if (!DOC_KIND[kind]) fail(422, 'bad_kind', 'Выберите документ: оферта, политика или тарифы.')
  const version = field('version')
  if (!/^[\w.\-]{1,20}$/.test(version)) fail(422, 'bad_version', 'Версия — например, 2.4.')
  if (await one(`select 1 from documents where kind = $1 and version = $2`, [kind, version])) fail(409, 'version_exists', 'Такая версия уже опубликована.')
  const title = field('title') || DOC_KIND[kind]
  const note = field('note').slice(0, 500) || null
  const file = parts.find(x => x.name === 'file' && x.filename)
  let fileId: string | null = null, url: string | null = null
  if (file) {
    if (file.type !== 'application/pdf' || file.data.subarray(0, 4).toString() !== '%PDF') fail(422, 'bad_file', 'Загрузите PDF.')
    if (file.data.length > 15 * 1024 * 1024) fail(422, 'too_big', 'PDF больше 15 МБ.')
    fileId = (await one(`insert into files (owner_admin, purpose, mime, size_bytes, name, data) values ($1, 'document', 'application/pdf', $2, $3, $4) returning id`,
      [a.id, file.data.length, String(file.filename).slice(0, 120), file.data])).id
  } else {
    url = field('url')
    if (!/^(\/[\w\-./]+|https:\/\/\S+)$/.test(url)) fail(422, 'file_required', 'Загрузите PDF или укажите ссылку.')
  }
  const d = await one(`insert into documents (kind, version, title, url, file_id, note, published_by) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [kind, version, title, url, fileId, note, a.id])
  // уведомление всем пользователям в кабинете
  await q(`insert into notifications (user_id, title, body, link) select id, $1, $2, '/dashboard.html#docs' from users where status = 'active'`,
    [`Обновлено: ${title}`, `Редакция ${version}${note ? ' — ' + note : ''}. Ознакомьтесь и примите в разделе «Документы».`])
  await audit(e, a, 'document.publish', d.id, { kind, version, title })
  return { document: { ...d, url: docUrl(d) } }
})
