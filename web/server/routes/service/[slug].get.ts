// страница сервиса, которого нет в статике (добавлен в админке): общая страница, тарифы подтягиваются из API.
// Статичные страницы (/service/cursor/ и т.д.) отдаются раньше, сюда приходят только новые товары.
export default defineEventHandler(async (e) => {
  const slug = String(getRouterParam(e, 'slug') || '')
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return
  if (!(await one(`select 1 from products where slug = $1 and active`, [slug]))) return
  const path = (e.path || '').split('?')[0]
  if (!path.endsWith('/')) return sendRedirect(e, `/service/${slug}/`, 301)
  const html = await useStorage('assets:tpl').getItem('index.html')
  if (!html) return
  setHeader(e, 'content-type', 'text/html; charset=utf-8')
  setHeader(e, 'cache-control', 'no-store')
  return html
})
