// отзыв о выполненном заказе: {order_id, rating 1–5, text, author?}. Повторная отправка — правка своего отзыва
export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  const b = await readBody(e)
  const o = await one(`select id, product_id, status from orders where id = $1 and user_id = $2`, [String(b?.order_id ?? ''), u.id])
  if (!o) fail(404, 'not_found', 'Заказ не найден.')
  if (o.status !== 'done') fail(409, 'order_not_done', 'Отзыв можно оставить, когда заказ исполнен.')
  const rating = Math.round(Number(b?.rating))
  if (!(rating >= 1 && rating <= 5)) fail(422, 'bad_rating', 'Поставьте оценку от 1 до 5.')
  const text = String(b?.text ?? '').trim().replace(/\s{3,}/g, '\n\n').slice(0, 2000)
  if (text.length < 3) fail(422, 'bad_text', 'Напишите пару слов о покупке.')
  const me = await one(`select name, username from users where id = $1`, [u.id])
  const author = (String(b?.author ?? '').trim() || me.name || 'Покупатель').replace(/[<>]/g, '').slice(0, 40)
  const r = await one(`insert into reviews (user_id, order_id, product_id, rating, text, author) values ($1, $2, $3, $4, $5, $6)
      on conflict (order_id) do update set rating = excluded.rating, text = excluded.text, author = excluded.author, updated_at = now()
      returning id, rating, text, author, status, created_at, updated_at`, [u.id, o.id, o.product_id, rating, text, author])
  trackAction(u.id, 'review', { label: o.id + ' · ' + rating + '★' })
  return { review: r }
})
