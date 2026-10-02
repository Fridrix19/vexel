export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const last = await one(`select id, status, reason, array_length(file_ids, 1) as files, created_at, reviewed_at from kyc_submissions where user_id = $1 order by created_at desc limit 1`, [u.id])
  return { status: u.kyc_status, reason: u.kyc_reason, last }
})
