// автокурс ЦБ: при старте и раз в час (если включён в админке). На Vercel процесс не живёт постоянно — там курс обновляет /api/cron/rate по расписанию
export default defineNitroPlugin(() => {
  if (process.env.VERCEL) return
  const run = () => refreshRate().catch((e) => console.error('[rate]', e?.message))
  setTimeout(run, 5000)
  setInterval(run, 3600_000)
})
