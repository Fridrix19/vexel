// вложение из чата — для админа
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'chats')
  const f = await one(`select mime, name, data from files where id::text = $1 and purpose = 'chat'`, [getRouterParam(e, 'id')])
  if (!f) fail(404, 'not_found', 'Файл не найден.')
  setHeader(e, 'content-type', f.mime); setHeader(e, 'cache-control', 'private, max-age=3600'); setHeader(e, 'x-content-type-options', 'nosniff')
  setHeader(e, 'content-disposition', `${f.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name || 'file')}`)
  return f.data
})
