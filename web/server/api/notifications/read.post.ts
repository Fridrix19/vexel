// отметить прочитанными: { ids: [...] } или все
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const ids = (await readBody(e))?.ids
  if (Array.isArray(ids) && ids.length) await q(`update notifications set read_at = now() where user_id = $1 and id = any($2::bigint[]) and read_at is null`, [u.id, ids.map(Number)])
  else await q(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [u.id])
  return { ok: true }
})
