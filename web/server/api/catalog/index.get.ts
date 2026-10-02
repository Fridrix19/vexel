// каталог: разделы и товары с минимальной ценой — сайт подтягивает отсюда актуальные цены, новые и скрытые товары
export default defineEventHandler(async (e) => {
  const { category } = getQuery(e)
  const r = await rate()
  const cats = await q(`select id, name, sort from categories order by sort`)
  const rows = await q(
    `select p.slug, p.name, p.category_id, p.icon, p.delivery, p.description, p.commission_pct,
            m.price_cents min_cents, m.price_text min_text, k.price_kop min_kop, k.price_text rub_text,
            (select min(pp.custom_min_cents) from product_plans pp where pp.product_id = p.id and pp.active) as min_custom
       from products p
       left join lateral (select price_cents, price_text from product_plans pp where pp.product_id = p.id and pp.active and pp.currency = 'usd' and not pp.free and pp.price_cents > 0 order by price_cents limit 1) m on true
       left join lateral (select price_kop, price_text from product_plans pp where pp.product_id = p.id and pp.active and pp.currency = 'rub' and pp.price_kop > 0 order by price_kop limit 1) k on true
      where p.active and ($1::text is null or p.category_id = $1) order by p.category_id, p.sort`,
    [category ? String(category) : null])
  setHeader(e, 'cache-control', 'no-store')
  return {
    rate: r, categories: cats,
    products: rows.map(p => {
      const from = p.min_cents ?? p.min_custom
      const t = from ? planTotal({ currency: 'usd', price_cents: from }, r, p.commission_pct) : p.min_kop ? planTotal({ currency: 'rub', price_kop: p.min_kop }, r, p.commission_pct) : null
      return { slug: p.slug, name: p.name, category: p.category_id, icon: p.icon, delivery: p.delivery, description: p.description,
               from_cents: from ?? null, from_kop: t?.charged_kop ?? null, from_text: p.min_cents ? p.min_text : p.min_kop ? p.rub_text : null,
               currency: from ? 'usd' : p.min_kop ? 'rub' : null }
    }),
  }
})
