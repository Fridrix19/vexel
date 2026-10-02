// фото документа — только админам с правом kyc, без кеширования
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'kyc')
  const f = await one(`select f.mime, f.data, f.name from files f join kyc_submissions k on f.id = any(k.file_ids)
                        where k.id::text = $1 and f.id::text = $2 and f.purpose = 'kyc'`, [getRouterParam(e, 'id'), getRouterParam(e, 'fid')])
  if (!f || !f.data) fail(404, 'not_found', 'Файл не найден.')
  setHeader(e, 'content-type', f.mime)
  setHeader(e, 'cache-control', 'no-store')
  setHeader(e, 'content-disposition', `inline; filename="${encodeURIComponent(f.name || 'file')}"`)
  return f.data
})
