// отправка фото документов на ручную проверку: multipart, 1–4 файла JPG/PNG/PDF до 10 МБ
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MAX = 10 * 1024 * 1024

export default defineEventHandler(async (e) => {
  const u = await requireUser(e)
  if (u.kyc_status === 'approved') fail(409, 'kyc_done', 'Верификация уже пройдена.')
  if (u.kyc_status === 'pending') fail(409, 'kyc_pending', 'Документы уже на проверке.')
  const parts = (await readMultipartFormData(e)) || []
  const files = parts.filter(p => p.name === 'files' && p.filename)
  if (!files.length) fail(422, 'no_files', 'Прикрепите фото паспорта (разворот с фото) и селфи с ним.')
  if (files.length > 4) fail(422, 'too_many', 'Не больше 4 файлов.')
  for (const f of files) {
    if (!TYPES.includes(String(f.type))) fail(422, 'bad_type', `«${f.filename}»: подойдут JPG, PNG, HEIC или PDF.`)
    if (f.data.length > MAX) fail(422, 'too_big', `«${f.filename}» больше 10 МБ.`)
    if (!sniff(f.data, String(f.type))) fail(422, 'bad_type', `«${f.filename}» не похож на фото или PDF.`)
  }
  const id = await tx(async (c) => {
    const ids: string[] = []
    for (const f of files) {
      const r = await c.query(`insert into files (owner_user, purpose, mime, size_bytes, name, data) values ($1, 'kyc', $2, $3, $4, $5) returning id`,
        [u.id, f.type, f.data.length, String(f.filename).slice(0, 120), f.data])
      ids.push(r.rows[0].id)
    }
    const s = await c.query(`insert into kyc_submissions (user_id, file_ids) values ($1, $2) returning id`, [u.id, ids])
    await c.query(`update users set kyc_status = 'pending', kyc_reason = null where id = $1`, [u.id])
    return s.rows[0].id
  })
  trackAction(u.id, 'kyc_submit', { label: files.length + ' файл(ов)' })
  notifyAdmins('Новая заявка на верификацию', `${u.email} отправил документы (${files.length} шт.).`, '/admin/kyc/' + id)
  return { ok: true, submission: id, status: 'pending' }
})

function sniff(b: Buffer, type: string) {
  const h = b.subarray(0, 12)
  if (type === 'image/jpeg') return h[0] === 0xff && h[1] === 0xd8
  if (type === 'image/png') return h.subarray(0, 4).toString('hex') === '89504e47'
  if (type === 'application/pdf') return h.subarray(0, 4).toString() === '%PDF'
  if (type === 'image/webp') return h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP'
  if (type === 'image/heic') return h.subarray(4, 8).toString() === 'ftyp'
  return false
}
