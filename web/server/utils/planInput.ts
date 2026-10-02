export function planInput(b: any) {
  const label = String(b?.label ?? '').trim()
  if (!label || label.length > 80) fail(422, 'bad_label', 'Название тарифа — от 1 до 80 символов.')
  const currency = b?.currency === 'rub' ? 'rub' : 'usd'
  const int = (x: any) => x === '' || x == null ? null : Math.round(Number(x))
  const price_cents = currency === 'usd' ? int(b?.price_cents) : null
  const price_kop = currency === 'rub' ? int(b?.price_kop) : null
  const cmin = int(b?.custom_min_cents), cmax = int(b?.custom_max_cents)
  for (const x of [price_cents, price_kop, cmin, cmax]) if (x != null && (!Number.isFinite(x) || x < 0 || x > 1_000_000_00)) fail(422, 'bad_price', 'Проверьте цену.')
  if (cmin != null && cmax != null && cmax < cmin) fail(422, 'bad_price', 'Максимум суммы меньше минимума.')
  return {
    label, currency, price_cents, price_kop, custom_min_cents: currency === 'usd' ? cmin : null, custom_max_cents: currency === 'usd' ? cmax : null,
    price_text: b?.price_text ? String(b.price_text).slice(0, 120) : null,
    description: b?.description ? String(b.description).slice(0, 1000) : null,
    free: b?.free === true, active: b?.active !== false, sort: Number.isFinite(Number(b?.sort)) ? Math.round(Number(b.sort)) : 0,
  }
}
