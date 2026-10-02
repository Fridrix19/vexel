// заморозка / разморозка: { frozen: true|false }
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const frozen = (await readBody(e))?.frozen === true
  const c = await one(`update cards set status = $3, updated_at = now() where id::text = $1 and user_id = $2 and status <> 'closed' returning *`,
    [getRouterParam(e, 'id'), u.id, frozen ? 'frozen' : 'active'])
  if (!c) fail(404, 'not_found', 'Карта не найдена.')
  return { card: cardView(c) }
})
