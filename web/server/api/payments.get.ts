export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  return { payments: await q(`select id, amount_kop, provider, status, created_at, paid_at from payments where user_id = $1 order by created_at desc limit 100`, [u.id]) }
})
