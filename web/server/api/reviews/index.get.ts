// отзывы: ?product=slug — только этого товара; без product — все (страница виртуальной карты)
export default defineEventHandler(async (e) => {
  const qy = getQuery(e)
  const slug = qy.product ? String(qy.product) : null
  const limit = Math.min(50, Math.max(1, Number(qy.limit) || 20)), offset = Math.max(0, Number(qy.offset) || 0)
  const where = `r.status = 'published'` + (slug ? ` and p.slug = $1` : '')
  const args = slug ? [slug] : []
  const rows = await q(`select r.id, r.rating, r.text, r.author, r.reply, r.reply_at, r.created_at, p.slug, p.name product_name, p.icon product_icon, o.plan_label
    from reviews r join products p on p.id = r.product_id join orders o on o.id = r.order_id where ${where} order by r.created_at desc limit ${limit} offset ${offset}`, args)
  const st = await one(`select count(*)::int total, coalesce(round(avg(r.rating)::numeric, 1), 0)::float avg,
      count(*) filter (where r.rating = 5)::int r5, count(*) filter (where r.rating = 4)::int r4, count(*) filter (where r.rating = 3)::int r3,
      count(*) filter (where r.rating = 2)::int r2, count(*) filter (where r.rating = 1)::int r1
    from reviews r join products p on p.id = r.product_id where ${where}`, args)
  setHeader(e, 'cache-control', 'no-store')
  return { reviews: rows, ...st }
})
