export const DOC_KIND: Record<string, string> = { offer: 'Публичная оферта', privacy: 'Политика обработки персональных данных', tariffs: 'Тарифы и комиссии' }
const docUrl = (d: any) => d.file_id ? `/api/documents/file/${d.id}` : d.url

// действующие версии: последняя опубликованная каждого вида
export async function currentDocuments() {
  const rows = await q(`select distinct on (kind) id, kind, version, title, url, file_id, note, published_at from documents
                         where published_at <= now() order by kind, published_at desc`)
  return rows.map(d => ({ id: d.id, kind: d.kind, version: d.version, title: d.title, url: docUrl(d), note: d.note, published_at: d.published_at }))
}
// какие действующие документы пользователь ещё не принял
export async function pendingDocuments(userId: string) {
  const cur = await currentDocuments()
  const acc = await q(`select document_id from user_consents where user_id = $1 and document_id = any($2)`, [userId, cur.map(d => d.id)])
  const ok = new Set(acc.map(a => a.document_id))
  return cur.filter(d => !ok.has(d.id))
}
export async function acceptDocuments(userId: string, ids: string[], ip: string | null) {
  if (!ids.length) return
  await q(`insert into user_consents (user_id, document_id, ip) select $1, unnest($2::uuid[]), $3 on conflict do nothing`, [userId, ids, ip])
}
export { docUrl }
