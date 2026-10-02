export default defineEventHandler(async (e) => ({ user: await me(e) }))
