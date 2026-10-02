// обнулить период лимита досрочно (например, по обращению клиента)
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'balance.adjust')
  const u = await one(`update users set limit_since = null where id::text = $1 returning id, email`, [getRouterParam(e, 'id')])
  if (!u) fail(404, 'not_found', 'Пользователь не найден.')
  await audit(e, a, 'limit.reset', u.id, { email: u.email })
  return { limit: await spendState(u.id) }
})
