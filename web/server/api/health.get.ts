export default defineEventHandler(async () => {
  const r = await one<{ v: string }>(`select max(version) as v from schema_migrations`)
  return { ok: true, schema: r?.v ?? null, time: new Date().toISOString() }
})
