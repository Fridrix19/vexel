<script setup lang="ts">
const { api, ok, me } = useAdm()
const rows = ref<any[]>([]), roles = ref<Record<string, string[]>>({})
const nw = reactive({ open: false, login: '', name: '', role: 'operator', password: '', busy: false })
const reset = reactive({ open: false, a: null as any, password: '' })
async function load() { const r: any = await api('GET', '/admins'); rows.value = r.admins; roles.value = r.roles }
onMounted(load)
const ROLES = Object.entries(ROLE).map(([v, l]) => ({ v, l }))
function genPw() { return Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') + '7Q' }
async function create() { nw.busy = true; try { await api('POST', '/admins', nw); ok('Админ создан', `Передайте логин ${nw.login} и временный пароль лично`); nw.open = false; await load() } finally { nw.busy = false } }
async function patch(a: any, body: any, msg: string) { await api('PATCH', '/admins/' + a.id, body); ok(msg); await load() }
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Доступ</span><h1>Админы и роли</h1></div><Button label="Добавить" icon="pi pi-plus" @click="Object.assign(nw, { open: true, login: '', name: '', role: 'operator', password: genPw() })" /></div>
  <div class="grid g4" style="margin-bottom:14px">
    <div v-for="(perms, r) in roles" :key="r" class="panel"><h3>{{ ROLE[r] }}</h3><p class="muted" style="margin:6px 0 0;font-size:13px">{{ perms.map(p => PERM_LABEL[p] || p).join(', ') }}</p></div>
  </div>
  <DataTable :value="rows" size="small">
    <Column header="Логин"><template #body="{ data }"><b style="color:var(--text)">{{ data.login }}</b><div class="muted">{{ data.name }}</div></template></Column>
    <Column header="Роль"><template #body="{ data }"><Select :model-value="data.role" :options="ROLES" option-label="l" option-value="v" size="small" :disabled="data.id === me.admin?.id" @update:model-value="v => patch(data, { role: v }, 'Роль изменена')" /></template></Column>
    <Column header="Назначен"><template #body="{ data }">{{ dt(data.created_at) }}<div class="muted" style="font-size:12px">{{ data.created_by_name ? 'добавил ' + data.created_by_name : 'первый владелец' }}</div></template></Column>
    <Column header="Права с"><template #body="{ data }">{{ dt(data.role_set_at) }}<div class="muted" style="font-size:12px">{{ data.role_set_by_name ? 'выдал ' + data.role_set_by_name : '' }}</div></template></Column>
    <Column header="Вход"><template #body="{ data }">{{ dt(data.last_login_at) }}<div v-if="data.must_change" class="warn" style="font-size:12px">временный пароль</div></template></Column>
    <Column header="Активен"><template #body="{ data }"><ToggleSwitch :model-value="data.active" :disabled="data.id === me.admin?.id" @update:model-value="v => patch(data, { active: v }, v ? 'Включён' : 'Отключён, сессии завершены')" /></template></Column>
    <Column><template #body="{ data }"><Button size="small" text label="Сбросить пароль" @click="Object.assign(reset, { open: true, a: data, password: genPw() })" /></template></Column>
  </DataTable>
  <Dialog v-model:visible="nw.open" modal header="Новый админ" :style="{ width: 'min(440px, 94vw)' }">
    <div class="grid">
      <div class="field"><label>Логин</label><InputText v-model="nw.login" fluid /></div>
      <div class="field"><label>Имя</label><InputText v-model="nw.name" fluid /></div>
      <div class="field"><label>Роль</label><Select v-model="nw.role" :options="ROLES" option-label="l" option-value="v" fluid /></div>
      <div class="field"><label>Временный пароль — при первом входе попросим сменить</label><InputText v-model="nw.password" class="mono" fluid /></div>
    </div>
    <template #footer><Button label="Отмена" severity="secondary" text @click="nw.open = false" /><Button label="Создать" :loading="nw.busy" :disabled="!nw.login || !nw.name" @click="create" /></template>
  </Dialog>
  <Dialog v-model:visible="reset.open" modal header="Сброс пароля" :style="{ width: 'min(420px, 94vw)' }">
    <p style="margin-top:0">{{ reset.a?.login }}: все его сессии завершатся.</p>
    <div class="field"><label>Новый временный пароль</label><InputText v-model="reset.password" class="mono" fluid /></div>
    <template #footer><Button label="Отмена" severity="secondary" text @click="reset.open = false" /><Button label="Сбросить" @click="patch(reset.a, { password: reset.password }, 'Пароль сброшен'); reset.open = false" /></template>
  </Dialog>
</template>
