// избранные товары с ценой «от»
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const rows = await q(`select p.slug, p.name, p.icon, p.category_id category, p.active, f.created_at from favorites f join products p on p.id = f.product_id where f.user_id = $1 order by f.created_at desc`, [u.id])
  return { favorites: rows }
})
