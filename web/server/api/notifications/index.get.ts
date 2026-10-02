export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  return { notifications: await q(`select id, title, body, link, read_at, created_at from notifications where user_id = $1 order by id desc limit 50`, [u.id]) }
})
