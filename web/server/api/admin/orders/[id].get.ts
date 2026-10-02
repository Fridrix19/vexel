export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'orders')
  const o = await one(`select o.*, u.email, p.slug, p.delivery as delivery_type, p.buyer_fields as field_spec, a.name admin_name
                         from orders o join users u on u.id = o.user_id left join products p on p.id = o.product_id left join admins a on a.id = o.assigned_admin
                        where o.id = $1`, [getRouterParam(e, 'id')])
  if (!o) fail(404, 'not_found', 'Заказ не найден.')
  const events = await q(`select ev.kind, ev.status, ev.text, ev.created_at, a.name admin_name from order_events ev left join admins a on a.id = ev.by_admin where order_id = $1 order by ev.id`, [o.id])
  const keysFree = o.delivery_type === 'auto'
    ? (await one(`select count(*)::int n from product_keys where product_id = $1 and status = 'free' and (plan_id = $2 or plan_id is null)`, [o.product_id, o.plan_id])).n : null
  let delivery = null
  if (o.delivery_enc) { try { delivery = decrypt(o.delivery_enc) } catch { delivery = '(не удалось расшифровать)' } }
  const refunds = await q(`select id, amount_kop, destination, status, reason, created_at from refund_requests where order_id = $1 order by created_at desc`, [o.id])
  return { order: { ...o, delivery_enc: undefined, delivery }, events, keys_free: keysFree, refunds }
})
