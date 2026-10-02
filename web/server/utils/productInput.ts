// проверка полей товара из админки
export function productInput(b: any, creating: boolean) {
  const name = String(b?.name ?? '').trim()
  if (!name || name.length > 120) fail(422, 'bad_name', 'Название — от 1 до 120 символов.')
  const slug = creating ? String(b?.slug ?? '').trim().toLowerCase() : undefined
  if (creating && !/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug!)) fail(422, 'bad_slug', 'Адрес (slug): латиница, цифры и дефис, например chatgpt-plus.')
  const delivery = String(b?.delivery ?? 'manual')
  if (!['manual', 'auto', 'card_topup'].includes(delivery)) fail(422, 'bad_delivery', 'Тип выдачи: ручная, автоматическая или карта.')
  let fields = b?.buyer_fields ?? []
  if (typeof fields === 'string') { try { fields = JSON.parse(fields) } catch { fail(422, 'bad_fields', 'Поля покупателя — неверный JSON.') } }
  if (!Array.isArray(fields) || fields.length > 10) fail(422, 'bad_fields', 'Поля покупателя — список до 10 полей.')
  fields = fields.map((f: any) => {
    const key = String(f?.key ?? '').trim(), label = String(f?.label ?? '').trim()
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(key) || !label) fail(422, 'bad_fields', 'У каждого поля нужен ключ (латиница) и подпись.')
    return { key, label, type: ['text', 'email', 'url', 'tel'].includes(f?.type) ? f.type : 'text', required: f?.required !== false, ...(f?.placeholder ? { placeholder: String(f.placeholder).slice(0, 80) } : {}) }
  })
  const pct = b?.commission_pct === '' || b?.commission_pct == null ? null : Number(b.commission_pct)
  if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 500)) fail(422, 'bad_commission', 'Комиссия — от 0 до 500 %, или пусто для формулы сайта.')
  return {
    slug, name, delivery, buyer_fields: fields, commission_pct: pct,
    category_id: String(b?.category_id ?? '').trim(),
    description: b?.description ? String(b.description).slice(0, 2000) : null,
    icon: b?.icon ? String(b.icon).slice(0, 500) : null,
    active: b?.active !== false, sort: Number.isFinite(Number(b?.sort)) ? Math.round(Number(b.sort)) : 0,
  }
}
