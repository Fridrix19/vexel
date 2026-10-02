// проверка логина при вводе
export default defineEventHandler(async (e) => {
  const raw = getQuery(e).u
  try { const u = normUsername(raw); return { available: !(await one(`select 1 from users where username = $1`, [u])), username: u } }
  catch (err: any) { return { available: false, reason: err?.message || 'Недопустимый логин' } }
})
