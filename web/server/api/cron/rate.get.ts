// расписание Vercel (vercel.json → crons): обновить курс ЦБ, если включён автокурс
export default defineEventHandler(async (e) => {
  const s = process.env.CRON_SECRET
  if (s && getHeader(e, 'authorization') !== `Bearer ${s}`) fail(401, 'unauthorized', 'Нет доступа.')
  const v = await refreshRate(true).catch(() => null)
  return { ok: true, rate: v ?? await rate() }
})
