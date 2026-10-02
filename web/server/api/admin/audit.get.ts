// журнал действий админов: владелец видит всех, старший — младших (операторы, модераторы KYC) и себя
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'audit')
  const { limit, offset, q: s } = page(e, 100)
  const { from, to, admin } = getQuery(e)
  const scope = a.role === 'owner' ? 'true' : `(adm.role in ('operator','kyc') or l.admin_id = '${a.id}')`
  const rows = await q(`select l.id, l.action, l.target, l.data, host(l.ip) ip, l.created_at, adm.login, adm.name, adm.role
      from audit_log l left join admins adm on adm.id = l.admin_id
     where ${scope} and l.action <> 'kyc.view'
       and ($1 = '' or l.action ilike '%' || $1 || '%' or coalesce(l.target,'') ilike '%' || $1 || '%' or coalesce(adm.login,'') ilike '%' || $1 || '%')
       and ($2::date is null or l.created_at >= $2::date) and ($3::date is null or l.created_at < $3::date + 1)
       and ($4::text is null or adm.login = $4)
     order by l.id desc limit ${limit} offset ${offset}`, [s, dateOrNull(from), dateOrNull(to), admin ? String(admin) : null])
  const admins = await q(`select login, name, role from admins ${a.role === 'owner' ? '' : `where role in ('operator','kyc') or id = '${a.id}'`} order by name`)
  return { entries: rows, admins }
})
