// автокурс ЦБ: при старте и раз в час (если включён в админке)
export default defineNitroPlugin(() => {
  const run = () => refreshRate().catch((e) => console.error('[rate]', e?.message))
  setTimeout(run, 5000)
  setInterval(run, 3600_000)
})
