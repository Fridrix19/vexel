// очередь верификации: pending первыми
export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'kyc')
  const { status, from, to } = getQuery(e)
  const rows = await q(`select k.id, k.status, k.reason, k.created_at, k.reviewed_at, array_length(k.file_ids,1) files, k.birth_date,
      u.id user_id, u.email, u.name, a.name reviewer
    from kyc_submissions k join users u on u.id = k.user_id left join admins a on a.id = k.reviewed_by
    where ($1::text is null or k.status = $1) and ($2::date is null or k.created_at >= $2::date) and ($3::date is null or k.created_at < $3::date + 1) order by (k.status = 'pending') desc, k.created_at asc limit 200`, [status === 'all' ? null : status ? String(status) : 'pending', dateOrNull(from), dateOrNull(to)])
  return { submissions: rows }
})
