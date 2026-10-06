<script setup lang="ts">
import logo from '~/assets/logo.svg?url'
// оболочка админки: проверка входа, строка функциональных клавиш снизу со счётчиками, быстрый поиск, обязательная смена пароля
const { api, me, can } = useAdm()
const route = useRoute()
const ready = ref(false)
const counts = ref<any>({})
const isLogin = computed(() => route.path === '/admin/login')
useHead({ title: 'Админка — Vexel', htmlAttrs: { class: 'mc-dark' }, link: [{ rel: 'icon', type: 'image/svg+xml', href: logo }] })

async function loadMe() {
  const r: any = await $fetch('/api/admin/auth/me').catch(() => ({ admin: null, perms: [] }))
  me.value = { admin: r.admin, perms: r.perms || [] }
  if (!r.admin && !isLogin.value) return navigateTo('/admin/login')
  if (r.admin && isLogin.value) return navigateTo('/admin')
}
async function loadCounts() { if (me.value.admin) counts.value = await api('GET', '/summary', undefined, { quiet: true }).catch(() => ({})) }
let cT: any
onUnmounted(() => clearInterval(cT))
onMounted(async () => { await loadMe(); ready.value = true; cT = setInterval(() => { if (!isLogin.value && document.visibilityState === 'visible') loadCounts() }, 30000); if (me.value.admin?.must_change) pw.open = true; else loadCounts() })
watch(() => route.path, () => { if (!isLogin.value) loadCounts() })

// нижняя строка функциональных клавиш, как в файловом менеджере: Alt+1…Alt+0
const KEYS = [
  { k: '1', to: '/admin', label: 'Сводка', perm: 'summary', exact: true },
  { k: '2', to: '/admin/orders', label: 'Заказы', perm: 'orders', n: () => (counts.value.orders_open || 0) + (counts.value.orders_need_info || 0) },
  { k: '3', to: '/admin/kyc', label: 'KYC', perm: 'kyc', n: () => counts.value.kyc_pending, warn: true },
  { k: '4', to: '/admin/refunds', label: 'Возвраты', perm: 'refunds', n: () => counts.value.refunds_new, warn: true },
  { k: '5', to: '/admin/chats', label: 'Чаты', perm: 'chats', n: () => counts.value.chats_waiting, warn: true },
  { k: '6', to: '/admin/users', label: 'Клиенты', perm: 'users' },
  { k: '7', to: '/admin/reviews', label: 'Отзывы', perm: 'reviews' },
  { k: '8', to: '/admin/products', label: 'Товары', perm: 'products' },
  { k: '9', to: '/admin/analytics', label: 'Аналитика', perm: 'analytics' },
]
const MORE = [
  { to: '/admin/export', label: 'Выгрузки CSV', perm: 'export' },
  { to: '/admin/admins', label: 'Админы', perm: 'admins' },
  { to: '/admin/settings', label: 'Настройки', perm: 'settings' },
  { to: '/admin/audit', label: 'Журнал действий', perm: 'audit' },
]
const isOn = (i: any) => i.exact ? route.path === i.to : route.path.startsWith(i.to) && !(i.to === '/admin' && route.path !== '/admin')
const keys = computed(() => KEYS.filter(i => can(i.perm)).map(i => ({ ...i, count: i.n ? i.n() || 0 : 0 })))
const more = computed(() => MORE.filter(i => can(i.perm)))
const moreOn = computed(() => more.value.some(isOn))
const moreOpen = ref(false)
const queue = computed(() => keys.value.reduce((a, i) => a + (i.n ? i.count : 0), 0))
const crumb = computed(() => route.path.replace(/^\/admin\/?/, '').split('/')[0] || 'summary')
const clock = ref('')
function tick() { const d = new Date(); clock.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
let kT: any
function onKey(e: KeyboardEvent) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return
  const m = /^Digit(\d)$/.exec(e.code); if (!m) return
  if (m[1] === '0') { e.preventDefault(); moreOpen.value = !moreOpen.value; return }
  const it = keys.value.find(i => i.k === m[1]); if (it) { e.preventDefault(); navigateTo(it.to) }
}
const closeMore = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('.vx-more')) moreOpen.value = false }
onMounted(() => { tick(); kT = setInterval(tick, 15000); window.addEventListener('keydown', onKey); document.addEventListener('click', closeMore) })
onUnmounted(() => { clearInterval(kT); window.removeEventListener('keydown', onKey); document.removeEventListener('click', closeMore) })
watch(() => route.path, () => { moreOpen.value = false })
const search = ref('')
function go() {
  const v = search.value.trim(); if (!v) return
  const isOrder = /^vx-/i.test(v)
  navigateTo({ path: isOrder && can('orders') ? '/admin/orders' : '/admin/users', query: { q: v, ...(isOrder ? { status: 'all' } : {}) } })
  search.value = ''
}
async function logout() { await $fetch('/api/admin/auth/logout', { method: 'POST' }); me.value = { admin: null, perms: [] }; navigateTo('/admin/login') }
const pw = reactive({ open: false, old: '', new: '', busy: false })
async function changePw() {
  pw.busy = true
  try { await api('POST', '/auth/password', { old: pw.old, new: pw.new }); pw.open = false; pw.old = pw.new = ''; await loadMe(); loadCounts() } finally { pw.busy = false }
}
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />
  <NuxtPage v-if="isLogin" />
  <div v-else-if="ready && me.admin" class="vx">
    <header class="vx-top">
      <NuxtLink to="/admin" class="vx-brand"><img :src="logo" alt=""><span>VEXEL</span><small>admin</small></NuxtLink>
      <span class="vx-path"><b>root@vexel</b>:<i>~/admin/{{ crumb }}</i># <span class="vx-cur" aria-hidden="true"></span></span>
      <form class="vx-search" role="search" @submit.prevent="go"><label for="vxq">find</label><input id="vxq" v-model="search" placeholder="VX-… или клиент" aria-label="Быстрый поиск"></form>
      <span class="vx-who">{{ me.admin.login }} · {{ ROLE[me.admin.role] }}</span>
      <span class="vx-q" v-if="queue">очередь: {{ queue }}</span>
      <span class="vx-clock">{{ clock }}</span>
    </header>
    <main class="adm-main">
      <div v-if="me.admin.must_change" class="banner"><i class="pi pi-exclamation-triangle warn" />
        <span>Вы вошли с временным паролем{{ me.admin.login === 'admin' ? ' admin/admin' : '' }}. Смените его, прежде чем работать дальше.</span>
        <Button size="small" label="Сменить пароль" @click="pw.open = true" />
      </div>
      <AdmCrumbs v-if="!me.admin.must_change" />
      <NuxtPage v-if="!me.admin.must_change" @changed="loadCounts" />
    </main>
    <nav class="vx-keys" aria-label="Разделы (Alt + цифра)">
      <NuxtLink v-for="i in keys" :key="i.to" :to="i.to" :class="['vx-k', { on: isOn(i) }]" :title="'Alt+' + i.k">
        <b>{{ i.k }}</b><span>{{ i.label }}</span><em v-if="i.count" :class="{ warn: i.warn }">{{ i.count }}</em>
      </NuxtLink>
      <div class="vx-more">
        <button type="button" :class="['vx-k', { on: moreOn || moreOpen }]" title="Alt+0" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen"><b>10</b><span>Меню</span></button>
        <div v-if="moreOpen" class="vx-menu">
          <div class="vx-menu-h">menu.exe</div>
          <NuxtLink v-for="i in more" :key="i.to" :to="i.to" :class="{ on: isOn(i) }">{{ i.label }}</NuxtLink>
          <button type="button" @click="pw.open = true; moreOpen = false">Сменить пароль</button>
          <button type="button" class="danger" @click="logout">Выйти</button>
        </div>
      </div>
    </nav>
  </div>
  <Dialog v-model:visible="pw.open" modal header="Смена пароля" :style="{ width: 'min(420px, 94vw)' }">
    <div class="grid">
      <div class="field"><label>Текущий пароль</label><Password v-model="pw.old" :feedback="false" toggle-mask fluid /></div>
      <div class="field"><label>Новый пароль — от 10 символов, буквы и цифры</label><Password v-model="pw.new" toggle-mask fluid /></div>
    </div>
    <template #footer><Button label="Отмена" severity="secondary" text @click="pw.open = false" /><Button label="Сохранить" :loading="pw.busy" @click="changePw" /></template>
  </Dialog>
</template>
