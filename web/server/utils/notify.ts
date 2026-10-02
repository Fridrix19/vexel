// уведомление клиенту: в кабинете и письмом (письмо не мешает основному действию, если почта недоступна)
export async function notifyUser(userId: string, title: string, body: string, link: string, db: { query: Function } | null = null) {
  const run = (sql: string, args: any[]) => db ? db.query(sql, args) : q(sql, args)
  await run(`insert into notifications (user_id, title, body, link) values ($1, $2, $3, $4)`, [userId, title, body, link])
  const u = await one<{ email: string }>(`select email from users where id = $1`, [userId])
  if (u) mailLater({ to: u.email, subject: title, text: `${title}\n\n${body}\n\nПодробности — в личном кабинете: ${siteUrl()}${link}\n\nVexel` })
}

// сообщение команде: новые заказы с ручной выдачей, KYC, возвраты (NUXT_ADMIN_NOTIFY_EMAIL, можно несколько через запятую)
export function notifyAdmins(subject: string, text: string, link: string) {
  const to = String(useRuntimeConfig().adminNotifyEmail || '').split(',').map(s => s.trim()).filter(Boolean)
  for (const addr of to) mailLater({ to: addr, subject: '[Vexel] ' + subject, text: `${text}\n\n${siteUrl()}${link}` })
}

function siteUrl() { return String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '') }
function mailLater(m: { to: string; subject: string; text: string }) {
  sendMail(m).catch((e) => console.error('[mail] notify', e?.message))
}
