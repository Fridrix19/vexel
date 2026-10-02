// загруженный PDF документа (публичный)
export default defineEventHandler(async (e) => {
  const f = await one(`select f.mime, f.data, d.kind, d.version from documents d join files f on f.id = d.file_id where d.id::text = $1`, [getRouterParam(e, 'id')])
  if (!f?.data) fail(404, 'not_found', 'Документ не найден.')
  setHeader(e, 'content-type', f.mime)
  setHeader(e, 'content-disposition', `inline; filename="vexel-${f.kind}-${f.version}.pdf"`)
  return f.data
})
