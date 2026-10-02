// добавить в избранное {slug}
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const p = await one(`select id from products where slug = $1`, [String((await readBody(e))?.slug ?? '')])
  if (!p) fail(404, 'not_found', 'Товар не найден.')
  await q(`insert into favorites (user_id, product_id) values ($1, $2) on conflict do nothing`, [u.id, p.id])
  return { ok: true }
})
