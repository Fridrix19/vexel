export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'products')
  return { rate: await rate(), auto: await rateSettings() }
})
