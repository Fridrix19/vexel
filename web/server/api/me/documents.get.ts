// документы пользователя: действующие версии (принята ли и когда) и история согласий
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const current = await currentDocuments()
  const history = await q(`select d.id, d.kind, d.version, d.title, d.url, d.file_id, d.note, d.published_at, c.accepted_at
      from user_consents c join documents d on d.id = c.document_id where c.user_id = $1 order by c.accepted_at desc`, [u.id])
  const acc = new Map(history.map(h => [h.id, h.accepted_at]))
  return {
    current: current.map(d => ({ ...d, accepted_at: acc.get(d.id) || null })),
    history: history.map(h => ({ id: h.id, kind: h.kind, version: h.version, title: h.title, url: docUrl(h), note: h.note, published_at: h.published_at, accepted_at: h.accepted_at })),
  }
})
