// корректировка баланса: {amount_kop (со знаком), comment, idem}; комментарий обязателен
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'balance.adjust')
  const b = await readBody(e)
  const amount = Math.round(Number(b?.amount_kop))
  const comment = String(b?.comment ?? '').trim().slice(0, 300)
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000_00) fail(422, 'bad_amount', 'Сумма корректировки — ненулевая, до 10 млн ₽.')
  if (!comment) fail(422, 'comment_required', 'Комментарий обязателен.')
  const idem = String(b?.idem ?? '')
  if (!/^[\w-]{8,80}$/.test(idem)) fail(422, 'bad_idem', 'Нужен ключ идемпотентности.')
  const u = await one(`select id, email from users where id::text = $1`, [getRouterParam(e, 'id')])
  if (!u) fail(404, 'not_found', 'Пользователь не найден.')
  let row
  try { row = await one(`select * from ledger_post($1, $2, 'adjust', null, null, $3, $4, $5)`, [u.id, amount, a.id, comment, 'adjust:' + idem]) }
  catch (err: any) {
    if (err?.message === 'insufficient_funds') fail(422, 'insufficient_funds', 'Баланс не может стать отрицательным.', { balance_kop: Number(err.detail) })
    throw err
  }
  await q(`insert into notifications (user_id, title, body, link) values ($1, 'Изменение баланса', $2, '/dashboard.html#payments')`,
    [u.id, (amount > 0 ? '+' : '−') + (Math.abs(amount) / 100).toFixed(2).replace('.', ',') + ' ₽ · ' + comment])
  await audit(e, a, 'balance.adjust', u.id, { email: u.email, amount_kop: amount, comment })
  return { entry: row }
})
