<script setup lang="ts">
// аналитика поведения: посетители (в т.ч. без аккаунта), время на страницах, клики, воронка; история действий конкретного пользователя
const { api } = useAdm()
const route = useRoute(), router = useRouter()
const tab = ref(route.query.login ? 'user' : 'overview')
const iso = (x: Date) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const period = ref({ from: iso(new Date(Date.now() - 6 * 86400_000)), to: iso(new Date()) })
const r = ref<any>(null), page = ref<string | null>(null), loading = ref(false)
async function load() {
  loading.value = true
  try { r.value = await api('GET', `/analytics?x=1${periodQS(period.value)}${page.value ? '&page=' + encodeURIComponent(page.value) : ''}`) } finally { loading.value = false }
}
watch([period, page], load, { deep: true }); onMounted(load)

// история пользователя
const login = ref(String(route.query.login || '')), u = ref<any>(null), uPeriod = ref({ from: '', to: '' }), uBusy = ref(false)
async function findUser() {
  if (!login.value.trim()) return
  uBusy.value = true
  try { u.value = await api('GET', `/analytics/user?login=${encodeURIComponent(login.value.trim())}${periodQS(uPeriod.value)}`); router.replace({ query: { login: login.value.trim() } }) }
  catch { u.value = null } finally { uBusy.value = false }
}
watch(uPeriod, () => { if (u.value) findUser() }, { deep: true })
onMounted(() => { if (login.value) findUser() })

const SCREEN: Record<string, string> = { overview: 'обзор', orders: 'мои заказы', cards: 'карты', topup: 'пополнение', kyc: 'верификация', profile: 'профиль', security: 'безопасность', docs: 'документы', support: 'поддержка', history: 'история', catalog: 'каталог', notifications: 'уведомления' }
function place(p: string) {
  if (!p) return '—'
  const [path, hash] = p.split('#')
  let n = path === '/' || path === '/index.html' ? 'Главная'
    : path.startsWith('/dashboard') ? 'Кабинет' : path.startsWith('/login') ? 'Вход и регистрация'
    : path.startsWith('/service/') ? 'Сервис · ' + path.split('/')[2] : path.startsWith('/section/') ? 'Раздел · ' + path.split('/')[2]
    : path.startsWith('/virtual-card') ? 'Виртуальная карта' : path.startsWith('/catalog') ? 'Каталог' : path.startsWith('/support') ? 'Поддержка'
    : path.startsWith('/tariffs') ? 'Тарифы' : path === '/api' ? 'Сервер' : path
  if (hash) n += ' · ' + (SCREEN[hash] || hash)
  return n
}
const secs = (s: number | null | undefined) => {
  if (!s) return '—'
  if (s < 60) return s + ' с'
  const m = Math.floor(s / 60); if (m < 60) return m + ' мин' + (s % 60 ? ' ' + (s % 60) + ' с' : '')
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин'
}
const mins = (m: number) => m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин'
const ACT: Record<string, string> = { register: 'Регистрация', login: 'Вход', order: 'Покупка', topup_start: 'Начал пополнение', topup_paid: 'Пополнение оплачено', kyc_submit: 'Отправил документы на KYC', docs_accept: 'Принял документы' }
function what(e: any) {
  if (e.type === 'view') return 'Открыл'
  if (e.type === 'leave') return 'Ушёл · ' + secs(Math.round((e.duration_ms || 0) / 1000)) + (e.scroll_pct != null ? ` · прокрутил ${e.scroll_pct}%` : '')
  if (e.type === 'click') return 'Нажал'
  return ACT[e.target] || e.target
}
const DEV: Record<string, string> = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер' }
const funnel = computed(() => {
  const f = r.value?.funnel; if (!f) return []
  const rows = [['Посетили сайт', f.visitors], ['Открыли товар', f.product_view], ['Нажали «Оплатить»', f.pay_click], ['Зарегистрировались', f.registered], ['Отправили KYC', f.kyc], ['Пополнили баланс', f.topped_up], ['Купили', f.bought]] as [string, number][]
  const max = Math.max(1, ...rows.map(x => x[1]))
  return rows.map(([l, n]) => ({ l, n, w: Math.round(n / max * 100) }))
})
const pageOptions = computed(() => [{ path: null, name: 'Все страницы' }, ...(r.value?.pages || []).map((p: any) => ({ path: p.path, name: place(p.path) }))])
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Поведение на сайте</span><h1>Аналитика</h1></div></div>
  <p class="muted" style="margin-top:-8px">Учитываются все посетители, в том числе без аккаунта. Время на странице — пока вкладка открыта и видна.</p>
  <Tabs v-model:value="tab">
    <TabList><Tab value="overview">Обзор</Tab><Tab value="pages">Страницы</Tab><Tab value="clicks">Клики</Tab><Tab value="user">История пользователя</Tab></TabList>
    <TabPanels>
      <TabPanel value="overview">
        <div class="toolbar"><AdmPeriod v-model="period" /></div>
        <template v-if="r">
          <div class="grid g4">
            <div class="kpi"><span class="k">Посетители</span><span class="v">{{ r.totals.visitors }}</span><span class="muted">из них с аккаунтом: {{ r.totals.known_users }}</span></div>
            <div class="kpi"><span class="k">Визиты</span><span class="v">{{ r.totals.sessions }}</span><span class="muted">{{ r.totals.views_per_session }} стр. за визит</span></div>
            <div class="kpi"><span class="k">Время визита</span><span class="v">{{ secs(r.totals.avg_session_sec) }}</span><span class="muted">в среднем</span></div>
            <div class="kpi"><span class="k">Время на странице</span><span class="v">{{ secs(r.totals.avg_page_sec) }}</span><span class="muted">{{ r.totals.views }} просмотров · {{ r.totals.clicks }} кликов</span></div>
          </div>
          <div class="grid g2" style="align-items:start;margin-top:16px">
            <div class="panel">
              <h2>Воронка</h2>
              <div v-for="f in funnel" :key="f.l" class="funnel"><span>{{ f.l }}</span><div class="bar"><i :style="{ width: f.w + '%' }" /></div><b>{{ f.n }}</b></div>
              <p class="muted" style="font-size:12px;margin:8px 0 0">Первые три шага — уникальные браузеры, остальные — аккаунты за период.</p>
            </div>
            <div class="grid" style="gap:16px">
              <div class="panel"><h2>Откуда пришли</h2>
                <DataTable :value="r.sources" size="small"><Column field="source" header="Источник" /><Column field="sessions" header="Визиты" /></DataTable></div>
              <div class="panel"><h2>Устройства</h2>
                <DataTable :value="r.devices" size="small"><Column header="Устройство"><template #body="{ data }">{{ DEV[data.device] || data.device || '—' }}</template></Column><Column field="visitors" header="Посетители" /></DataTable></div>
            </div>
          </div>
        </template>
      </TabPanel>
      <TabPanel value="pages">
        <div class="toolbar"><AdmPeriod v-model="period" /></div>
        <DataTable v-if="r" :value="r.pages" size="small" sort-field="views" :sort-order="-1" :loading="loading">
          <Column header="Страница" sortable sort-field="path"><template #body="{ data }">{{ place(data.path) }}<div class="mono muted" style="font-size:11px">{{ data.path }}</div></template></Column>
          <Column field="views" header="Просмотры" sortable />
          <Column field="visitors" header="Посетители" sortable />
          <Column field="avg_sec" header="Ср. время" sortable><template #body="{ data }">{{ secs(data.avg_sec) }}</template></Column>
          <Column field="total_min" header="Всего" sortable><template #body="{ data }">{{ mins(data.total_min) }}</template></Column>
          <Column field="scroll" header="Прокрутка" sortable><template #body="{ data }">{{ data.scroll }}%</template></Column>
          <Column field="clicks" header="Клики" sortable><template #body="{ data }"><a v-if="data.clicks" href="#" @click.prevent="page = data.path; tab = 'clicks'">{{ data.clicks }}</a><span v-else>0</span></template></Column>
        </DataTable>
      </TabPanel>
      <TabPanel value="clicks">
        <div class="toolbar"><AdmPeriod v-model="period" /><Select v-model="page" :options="pageOptions" option-label="name" option-value="path" filter style="min-width:240px" /></div>
        <DataTable v-if="r" :value="r.clicks" size="small" :loading="loading">
          <Column header="Где"><template #body="{ data }">{{ place(data.path) }}</template></Column>
          <Column header="Что нажали"><template #body="{ data }">{{ data.label || '—' }}<div class="mono muted" style="font-size:11px">{{ data.target }}</div></template></Column>
          <Column field="n" header="Нажатий" />
          <Column field="visitors" header="Посетителей" />
        </DataTable>
      </TabPanel>
      <TabPanel value="user">
        <div class="toolbar">
          <IconField class="grow"><InputIcon class="pi pi-user" /><InputText v-model="login" placeholder="Логин или почта пользователя" fluid @keydown.enter="findUser" /></IconField>
          <Button label="Показать" :loading="uBusy" :disabled="!login.trim()" @click="findUser" />
        </div>
        <template v-if="u">
          <div class="panel" style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start">
              <div><h2 style="margin:0">{{ u.user.name || u.user.username }}</h2><div class="muted"><span class="mono">{{ u.user.username }}</span> · {{ u.user.email }}</div></div>
              <NuxtLink :to="'/admin/users/' + u.user.id"><Button label="Карточка пользователя" severity="secondary" outlined size="small" /></NuxtLink>
            </div>
            <div class="grid g4" style="margin-top:12px">
              <div class="kpi"><span class="k">Визиты</span><span class="v">{{ u.stats.sessions }}</span></div>
              <div class="kpi"><span class="k">Просмотры</span><span class="v">{{ u.stats.views }}</span></div>
              <div class="kpi"><span class="k">Время на сайте</span><span class="v">{{ mins(u.stats.total_min) }}</span></div>
              <div class="kpi"><span class="k">Последний раз</span><span class="v" style="font-size:16px">{{ dt(u.stats.last_seen) }}</span><span class="muted">впервые {{ d(u.stats.first_seen) }}</span></div>
            </div>
            <div v-if="u.top.length" style="margin-top:12px"><span class="muted" style="font-size:13px">Где проводит больше времени:</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"><Tag v-for="t in u.top" :key="t.path" severity="secondary" :value="place(t.path) + ' — ' + secs(t.sec)" /></div></div>
          </div>
          <div class="toolbar"><AdmPeriod v-model="uPeriod" allow-all /></div>
          <DataTable :value="u.events" size="small" row-group-mode="subheader" group-rows-by="session_id" scrollable>
            <template #groupheader="{ data }"><b>{{ data.session_id === 'server' ? 'Действия на сервере' : 'Визит' }}</b> <span class="muted">· {{ DEV[data.device] || '' }} {{ data.referrer ? '· пришёл с ' + data.referrer.replace(/^https?:\/\//, '').split('/')[0] : '' }}</span></template>
            <Column field="session_id" header="" style="display:none" />
            <Column header="Когда"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
            <Column header="Что"><template #body="{ data }"><Tag v-if="data.type === 'action'" :value="what(data)" severity="info" /><span v-else>{{ what(data) }}</span></template></Column>
            <Column header="Где"><template #body="{ data }">{{ place(data.path) }}</template></Column>
            <Column header="Детали"><template #body="{ data }"><span class="muted">{{ data.label || '' }}</span></template></Column>
          </DataTable>
          <p v-if="!u.events.length" class="muted">Нет событий за период.</p>
        </template>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>
<style scoped>
.funnel { display:grid; grid-template-columns:170px 1fr 48px; gap:10px; align-items:center; margin:6px 0; font-size:14px }
.funnel .bar { height:10px; background:var(--line); border-radius:6px; overflow:hidden }
.funnel .bar i { display:block; height:100%; background:var(--p-primary-color); border-radius:6px }
.funnel b { text-align:right }
@media (max-width: 600px) { .funnel { grid-template-columns:120px 1fr 36px; font-size:13px } }
</style>
