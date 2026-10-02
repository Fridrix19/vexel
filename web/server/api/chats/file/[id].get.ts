// вложение из своего чата
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const f = await one(`select f.mime, f.name, f.data from files f join chat_messages m on m.file_id = f.id join chat_threads t on t.id = m.thread_id
                        where f.id::text = $1 and t.user_id = $2 and f.purpose = 'chat'`, [getRouterParam(e, 'id'), u.id])
  if (!f) fail(404, 'not_found', 'Файл не найден.')
  setHeader(e, 'content-type', f.mime); setHeader(e, 'cache-control', 'private, max-age=3600'); setHeader(e, 'x-content-type-options', 'nosniff')
  setHeader(e, 'content-disposition', `${f.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name || 'file')}`)
  return f.data
})
