// публичные настройки сайта: контакты и действующие документы
export default defineEventHandler(async (e) => {
  setHeader(e, 'cache-control', 'no-store')
  const c = await one(`select value v from settings where key = 'contacts'`)
  const l = await limitSettings()
  const pub = useRuntimeConfig().public as any
  return { beta: !!pub.beta, upload_max: Number(pub.uploadMax) || null, contacts: c?.v || {}, documents: await currentDocuments(), limits: { unverified_kop: l.unverified_kop, verified_kop: l.verified_kop, kyc_bonus_kop: l.kyc_bonus_kop } }
})
