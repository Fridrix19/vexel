export default defineEventHandler(async (e) => {
  const a = await currentAdmin(e)
  if (!a) return { admin: null }
  const perms = PERMS.filter(p => can(a.role, p))
  return { admin: { id: a.id, login: a.login, name: a.name, role: a.role, must_change: a.must_change }, perms }
})
