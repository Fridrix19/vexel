// чат с поддержкой: ветка на заказ и общая; вложения — фото и PDF до 10 МБ
import type { H3Event } from 'h3'
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export function sniffFile(b: Buffer, type: string) {
  const h = b.subarray(0, 12)
  if (type === 'image/jpeg') return h[0] === 0xff && h[1] === 0xd8
  if (type === 'image/png') return h.subarray(0, 4).toString('hex') === '89504e47'
  if (type === 'application/pdf') return h.subarray(0, 4).toString() === '%PDF'
  if (type === 'image/webp') return h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP'
  return false
}
// тело сообщения: JSON {text, order_id?} или multipart (text, order_id, file)
export async function readChatBody(e: H3Event) {
  const ct = String(getHeader(e, 'content-type') || '')
  let text = '', orderId: string | null = null, file: any = null
  if (ct.includes('multipart/form-data')) {
    const parts = (await readMultipartFormData(e)) || []
    const f = (n: string) => { const p = parts.find(x => x.name === n && !x.filename); return p ? p.data.toString('utf8') : '' }
    text = f('text'); orderId = f('order_id') || null
    file = parts.find(x => x.name === 'file' && x.filename) || null
  } else {
    const b = await readBody(e); text = String(b?.text ?? ''); orderId = b?.order_id ? String(b.order_id) : null
  }
  text = text.trim().slice(0, 4000)
  if (file) {
    if (!TYPES.includes(String(file.type)) || !sniffFile(file.data, String(file.type))) fail(422, 'bad_type', 'Прикрепить можно фото (JPG, PNG, WebP) или PDF.')
    if (file.data.length > 10 * 1024 * 1024) fail(422, 'too_big', 'Файл больше 10 МБ.')
  }
  if (!text && !file) fail(422, 'empty', 'Напишите сообщение.')
  return { text: text || null, orderId, file }
}
export async function saveChatFile(file: any, owner: { user?: string; admin?: string }) {
  if (!file) return null
  return (await one(`insert into files (owner_user, owner_admin, purpose, mime, size_bytes, name, data) values ($1, $2, 'chat', $3, $4, $5, $6) returning id`,
    [owner.user ?? null, owner.admin ?? null, file.type, file.data.length, String(file.filename).slice(0, 120), file.data])).id as string
}
export function msgView(m: any, base: string) {
  return { id: Number(m.id), author: m.author, text: m.text ?? m.body, admin_name: m.admin_name || null, created_at: m.created_at,
    file: m.file_id ? { url: `${base}/${m.file_id}`, name: m.file_name, mime: m.file_mime, size: m.file_size } : null }
}
export const MSG_SQL = `select m.id, m.author, m.body text, m.file_id, m.created_at, a.name admin_name, f.name file_name, f.mime file_mime, f.size_bytes file_size
  from chat_messages m left join admins a on a.id = m.admin_id left join files f on f.id = m.file_id where m.thread_id = $1 and m.id > $2 order by m.id limit 500`
export function threadTitle(t: any) { return t.order_id ? `${t.product_name || 'Заказ'} · ${t.order_id}` : 'Общий вопрос' }
