export default defineEventHandler(async (e) => { await endSession(e); return { ok: true } })
