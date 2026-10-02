import type { H3Event } from 'h3'

// профиль для фронта: без хешей, с балансом. userId — сразу после входа, когда кука ещё не вернулась от браузера
export async function me(e: H3Event, userId?: string) {
  const id = userId ?? (await currentUser(e))?.id
  if (!id) return null
  const u: any = await one(
    `select id, email, username, name, phone, telegram, kyc_status, kyc_reason, created_at,
            user_balance(id) as balance_kop,
            (select count(*)::int from notifications n where n.user_id = u.id and n.read_at is null) as unread_notifications
       from users u where id = $1`, [id])
  if (u) { u.limit = await spendState(u.id); u.bonus_kop = await bonusBalance(u.id) }
  if (u) u.docs_pending = (await pendingDocuments(u.id)).map(d => ({ id: d.id, kind: d.kind, title: d.title, version: d.version, url: d.url, note: d.note, published_at: d.published_at }))
  return u
}
