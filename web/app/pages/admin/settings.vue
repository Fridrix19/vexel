<script setup lang="ts">
const { api, ok } = useAdm()
const s = ref<any>(null), domains = ref(''), busy = ref(''), to = ref('')
const contacts = ref({ email: '', telegram: '', max: '' })
const KIND: Record<string, string> = { offer: 'Публичная оферта', privacy: 'Политика конфиденциальности', tariffs: 'Тарифы' }
const doc = ref<{ kind: string; version: string; title: string; note: string; url: string; file: File | null }>({ kind: 'offer', version: '', title: '', note: '', url: '', file: null })
const fileInput = ref<HTMLInputElement | null>(null)
const lim = ref({ unverified_rub: '' as any, verified_rub: '' as any, kyc_bonus_rub: '' as any })
const toRub = (k: any) => k == null ? '' : String(k / 100)
async function saveLimits() { busy.value = 'l'; try { await api('POST', '/settings/limits', lim.value); ok('Сохранено', 'Лимиты действуют для следующих покупок'); await load() } finally { busy.value = '' } }
async function load() { s.value = await api('GET', '/settings'); lim.value = { unverified_rub: toRub(s.value.limits.unverified_kop), verified_rub: toRub(s.value.limits.verified_kop), kyc_bonus_rub: toRub(s.value.limits.kyc_bonus_kop) }; domains.value = s.value.email_domains.join('\n'); contacts.value = { email: '', telegram: '', max: '', ...s.value.contacts } }
async function saveContacts() { busy.value = 'c'; try { await api('POST', '/settings/contacts', contacts.value); ok('Контакты обновлены', 'Сайт покажет их при следующем открытии страницы'); await load() } finally { busy.value = '' } }
async function publish() {
  busy.value = 'p'
  try {
    const f = new FormData(); f.append('kind', doc.value.kind); f.append('version', doc.value.version); f.append('title', doc.value.title || KIND[doc.value.kind]); f.append('note', doc.value.note)
    if (doc.value.file) f.append('file', doc.value.file); else f.append('url', doc.value.url)
    await api('POST', '/settings/documents', f)
    ok('Опубликовано', 'Пользователи получили уведомление и примут новую редакцию перед следующей покупкой')
    doc.value = { kind: doc.value.kind, version: '', title: '', note: '', url: '', file: null }; if (fileInput.value) fileInput.value.value = ''
    await load()
  } finally { busy.value = '' }
}
onMounted(load)
async function saveDomains() { busy.value = 'd'; try { const r: any = await api('POST', '/settings/domains', { domains: domains.value }); ok('Сохранено', `Доменов: ${r.email_domains.length}`); await load() } finally { busy.value = '' } }
async function test() { busy.value = 't'; try { await api('POST', '/settings/mail-test', { to: to.value }); ok('Письмо отправлено', 'Проверьте входящие и «Спам»') } finally { busy.value = '' } }
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Сервис</span><h1>Настройки</h1></div></div>
  <div v-if="s" class="grid g2" style="align-items:start">
    <div class="panel grid">
      <h2>Почта для регистрации</h2>
      <p class="muted" style="margin:0">Зарегистрироваться можно только с почтой этих доменов — временные и одноразовые адреса не пройдут. По одному на строку. Пустой список — принимать любые.</p>
      <Textarea v-model="domains" rows="12" class="mono" auto-resize fluid />
      <div><Button label="Сохранить список" :loading="busy === 'd'" @click="saveDomains" /></div>
      <p class="muted" style="margin:0;font-size:13px">Уже зарегистрированных это не касается.</p>
    </div>
    <div class="panel grid">
      <h2>Отправка писем</h2>
      <dl class="kv">
        <dt>Режим</dt><dd><Tag :value="s.mail.provider === 'unisender' ? 'Unisender Go — письма уходят' : 'log — письма НЕ уходят'" :severity="s.mail.provider === 'unisender' ? 'success' : 'danger'" /></dd>
        <dt>Отправитель</dt><dd class="mono">{{ s.mail.from }}</dd>
        <dt>Коды на экране</dt><dd>{{ s.mail.codes_on_screen ? 'да (стенд без почты)' : 'нет — только письмом' }}</dd>
        <dt>Адрес сайта в письмах</dt><dd class="mono">{{ s.mail.site_url || 'не задан (NUXT_PUBLIC_SITE_URL)' }}</dd>
        <dt>Уведомления команде</dt><dd class="mono">{{ s.mail.admin_notify || 'не заданы (NUXT_ADMIN_NOTIFY_EMAIL)' }}</dd>
      </dl>
      <Message v-if="s.mail.provider !== 'unisender'" severity="warn" size="small">
        Письма сейчас не отправляются: {{ s.mail.configured_provider !== 'unisender' ? 'NUXT_MAIL_PROVIDER не равен unisender' : 'нет NUXT_UNISENDER_KEY' }}. Поэтому коды показываются в окне на сайте. Задайте переменные в Render и перезапустите сервис.
      </Message>
      <div class="field"><label>Тестовое письмо на адрес</label><div style="display:flex;gap:8px;flex-wrap:wrap"><InputText v-model="to" placeholder="you@gmail.com" style="flex:1;min-width:200px" /><Button label="Отправить" :loading="busy === 't'" :disabled="!to" @click="test" /></div></div>
    </div>
  </div>
  <div v-if="s" class="panel grid" style="margin-top:16px">
    <h2>Лимиты расходов и бонус</h2>
    <p class="muted" style="margin:0">Лимит считается за месяц с первой покупки: через месяц обнуляется, следующая покупка открывает новый период. Возвраты возвращают лимит. Пустое поле — без лимита.</p>
    <div class="grid g3" style="gap:12px">
      <div class="field"><label>Без верификации, ₽ в месяц</label><InputText v-model="lim.unverified_rub" inputmode="decimal" placeholder="без лимита" fluid /></div>
      <div class="field"><label>После верификации, ₽ в месяц</label><InputText v-model="lim.verified_rub" inputmode="decimal" placeholder="без лимита" fluid /></div>
      <div class="field"><label>Бонус за верификацию, ₽</label><InputText v-model="lim.kyc_bonus_rub" inputmode="decimal" placeholder="0 — не начислять" fluid /></div>
    </div>
    <div><Button label="Сохранить" :loading="busy === 'l'" @click="saveLimits" /></div>
  </div>
  <div v-if="s" class="grid g2" style="align-items:start;margin-top:16px">
    <div class="panel grid">
      <h2>Контакты на сайте</h2>
      <p class="muted" style="margin:0">Показываются в шапке, подвале, на странице поддержки и в кабинете. Для Telegram и Max — имя аккаунта без @.</p>
      <div class="field"><label>Почта поддержки</label><InputText v-model="contacts.email" placeholder="support@vexel.ru" fluid /></div>
      <div class="field"><label>Telegram</label><InputGroup><InputGroupAddon>t.me/</InputGroupAddon><InputText v-model="contacts.telegram" placeholder="vexel_support" /></InputGroup></div>
      <div class="field"><label>Max</label><InputGroup><InputGroupAddon>max.ru/</InputGroupAddon><InputText v-model="contacts.max" placeholder="vexel_support" /></InputGroup></div>
      <div><Button label="Сохранить контакты" :loading="busy === 'c'" @click="saveContacts" /></div>
    </div>
    <div class="panel grid">
      <h2>Новая редакция документа</h2>
      <p class="muted" style="margin:0">После публикации все пользователи получат уведомление, а перед следующей покупкой их попросят принять новую редакцию. Дата согласия сохраняется.</p>
      <div class="field"><label>Документ</label><Select v-model="doc.kind" :options="Object.entries(KIND).map(([v, l]) => ({ v, l }))" option-label="l" option-value="v" fluid /></div>
      <div class="grid g2" style="gap:12px">
        <div class="field"><label>Версия</label><InputText v-model="doc.version" placeholder="например, 2.4" fluid /></div>
        <div class="field"><label>Название</label><InputText v-model="doc.title" :placeholder="KIND[doc.kind]" fluid /></div>
      </div>
      <div class="field"><label>Что изменилось (увидит пользователь)</label><Textarea v-model="doc.note" rows="2" auto-resize fluid maxlength="500" /></div>
      <div class="field"><label>PDF-файл</label>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <Button :label="doc.file ? 'Другой файл' : 'Выбрать PDF'" icon="pi pi-upload" severity="secondary" outlined size="small" @click="fileInput?.click()" />
          <span class="muted" style="font-size:13px">{{ doc.file ? doc.file.name + ' · ' + (doc.file.size / 1048576).toFixed(1) + ' МБ' : 'не выбран' }}</span>
          <Button v-if="doc.file" icon="pi pi-times" text severity="secondary" size="small" aria-label="Убрать файл" @click="doc.file = null; fileInput && (fileInput.value = '')" />
        </div>
        <input ref="fileInput" type="file" accept="application/pdf" hidden @change="(ev: any) => doc.file = ev.target.files?.[0] || null" /></div>
      <div v-if="!doc.file" class="field"><label>…или ссылка</label><InputText v-model="doc.url" placeholder="/tariffs.html или https://…" fluid /></div>
      <div><Button label="Опубликовать" :loading="busy === 'p'" :disabled="!doc.version || (!doc.file && !doc.url)" @click="publish" /></div>
    </div>
  </div>
  <div v-if="s" class="panel" style="margin-top:16px">
    <h2>Документы</h2>
    <DataTable :value="s.documents" size="small">
      <Column header="Документ"><template #body="{ data }">{{ data.title }}<div class="muted" style="font-size:12px">{{ KIND[data.kind] }}</div></template></Column>
      <Column header="Версия"><template #body="{ data }"><span class="mono">{{ data.version }}</span> <Tag v-if="data.current" value="Действует" severity="success" /></template></Column>
      <Column header="Опубликована"><template #body="{ data }">{{ dt(data.published_at) }}<div v-if="data.published_by_name" class="muted" style="font-size:12px">{{ data.published_by_name }}</div></template></Column>
      <Column header="Приняли"><template #body="{ data }">{{ data.accepted }} из {{ s.users_total }}</template></Column>
      <Column header="Что изменилось"><template #body="{ data }"><span class="muted">{{ data.note || '—' }}</span></template></Column>
      <Column><template #body="{ data }"><a :href="data.url" target="_blank" rel="noopener">Открыть</a></template></Column>
    </DataTable>
  </div>
</template>
