<script setup lang="ts">
const { api, ok, can } = useAdm()
const route = useRoute()
const r = ref<any>(null), cats = ref<any[]>([])
const p = ref<any>(null), fieldsJson = ref(''), busy = ref('')
const plan = reactive({ open: false, id: '', label: '', currency: 'usd', price: null as number | null, price_text: '', description: '', free: false, active: true, custom: false, cmin: null as number | null, cmax: null as number | null })
const keys = reactive({ plan_id: null as string | null, text: '' })
async function load() {
  r.value = await api('GET', '/products/' + route.params.id)
  p.value = { ...r.value.product }; fieldsJson.value = JSON.stringify(r.value.product.buyer_fields, null, 2)
  if (!cats.value.length) cats.value = ((await api('GET', '/products?q=%23none')) as any).categories
}
onMounted(load)
const ro = computed(() => !can('products.write'))
async function saveProduct() {
  let bf; try { bf = JSON.parse(fieldsJson.value || '[]') } catch { return ok('Проверьте JSON полей покупателя') }
  busy.value = 'p'
  try { await api('PATCH', '/products/' + p.value.id, { ...p.value, buyer_fields: bf, commission_pct: p.value.commission_pct === '' ? null : p.value.commission_pct }); ok('Сохранено'); await load() } finally { busy.value = '' }
}
function editPlan(x?: any) {
  Object.assign(plan, x ? { open: true, id: x.id, label: x.label, currency: x.currency, price: x.currency === 'rub' ? (x.price_kop ?? 0) / 100 : (x.price_cents ?? 0) / 100, price_text: x.price_text || '', description: x.description || '', free: x.free, active: x.active,
    custom: x.custom_min_cents != null, cmin: x.custom_min_cents != null ? x.custom_min_cents / 100 : null, cmax: x.custom_max_cents != null ? x.custom_max_cents / 100 : null }
    : { open: true, id: '', label: '', currency: 'usd', price: null, price_text: '', description: '', free: false, active: true, custom: false, cmin: null, cmax: null })
}
async function savePlan() {
  const cents = plan.price == null ? null : Math.round(plan.price * 100)
  const body: any = { label: plan.label, currency: plan.currency, price_text: plan.price_text, description: plan.description, free: plan.free, active: plan.active,
    price_cents: plan.currency === 'usd' && !plan.custom ? cents : null, price_kop: plan.currency === 'rub' ? cents : null,
    custom_min_cents: plan.custom ? Math.round((plan.cmin || 0) * 100) : null, custom_max_cents: plan.custom ? Math.round((plan.cmax || 0) * 100) : null }
  busy.value = 'plan'
  try { if (plan.id) await api('PATCH', '/plans/' + plan.id, body); else await api('POST', `/products/${p.value.id}/plans`, body); ok('Тариф сохранён', 'Новая цена — только для новых заказов'); plan.open = false; await load() } finally { busy.value = '' }
}
async function addKeys() {
  busy.value = 'k'
  try { const x: any = await api('POST', `/products/${p.value.id}/keys`, { plan_id: keys.plan_id, keys: keys.text }); ok(`Добавлено ключей: ${x.added}`, x.delivered_waiting ? `Сразу выдано ждавшим заказам: ${x.delivered_waiting}` : ''); keys.text = ''; await load() } finally { busy.value = '' }
}
async function revoke(id: string) { await api('DELETE', '/keys/' + id); ok('Ключ отозван'); await load() }
const planName = (id: string) => r.value.plans.find((x: any) => x.id === id)?.label || 'любой тариф'
</script>
<template>
  <div v-if="p">
    <div class="adm-head"><div><span class="eyebrow"><NuxtLink to="/admin/products">Товары</NuxtLink></span><h1>{{ p.name }}</h1></div>
      <div style="text-align:right"><a :href="'/service/' + p.slug + '/'" target="_blank" rel="noopener">страница на сайте</a><div class="muted" style="font-size:13px">изменён {{ dt(r.product.updated_at) }}{{ r.product.updated_by_name ? ' · ' + r.product.updated_by_name : '' }}</div></div></div>
    <div class="grid g2" style="align-items:start">
      <div class="panel grid">
        <h2>Товар</h2>
        <div class="field"><label>Название</label><InputText v-model="p.name" :disabled="ro" fluid /></div>
        <div class="grid g2">
          <div class="field"><label>Раздел</label><Select v-model="p.category_id" :options="cats" option-label="name" option-value="id" :disabled="ro" fluid /></div>
          <div class="field"><label>Выдача</label><Select v-model="p.delivery" :options="Object.entries(DELIVERY).map(([v, l]) => ({ v, l }))" option-label="l" option-value="v" :disabled="ro" fluid /></div>
        </div>
        <div class="field"><label>Описание</label><Textarea v-model="p.description" rows="3" auto-resize :disabled="ro" fluid /></div>
        <div class="field"><label>Иконка (путь или ссылка)</label><InputText v-model="p.icon" :disabled="ro" fluid /></div>
        <div class="grid g2">
          <div class="field"><label>Своя комиссия, % (пусто — формула сайта)</label><InputNumber v-model="p.commission_pct" :min="0" :max="500" :max-fraction-digits="2" :disabled="ro" fluid /></div>
          <div class="field"><label>Порядок</label><InputNumber v-model="p.sort" :disabled="ro" fluid /></div>
        </div>
        <div class="field"><label>Поля покупателя (JSON): key, label, type (text/email/url/tel), required</label><Textarea v-model="fieldsJson" rows="5" class="mono" auto-resize :disabled="ro" fluid /></div>
        <div style="display:flex;gap:10px;align-items:center"><ToggleSwitch v-model="p.active" :disabled="ro" /><span>{{ p.active ? 'Активен — виден и продаётся' : 'Архив — скрыт с сайта' }}</span></div>
        <div v-if="!ro"><Button label="Сохранить товар" :loading="busy === 'p'" @click="saveProduct" /></div>
      </div>
      <div class="grid">
        <div class="panel">
          <div class="adm-head" style="margin-bottom:10px"><h2>Тарифы</h2><Button v-if="!ro" size="small" label="Тариф" icon="pi pi-plus" @click="editPlan()" /></div>
          <DataTable :value="r.plans" size="small" row-hover :row-class="() => ro ? '' : 'clickable'" @row-click="e => !ro && editPlan(e.data)">
            <Column header="Тариф"><template #body="{ data }"><b style="color:var(--text)">{{ data.label }}</b><div class="muted">{{ data.price_text }}</div></template></Column>
            <Column header="Цена"><template #body="{ data }"><span class="mono">{{ data.custom_min_cents != null ? usd(data.custom_min_cents) + '–' + usd(data.custom_max_cents) : data.currency === 'rub' ? kop(data.price_kop) : data.free ? 'бесплатно' : usd(data.price_cents) }}</span></template></Column>
            <Column header="Клиент платит"><template #body="{ data }"><span class="mono">{{ data.view.charged_kop != null ? kop(data.view.charged_kop) : data.view.purchasable ? 'по сумме' : 'не продаётся' }}</span></template></Column>
            <Column header=""><template #body="{ data }"><Tag v-if="!data.active" value="выкл" severity="secondary" /><span v-if="p.delivery === 'auto'" class="muted"> ключей {{ data.keys_free }}</span></template></Column>
          </DataTable>
          <p class="muted" style="margin:10px 0 0;font-size:13px">Курс {{ r.rate }} ₽/$. Изменение цены не трогает уже оформленные заказы.</p>
        </div>
        <div v-if="p.delivery === 'auto' || r.keys.length" class="panel grid">
          <h2>Пул ключей</h2>
          <template v-if="!ro">
            <Select v-model="keys.plan_id" :options="[{ id: null, label: 'Для любого тарифа' }, ...r.plans]" option-label="label" option-value="id" fluid />
            <Textarea v-model="keys.text" rows="4" placeholder="По одному ключу или логину:паролю на строку. Хранятся зашифрованными." class="mono" auto-resize fluid />
            <div><Button label="Добавить в пул" icon="pi pi-upload" :loading="busy === 'k'" :disabled="!keys.text.trim()" @click="addKeys" /></div>
          </template>
          <DataTable :value="r.keys" size="small" paginator :rows="10">
            <Column header="Тариф"><template #body="{ data }">{{ planName(data.plan_id) }}</template></Column>
            <Column header="Статус"><template #body="{ data }"><Tag :value="{ free: 'Свободен', sold: 'Продан', revoked: 'Отозван' }[data.status]" :severity="{ free: 'success', sold: 'info', revoked: 'secondary' }[data.status]" /></template></Column>
            <Column header="Заказ"><template #body="{ data }"><NuxtLink v-if="data.order_id" :to="'/admin/orders/' + data.order_id" class="mono">{{ data.order_id }}</NuxtLink></template></Column>
            <Column header="Добавлен"><template #body="{ data }">{{ d(data.created_at) }}<span class="muted"> {{ data.added_by }}</span></template></Column>
            <Column><template #body="{ data }"><Button v-if="data.status === 'free' && !ro" size="small" text severity="danger" label="Отозвать" @click="revoke(data.id)" /></template></Column>
          </DataTable>
        </div>
      </div>
    </div>
    <Dialog v-model:visible="plan.open" modal :header="plan.id ? 'Тариф' : 'Новый тариф'" :style="{ width: 'min(500px, 94vw)' }">
      <div class="grid">
        <div class="field"><label>Название</label><InputText v-model="plan.label" fluid /></div>
        <div class="grid g2">
          <div class="field"><label>Валюта</label><SelectButton v-model="plan.currency" :options="[{ v: 'usd', l: '$' }, { v: 'rub', l: '₽' }]" option-label="l" option-value="v" :allow-empty="false" /></div>
          <div v-if="plan.currency === 'usd'" class="field"><label>Своя сумма клиента</label><div style="display:flex;gap:8px;align-items:center;min-height:40px"><ToggleSwitch v-model="plan.custom" /><span class="muted">диапазон</span></div></div>
        </div>
        <div v-if="plan.custom && plan.currency === 'usd'" class="grid g2">
          <div class="field"><label>От, $</label><InputNumber v-model="plan.cmin" :max-fraction-digits="2" fluid /></div><div class="field"><label>До, $</label><InputNumber v-model="plan.cmax" :max-fraction-digits="2" fluid /></div>
        </div>
        <div v-else class="field"><label>Цена, {{ plan.currency === 'rub' ? '₽ (итог без комиссии)' : '$ (номинал сервиса)' }}</label><InputNumber v-model="plan.price" :min-fraction-digits="0" :max-fraction-digits="2" locale="ru-RU" fluid /></div>
        <div class="field"><label>Как показывать цену (например, $20/month) — при смене цены сумма в подписи обновится сама</label><InputText v-model="plan.price_text" fluid /></div>
        <div class="field"><label>Описание</label><Textarea v-model="plan.description" rows="2" auto-resize fluid /></div>
        <div style="display:flex;gap:18px;flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center"><ToggleSwitch v-model="plan.active" /> Активен</label><label style="display:flex;gap:8px;align-items:center"><ToggleSwitch v-model="plan.free" /> Бесплатный (не продаётся)</label></div>
      </div>
      <template #footer><Button label="Отмена" severity="secondary" text @click="plan.open = false" /><Button label="Сохранить" :loading="busy === 'plan'" :disabled="!plan.label" @click="savePlan" /></template>
    </Dialog>
  </div>
</template>
