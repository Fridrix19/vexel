export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  return { refunds: await q(`select id, order_id, payment_id, amount_kop, destination, reason, status, admin_note, created_at, decided_at
                               from refund_requests where user_id = $1 order by created_at desc limit 100`, [u.id]) }
})
