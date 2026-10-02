// согласие с действующими версиями документов: {ids: [...]} или все ожидающие
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const ids = (await readBody(e))?.ids
  const pending = await pendingDocuments(u.id)
  const toAccept = Array.isArray(ids) ? pending.filter(d => ids.includes(d.id)).map(d => d.id) : pending.map(d => d.id)
  await acceptDocuments(u.id, toAccept, clientIp(e))
  if (toAccept.length) trackAction(u.id, 'docs_accept', { label: pending.filter(d => toAccept.includes(d.id)).map(d => d.title + ' ' + d.version).join(', ') })
  return { accepted: toAccept.length, pending: (await pendingDocuments(u.id)).length }
})
