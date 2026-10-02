export async function rate(): Promise<number> {
  const r = await one<{ v: number }>(`select value::text::numeric as v from settings where key = 'rate_rub_per_usd'`)
  return r?.v ?? 0
}
// та же формула, что charged_cents() в SQL и computeChargedUsd в исходнике
export function chargedJs(cents: number) {
  const u = (cents || 2000) / 100
  return Math.round((u <= 45 ? (u + 5) * 1.2 : u * 1.3) * 100)
}
// итог тарифа ровно как в place_order: валюта тарифа и своя комиссия товара
export function planTotal(p: any, rateRub: number, pct: number | null, amountCents?: number) {
  if (p.currency === 'rub') {
    if (!p.price_kop) return null
    const kop = Math.round(p.price_kop * (1 + (pct ?? 0) / 100))
    return { charged_cents: Math.round(kop / rateRub), charged_kop: kop }
  }
  const cents = amountCents ?? p.price_cents
  if (!cents) return null
  const c = pct == null ? chargedJs(cents) : Math.round(cents * (1 + pct / 100))
  return { charged_cents: c, charged_kop: Math.round(c * rateRub) }
}
export function planView(p: any, rateRub: number, pct: number | null = null) {
  const custom = p.custom_min_cents != null
  const purchasable = custom || (p.currency === 'rub' ? !!p.price_kop : (!p.free && p.price_cents > 0))
  const t = purchasable && !custom ? planTotal(p, rateRub, pct) : null
  return {
    id: p.id, label: p.label, price_text: p.price_text, description: p.description,
    currency: p.currency || 'usd', price_cents: p.price_cents, price_kop: p.price_kop ?? null, free: p.free, purchasable,
    custom: custom ? { min_cents: p.custom_min_cents, max_cents: p.custom_max_cents } : null,
    charged_cents: t?.charged_cents ?? null, charged_kop: t?.charged_kop ?? null,
  }
}
