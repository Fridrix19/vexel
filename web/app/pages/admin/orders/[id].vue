<script setup lang="ts">
const { api, ok, can } = useAdm()
const emit = defineEmits(['changed'])
const route = useRoute()
const r = ref<any>(null)
const deliverText = ref(''), note = ref(''), refundReason = ref(''), busy = ref('')
async function load() { r.value = await api('GET', '/orders/' + route.params.id) }
onMounted(load)
async function act(name: string, method: string, path: string, body: any, msg: string) {
  busy.value = name
  try { await api(method, path, body); ok(msg); await load(); emit('changed') } finally { busy.value = '' }
}
const o = computed(() => r.value?.order)
const open = computed(() => o.value && ['paid', 'in_work', 'need_info'].includes(o.value.status))
const fields = computed(() => Object.entries(o.value?.buyer_fields || {}).map(([k, v]) => [(o.value.field_spec || []).find((f: any) => f.key === k)?.label || k, v]))
</script>
<template>
  <div v-if="o">
    <div class="adm-head">
      <div><span class="eyebrow"><NuxtLink to="/admin/orders">Заказы</NuxtLink></span><h1>{{ o.product_name }} <span class="mono muted" style="font-size:16px">{{ o.id }}</span></h1></div>
      <Tag :value="ORDER_ST[o.status]?.[0]" :severity="ORDER_ST[o.status]?.[1]" style="font-size:14px" />
    </div>
    <div class="grid g2">
      <div class="grid">
        <div class="panel"><h2 style="margin-bottom:12px">Детали</h2>
          <dl class="kv">
            <dt>Клиент</dt><dd><NuxtLink :to="'/admin/users/' + o.user_id">{{ o.email }}</NuxtLink></dd>
            <dt>Тариф</dt><dd>{{ o.plan_label }}</dd>
            <dt>Выдача</dt><dd>{{ DELIVERY[o.delivery_type] || '—' }}<span v-if="r.keys_free != null" class="muted"> · свободных ключей {{ r.keys_free }}</span></dd>
            <dt>Цена</dt><dd class="mono">{{ o.currency === 'rub' ? kop(o.amount_kop) : usd(o.price_cents) + ' → ' + usd(o.charged_cents) + ' × ' + o.rate }}</dd>
            <dt>Списано</dt><dd class="mono">{{ kop(o.amount_kop) }}</dd>
            <template v-for="[k, v] in fields" :key="k"><dt>{{ k }}</dt><dd class="mono">{{ v }}</dd></template>
            <dt>Создан</dt><dd>{{ dt(o.created_at) }}</dd>
            <dt>Оператор</dt><dd>{{ o.admin_name || '—' }}</dd>
          </dl>
        </div>
        <div v-if="o.delivery" class="panel"><h2 style="margin-bottom:10px">Выдано клиенту</h2><div class="secret">{{ o.delivery }}</div><p class="muted" style="margin:8px 0 0">{{ dt(o.delivered_at) }}</p></div>
        <div v-if="open" class="panel grid">
          <h2>Выдать</h2>
          <Textarea v-model="deliverText" rows="4" placeholder="Логин/пароль, ключ, ссылка активации или текст для клиента — хранится зашифрованным" auto-resize fluid />
          <div class="row-actions">
            <Button label="Выдать и закрыть заказ" icon="pi pi-check" :loading="busy === 'deliver'" :disabled="!deliverText.trim()" @click="act('deliver', 'POST', `/orders/${o.id}/deliver`, { mode: 'manual', text: deliverText }, 'Выдано')" />
            <Button v-if="o.delivery_type === 'auto'" label="Взять ключ из пула" icon="pi pi-key" severity="secondary" outlined :loading="busy === 'key'" @click="act('key', 'POST', `/orders/${o.id}/deliver`, { mode: 'key' }, 'Ключ выдан')" />
          </div>
        </div>
        <div v-if="open" class="panel grid">
          <h2>Статус</h2>
          <InputText v-model="note" placeholder="Комментарий для клиента (необязательно)" fluid />
          <div class="row-actions">
            <Button label="В работу" severity="secondary" outlined :disabled="o.status === 'in_work'" :loading="busy === 'in_work'" @click="act('in_work', 'POST', `/orders/${o.id}/status`, { status: 'in_work', text: note }, 'Статус обновлён')" />
            <Button label="Нужны данные" severity="warn" outlined :loading="busy === 'need_info'" @click="act('need_info', 'POST', `/orders/${o.id}/status`, { status: 'need_info', text: note }, 'Клиент получит уведомление')" />
          </div>
        </div>
        <div v-if="can('refunds') && !['refunded', 'canceled'].includes(o.status)" class="panel grid">
          <h2>Возврат на баланс</h2>
          <InputText v-model="refundReason" placeholder="Причина — её увидит клиент" fluid />
          <div><Button severity="danger" outlined :disabled="!refundReason.trim()" :loading="busy === 'refund'" @click="act('refund', 'POST', `/orders/${o.id}/refund`, { reason: refundReason }, 'Деньги вернулись на баланс')">Вернуть {{ kop(o.amount_kop) }} на баланс</Button></div>
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="panel"><h2 style="margin-bottom:12px">История</h2>
          <ol class="tl"><li v-for="(e, i) in r.events" :key="i"><b style="color:var(--text)">{{ e.text || e.kind }}</b><span v-if="e.admin_name" class="muted"> · {{ e.admin_name }}</span><time>{{ dt(e.created_at) }}</time></li></ol>
        </div>
        <div v-if="r.refunds.length" class="panel"><h2 style="margin-bottom:12px">Заявки на возврат</h2>
          <p v-for="x in r.refunds" :key="x.id" style="margin:6px 0"><Tag :value="REF_ST[x.status][0]" :severity="REF_ST[x.status][1]" /> {{ x.destination === 'card' ? 'на карту' : 'на баланс' }} · {{ x.reason }} · {{ dt(x.created_at) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
