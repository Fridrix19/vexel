export default defineEventHandler(async (e) => {
  await requireAdmin(e, 'admins')
  return { admins: await q(`select a.id, a.login, a.name, a.role, a.active, a.must_change, a.created_at, a.last_login_at, a.role_set_at,
      c.name created_by_name, r.name role_set_by_name
    from admins a left join admins c on c.id = a.created_by left join admins r on r.id = a.role_set_by order by a.created_at`),
    roles: { owner: PERMS.filter(p => can('owner', p)), senior: PERMS.filter(p => can('senior', p)), operator: PERMS.filter(p => can('operator', p)), kyc: PERMS.filter(p => can('kyc', p)) } }
})
