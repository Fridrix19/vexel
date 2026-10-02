<script setup lang="ts">
const { api, ok, can } = useAdm()
const route = useRoute()
const r = ref<any>(null)
const adj = reactive({ open: false, rub: null as number | null, sign: 1, comment: '', busy: false, idem: '' })
const blk = reactive({ open: false, reason: '', busy: false })
const bon = reactive({ open: false, rub: null as number | null, sign: 1, note: '', busy: false })
async function saveBonus() {
  bon.busy = true
  try { await api('POST', `/users/${u.value.id}/bonus`, { amount_kop: Math.round((bon.rub || 0) * 100) * bon.sign, note: bon.note }); ok('Бонусный счёт изменён'); bon.open = false; await load() } finally { bon.busy = false }
}
async function resetLimit() { await api('POST', `/users/${u.value.id}/limit-reset`, {}); ok('Период лимита обнулён'); await load() }
const BONUS: Record<string, string> = { grant: 'Начислен', spend: 'Скидка по заказу', burn: 'Сгорел остаток', refund: 'Возвращён', adjust: 'Корректировка' }
async function load() { r.value = await api('GET', '/users/' + route.params.id) }
onMounted(load)
const u = computed(() => r.value?.user)
function openAdj(sign: number) { Object.assign(adj, { open: true, sign, rub: null, comment: '', idem: uid() }) }
async function saveAdj() {
  adj.busy = true
  try { await api('POST', `/users/${u.value.id}/adjust`, { amount_kop: Math.round((adj.rub || 0) * 100) * adj.sign, comment: adj.comment, idem: adj.idem }); ok('Баланс изменён'); adj.open = false; await load() } finally { adj.busy = false }
}
async function block(blocked: boolean) {
  blk.busy = true
  try { await api('POST', `/users/${u.value.id}/block`, { blocked, reason: blk.reason }); ok(blocked ? 'Заблокирован, сессии завершены' : 'Разблокирован'); blk.open = false; await load() } finally { blk.busy = false }
}
</script>
<template>
  <div v-if="u">
    <div class="adm-head">
      <div><span class="eyebrow"><NuxtLink to="/admin/users">Пользователи</NuxtLink></span><h1>{{ u.username }}</h1><span class="muted">{{ u.email }}</span></div>
      <div class="row-actions">
        <template v-if="can('balance.adjust')"><Button label="Начислить" icon="pi pi-plus" severity="secondary" outlined @click="openAdj(1)" /><Button label="Списать" icon="pi pi-minus" severity="secondary" outlined @click="openAdj(-1)" /></template>
        <NuxtLink v-if="can('analytics')" :to="'/admin/analytics?login=' + u.username"><Button label="История действий" icon="pi pi-history" severity="secondary" outlined /></NuxtLink>
        <template v-if="can('users.write')"><Button v-if="u.status === 'active'" label="Заблокировать" severity="danger" outlined @click="blk.open = true; blk.reason = ''" /><Button v-else label="Разблокировать" severity="success" outlined :loading="blk.busy" @click="block(false)" /></template>
      </div>
    </div>
    <div class="grid g3" style="margin-bottom:14px">
      <div class="kpi"><span class="k">Баланс</span><span class="v">{{ kop(u.balance_kop) }}</span></div>
      <div class="kpi"><span class="k">KYC</span><span class="v" style="font-size:18px"><Tag :value="KYC_ST[u.kyc_status][0]" :severity="KYC_ST[u.kyc_status][1]" /></span><span class="muted">{{ u.kyc_reason || '' }}</span></div>
      <div class="kpi"><span class="k">Лимит расходов</span><AdmLimit :limit="r.limit.limit_kop" :spent="r.limit.spent_kop" :resets="r.limit.resets_at" />
        <Button v-if="can('balance.adjust') && r.limit.resets_at" label="Обнулить период" size="small" text severity="secondary" style="justify-self:start;padding:2px 0" @click="resetLimit" /></div>
      <div class="kpi"><span class="k">Бонусный счёт</span><span class="v">{{ kop(u.bonus_kop) }}</span>
        <span v-if="can('balance.adjust')" style="display:flex;gap:4px"><Button label="Начислить" size="small" text @click="Object.assign(bon, { open: true, sign: 1, rub: null, note: '' })" /><Button v-if="u.bonus_kop" label="Списать" size="small" text severity="secondary" @click="Object.assign(bon, { open: true, sign: -1, rub: null, note: '' })" /></span></div>
      <div class="kpi"><span class="k">Заказов</span><span class="v">{{ r.orders.length }}</span></div>
      <div class="kpi"><span class="k">Статус</span><span class="v" style="font-size:18px"><Tag :value="u.status === 'active' ? 'Активен' : 'Заблокирован'" :severity="u.status === 'active' ? 'success' : 'danger'" /></span></div>
    </div>
    <Tabs value="ledger">
      <TabList><Tab value="ledger">Баланс и операции</Tab><Tab value="bonus">Бонусы</Tab><Tab value="orders">Заказы</Tab><Tab value="payments">Пополнения</Tab><Tab value="cards">Карты</Tab><Tab value="profile">Профиль</Tab></TabList>
      <TabPanels>
        <TabPanel value="bonus"><DataTable :value="r.bonus" size="small">
          <Column header="Когда"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
          <Column header="Что"><template #body="{ data }">{{ data.reason === 'kyc' ? 'За верификацию' : BONUS[data.kind] }}<div class="muted" style="font-size:12px">{{ data.note }}{{ data.admin_name ? ' · ' + data.admin_name : '' }}</div></template></Column>
          <Column header="Заказ"><template #body="{ data }"><NuxtLink v-if="data.order_id" :to="'/admin/orders/' + data.order_id" class="mono">{{ data.order_id }}</NuxtLink></template></Column>
          <Column header="Сумма"><template #body="{ data }"><span class="mono" :class="data.amount_kop > 0 ? 'ok' : ''">{{ data.amount_kop > 0 ? '+' : '' }}{{ kop(data.amount_kop) }}</span></template></Column>
          <template #empty><span class="muted">Бонусов не было</span></template>
        </DataTable></TabPanel>
        <TabPanel value="ledger"><DataTable :value="r.ledger" size="small" paginator :rows="25">
          <Column header="Когда"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
          <Column header="Операция"><template #body="{ data }">{{ LEDGER[data.kind] }}<div class="muted">{{ data.comment }}<span v-if="data.admin_name"> · {{ data.admin_name }}</span></div></template></Column>
          <Column header="Сумма"><template #body="{ data }"><span :class="['mono', data.amount_kop > 0 ? 'ok' : '']">{{ data.amount_kop > 0 ? '+' : '' }}{{ kop(data.amount_kop) }}</span></template></Column>
          <Column header="Остаток"><template #body="{ data }"><span class="mono">{{ kop(data.balance_after) }}</span></template></Column>
          <Column header="Заказ"><template #body="{ data }"><NuxtLink v-if="data.order_id" :to="'/admin/orders/' + data.order_id" class="mono">{{ data.order_id }}</NuxtLink></template></Column>
          <template #empty><span class="muted">Операций нет</span></template></DataTable></TabPanel>
        <TabPanel value="orders"><DataTable :value="r.orders" size="small" row-hover :row-class="() => 'clickable'" @row-click="e => navigateTo('/admin/orders/' + e.data.id)">
          <Column header="Заказ"><template #body="{ data }"><span class="mono">{{ data.id }}</span></template></Column><Column field="product_name" header="Товар" /><Column field="plan_label" header="Тариф" />
          <Column header="Сумма"><template #body="{ data }"><span class="mono">{{ kop(data.amount_kop) }}</span></template></Column>
          <Column header="Статус"><template #body="{ data }"><Tag :value="ORDER_ST[data.status][0]" :severity="ORDER_ST[data.status][1]" /></template></Column>
          <Column header="Создан"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
          <template #empty><span class="muted">Заказов нет</span></template></DataTable></TabPanel>
        <TabPanel value="payments"><DataTable :value="r.payments" size="small">
          <Column header="Когда"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column><Column header="Сумма"><template #body="{ data }"><span class="mono">{{ kop(data.amount_kop) }}</span></template></Column>
          <Column field="provider" header="Провайдер" /><Column field="status" header="Статус" /><template #empty><span class="muted">Пополнений нет</span></template></DataTable></TabPanel>
        <TabPanel value="cards"><DataTable :value="r.cards" size="small">
          <Column header="Карта"><template #body="{ data }">{{ data.brand }} •• {{ data.last4 }} · до {{ data.exp }}</template></Column>
          <Column header="Баланс"><template #body="{ data }"><span class="mono">{{ usd(data.balance_cents) }}</span></template></Column><Column field="status" header="Статус" />
          <Column header="Выпущена"><template #body="{ data }">{{ d(data.created_at) }}</template></Column><template #empty><span class="muted">Карт нет</span></template></DataTable></TabPanel>
        <TabPanel value="profile"><div class="grid g2">
          <div class="panel"><dl class="kv">
            <dt>Логин</dt><dd class="mono">{{ u.username }}</dd><dt>Telegram</dt><dd>{{ u.telegram ? '@' + u.telegram : '—' }}</dd><dt>Почта</dt><dd>{{ u.email }}</dd><dt>Имя</dt><dd>{{ u.name || '—' }}</dd><dt>Телефон</dt><dd>{{ u.phone || '—' }}</dd><dt>Регистрация</dt><dd>{{ dt(u.created_at) }}</dd><dt>Последний вход</dt><dd>{{ dt(u.last_login_at) }}</dd>
            <dt>Оферта</dt><dd>ред. {{ u.consent_offer || '—' }}</dd><dt>Рассылка</dt><dd>{{ u.consent_news ? 'да' : 'нет' }}</dd>
            <dt>KYC-заявки</dt><dd><template v-for="k in r.kyc" :key="k.id"><NuxtLink :to="'/admin/kyc/' + k.id">{{ KYC_ST[k.status][0] }} · {{ d(k.created_at) }}</NuxtLink><br></template><span v-if="!r.kyc.length">—</span></dd>
          </dl></div>
          <div class="panel"><h3 style="margin-bottom:8px">Активные сессии</h3><p v-for="(s, i) in r.sessions" :key="i" style="margin:6px 0">{{ s.ip }} · {{ dt(s.last_seen_at) }}<br><span class="muted" style="font-size:12px">{{ s.user_agent }}</span></p><p v-if="!r.sessions.length" class="muted">Нет</p></div>
        </div></TabPanel>
      </TabPanels>
    </Tabs>
    <Dialog v-model:visible="adj.open" modal :header="adj.sign > 0 ? 'Начислить на баланс' : 'Списать с баланса'" :style="{ width: 'min(420px, 94vw)' }">
      <div class="grid">
        <div class="field"><label>Сумма, ₽</label><InputNumber v-model="adj.rub" :min-fraction-digits="0" :max-fraction-digits="2" :min="0.01" locale="ru-RU" fluid /></div>
        <div class="field"><label>Комментарий (обязательно; клиент увидит его в уведомлении)</label><Textarea v-model="adj.comment" rows="2" auto-resize fluid /></div>
      </div>
      <template #footer><Button label="Отмена" severity="secondary" text @click="adj.open = false" /><Button :label="adj.sign > 0 ? 'Начислить' : 'Списать'" :loading="adj.busy" :disabled="!adj.rub || !adj.comment.trim()" @click="saveAdj" /></template>
    </Dialog>
    <Dialog v-model:visible="bon.open" modal :header="bon.sign > 0 ? 'Начислить бонус' : 'Списать бонус'" :style="{ width: 'min(420px, 94vw)' }">
      <p class="muted" style="margin-top:0">Бонус — скидка при следующей оплате: списывается целиком, остаток сгорает. На балансе и лимите не отражается.</p>
      <div class="grid">
        <div class="field"><label>Сумма, ₽</label><InputNumber v-model="bon.rub" :min-fraction-digits="0" :max-fraction-digits="2" :min="0.01" locale="ru-RU" fluid /></div>
        <div class="field"><label>Комментарий (обязательно)</label><Textarea v-model="bon.note" rows="2" auto-resize fluid /></div>
      </div>
      <template #footer><Button label="Отмена" severity="secondary" text @click="bon.open = false" /><Button :label="bon.sign > 0 ? 'Начислить' : 'Списать'" :loading="bon.busy" :disabled="!bon.rub || !bon.note.trim()" @click="saveBonus" /></template>
    </Dialog>
    <Dialog v-model:visible="blk.open" modal header="Заблокировать пользователя" :style="{ width: 'min(420px, 94vw)' }">
      <p style="margin-top:0">Все сессии завершатся, вход и покупки станут недоступны. Баланс сохранится.</p>
      <div class="field"><label>Причина (для журнала)</label><Textarea v-model="blk.reason" rows="2" auto-resize fluid /></div>
      <template #footer><Button label="Отмена" severity="secondary" text @click="blk.open = false" /><Button label="Заблокировать" severity="danger" :loading="blk.busy" :disabled="!blk.reason.trim()" @click="block(true)" /></template>
    </Dialog>
  </div>
</template>
