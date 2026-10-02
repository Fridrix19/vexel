export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const rows = await q(`select * from cards where user_id = $1 and status <> 'closed' order by created_at`, [u.id])
  return { cards: rows.map(cardView) }
})
