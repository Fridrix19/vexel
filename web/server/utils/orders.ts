export const ORDER_STATUS: Record<string, string> = {
  paid: 'Оплачен', in_work: 'В работе', need_info: 'Нужны данные', done: 'Выполнен', canceled: 'Отменён', refunded: 'Возврат',
}
export function orderView(o: any) {
  if (!o) return null
  return {
    id: o.id, product_name: o.product_name, plan_label: o.plan_label,
    price_cents: o.price_cents, charged_cents: o.charged_cents, rate: o.rate, amount_kop: o.amount_kop,
    buyer_fields: o.buyer_fields, status: o.status, status_text: ORDER_STATUS[o.status] ?? o.status,
    delivered: !!o.delivered_at, delivered_at: o.delivered_at, created_at: o.created_at, updated_at: o.updated_at,
    product_slug: o.product_slug, bonus_kop: Number(o.bonus_kop || 0), gift_to: o.gift_to || null, reviewed: !!o.reviewed, chat_unread: Number(o.chat_unread || 0),
  }
}
