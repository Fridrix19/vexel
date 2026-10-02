<script setup lang="ts">
const { api } = useAdm()
const s = ref<any>(null)
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const period = ref({ from: iso(new Date(Date.now() - 29 * 86400000)), to: iso(new Date()) })
async function load() { s.value = await api('GET', '/summary?x=1' + periodQS(period.value)) }
watch(period, load, { deep: true }); onMounted(load)
const max = computed(() => Math.max(1, ...(s.value?.days || []).map((x: any) => (+x.sales_kop + +x.topups_kop))))
const fmtRange = computed(() => s.value ? `${d(s.value.period.from)} — ${d(s.value.period.to)}` : '')
const meters = computed(() => {
  if (!s.value) return []
  const rows = [
    { to: '/admin/orders', k: 'Заказы', n: +s.value.orders_open + +(s.value.orders_need_info || 0), hint: s.value.orders_need_info ? `ждут данных: ${s.value.orders_need_info}` : 'ждут выдачи' },
    { to: '/admin/kyc', k: 'KYC', n: +s.value.kyc_pending, hint: 'паспорта на проверке' },
    { to: '/admin/refunds', k: 'Возвраты', n: +s.value.refunds_new, hint: 'новые заявки' },
    { to: '/admin/chats', k: 'Чаты', n: +(s.value.chats_waiting || 0), hint: 'ждут ответа' },
  ]
  const top = Math.max(5, ...rows.map(r => r.n))
  return rows.map(r => ({ ...r, w: Math.round(r.n / top * 100) }))
})
const total = computed(() => meters.value.reduce((a, r) => a + r.n, 0))
</script>
<template>
  <div v-if="s" class="ht">
    <div class="ht-head">
      <div><span class="ht-k">$ vexel top</span><h1>Сводка</h1></div>
      <pre class="ht-uptime">курс ЦБ: {{ s.rate }} ₽/$   клиентов: {{ s.users_total }}   в очереди: {{ total }}</pre>
    </div>

    <section class="ht-meters" aria-label="Очередь">
      <NuxtLink v-for="(m, i) in meters" :key="m.to" :to="m.to" :class="['ht-m', { zero: !m.n }]">
        <span class="ht-mi">{{ i + 1 }}</span><b>{{ m.k }}</b>
        <span class="ht-bar">[<i :style="{ width: m.w + '%' }" /><em>{{ m.n }}</em>]</span>
        <span class="ht-mh">{{ m.hint }}</span>
      </NuxtLink>
    </section>

    <div class="ht-row">
      <section class="ht-win">
        <div class="ht-bar-t"><span>period.log</span><span>{{ fmtRange }}</span></div>
        <div class="ht-pad">
          <AdmPeriod v-model="period" />
          <dl class="ht-dl">
            <div><dt>продажи</dt><dd>{{ kop(+s.period.sales_kop) }}</dd><small>{{ s.period.orders }} заказов · {{ s.period.buyers }} покупателей</small></div>
            <div><dt>пополнения</dt><dd>{{ kop(+s.period.topups_kop) }}</dd><small>возвраты {{ kop(+s.period.refunds_kop) }}</small></div>
            <div><dt>новые клиенты</dt><dd>{{ s.period.users_new }}</dd><small>прошли KYC: {{ s.period.kyc_approved }}</small></div>
            <div><dt>посетители</dt><dd>{{ s.period.visitors }}</dd><small><NuxtLink to="/admin/analytics">→ аналитика</NuxtLink></small></div>
          </dl>
        </div>
      </section>
      <section class="ht-win ht-bal">
        <div class="ht-bar-t"><span>balance.dat</span><span>[×]</span></div>
        <div class="ht-pad">
          <span class="ht-bal-k">на балансах клиентов</span>
          <b class="ht-bal-v">{{ kop(+s.balances_kop) }}</b>
          <NuxtLink to="/admin/users">→ клиенты ({{ s.users_total }})</NuxtLink>
        </div>
      </section>
    </div>

    <div class="ht-row ht-row2">
      <section class="ht-win">
        <div class="ht-bar-t"><span>по дням</span><span class="legend"><span><i style="background:#FFB000" />продажи</span><span><i style="background:#5CE1E6" />пополнения</span></span></div>
        <div class="ht-pad">
          <div v-if="s.days.length" class="chart">
            <div v-for="x in s.days" :key="x.day" class="col" v-tooltip.top="`${d(x.day)}: продажи ${kop(+x.sales_kop)}, пополнения ${kop(+x.topups_kop)}`">
              <div class="bar t" :style="{ height: (x.topups_kop / max * 100) + 'px' }" />
              <div class="bar" :style="{ height: (x.sales_kop / max * 100) + 'px' }" />
              <span v-if="s.days.length <= 31" class="lbl">{{ x.day.slice(8) }}</span>
            </div>
          </div>
          <p v-else class="muted">Период больше 3 месяцев — график по дням не строим, смотрите итоги.</p>
        </div>
      </section>
      <section class="ht-win">
        <div class="ht-bar-t"><span>top products</span><span>[×]</span></div>
        <div class="ht-pad">
          <div v-if="s.top.length" class="ht-ps">
            <div class="ht-ps-h"><span>#</span><span>ТОВАР</span><span>ШТ</span><span>СУММА</span></div>
            <div v-for="(x, i) in s.top" :key="x.product_name" class="ht-ps-r"><span>{{ i + 1 }}</span><b>{{ x.product_name }}</b><span>{{ x.n }}</span><span>{{ kop(+x.kop) }}</span></div>
          </div>
          <p v-else class="muted">Заказов за период нет</p>
          <div v-if="s.low_keys.length" class="ht-keys"><h3>! заканчиваются ключи</h3>
            <p v-for="k in s.low_keys" :key="k.slug"><NuxtLink :to="'/admin/products/' + k.slug">{{ k.name }}</NuxtLink> — свободно {{ k.free }}</p></div>
        </div>
      </section>
    </div>
  </div>
</template>
