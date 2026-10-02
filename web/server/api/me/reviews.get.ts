// мои отзывы (по заказам)
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  return { reviews: await q(`select r.id, r.order_id, r.rating, r.text, r.author, r.status, r.reply, r.created_at, p.slug from reviews r join products p on p.id = r.product_id where r.user_id = $1 order by r.created_at desc`, [u.id]) }
})
