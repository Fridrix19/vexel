// убрать из избранного
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  await q(`delete from favorites f using products p where p.id = f.product_id and f.user_id = $1 and p.slug = $2`, [u.id, getRouterParam(e, 'slug')])
  return { ok: true }
})
