export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'kyc')
  const k = await one(`select k.*, u.email, u.name, u.created_at user_created from kyc_submissions k join users u on u.id = k.user_id where k.id::text = $1`, [getRouterParam(e, 'id')])
  if (!k) fail(404, 'not_found', 'Заявка не найдена.')
  const files = await q(`select id, mime, size_bytes, name from files where id = any($1)`, [k.file_ids])
  const history = await q(`select id, status, reason, created_at from kyc_submissions where user_id = $1 and id <> $2 order by created_at desc`, [k.user_id, k.id])
  await audit(e, a, 'kyc.view', k.id)
  return { submission: k, files, history }
})
