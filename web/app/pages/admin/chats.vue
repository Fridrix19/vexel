<script setup lang="ts">
// чаты с клиентами как в мессенджере: слева очередь, справа переписка; новые сообщения подтягиваются сами
const { api, ok, warn, can } = useAdm()
const route = useRoute(), router = useRouter()
const filter = ref<'waiting' | 'all' | 'closed'>('waiting'), q = ref(''), threads = ref<any[]>([]), counts = ref<any>({})
const cur = ref<any>(null), msgs = ref<any[]>([]), other = ref<any[]>([]), text = ref(''), file = ref<File | null>(null), busy = ref(false)
const box = ref<HTMLElement | null>(null), fileIn = ref<HTMLInputElement | null>(null)
const id = computed(() => (route.query.id as string) || null)

async function loadList() {
  const r: any = await api('GET', `/chats?filter=${filter.value}&q=${encodeURIComponent(q.value)}`, undefined, { quiet: true }).catch(() => null)
  if (r) { threads.value = r.threads; counts.value = r.counts }
}
async function openThread(tid: string | null, poll = false) {
  if (!tid) { cur.value = null; msgs.value = []; return }
  const after = poll && msgs.value.length ? msgs.value[msgs.value.length - 1].id : 0
  const r: any = await api('GET', `/chats/${tid}?after=${after}`, undefined, { quiet: poll }).catch(() => null)
  if (!r) return
  cur.value = r.thread; other.value = r.other
  const atBottom = !box.value || box.value.scrollHeight - box.value.scrollTop - box.value.clientHeight < 80
  msgs.value = poll ? msgs.value.concat(r.messages) : r.messages
  if (!poll || (r.messages.length && atBottom)) nextTick(() => { if (box.value) box.value.scrollTop = box.value.scrollHeight })
}
function pick(t: any) { router.replace({ query: { id: t.id } }) }
watch(id, v => { text.value = ''; file.value = null; openThread(v) }, { immediate: true })
watch(filter, loadList)
let qt: any; watch(q, () => { clearTimeout(qt); qt = setTimeout(loadList, 300) })
let t1: any, t2: any
onMounted(() => {
  loadList()
  t1 = setInterval(() => { if (document.visibilityState === 'visible') loadList() }, 10000)
  t2 = setInterval(() => { if (document.visibilityState === 'visible' && id.value) openThread(id.value, true) }, 4000)
})
onUnmounted(() => { clearInterval(t1); clearInterval(t2) })

async function send() {
  if (!cur.value || (!text.value.trim() && !file.value)) return
  busy.value = true
  try {
    let body: any = { text: text.value }
    const lim = Number((useRuntimeConfig().public as any).uploadMax) || 0
    if (lim && file.value && file.value.size > lim) { warn('Файл слишком большой', 'На бета-стенде файлы — до 4 МБ.'); return }
    if (file.value) { body = new FormData(); body.append('text', text.value); body.append('file', file.value) }
    const r: any = await api('POST', `/chats/${cur.value.id}/send`, body)
    msgs.value.push(r.message); text.value = ''; file.value = null; if (fileIn.value) fileIn.value.value = ''
    nextTick(() => { if (box.value) box.value.scrollTop = box.value.scrollHeight })
    loadList()
  } finally { busy.value = false }
}
function onKey(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
async function toggleClose() {
  await api('POST', `/chats/${cur.value.id}/close`, { closed: cur.value.status !== 'closed' })
  ok(cur.value.status === 'closed' ? 'Чат открыт' : 'Чат закрыт'); await openThread(cur.value.id); loadList()
}
const who = (t: any) => t.name || t.username
const time = (v: any) => { const d0 = new Date(v), now = new Date(); return d0.toDateString() === now.toDateString() ? d0.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : d0.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }
const isImg = (f: any) => f && /^image\//.test(f.mime)
const OST: Record<string, string> = { paid: 'Оплачен', in_work: 'В работе', need_info: 'Нужны данные', done: 'Исполнен', canceled: 'Отменён', refunded: 'Возврат' }
const crumbLabel = useCrumb()
watchEffect(() => { const v = cur.value && route.query.id ? (cur.value.name || cur.value.username || cur.value.email || 'Переписка') : ''; if (v) crumbLabel.value = v })
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Поддержка</span><h1>Чаты</h1></div><span class="muted">ждут ответа: {{ counts.waiting ?? 0 }}</span></div>
  <div class="chat" :class="{ 'has-cur': !!id }">
    <aside class="chat-list panel">
      <div class="chat-filters">
        <Button v-for="[k, l] in [['waiting', 'Ждут ответа'], ['all', 'Все'], ['closed', 'Закрытые']]" :key="k" :label="l + (k === 'waiting' && counts.waiting ? ' · ' + counts.waiting : '')" size="small" :severity="filter === k ? undefined : 'secondary'" :text="filter !== k" @click="filter = k as any" />
      </div>
      <IconField><InputIcon class="pi pi-search" /><InputText v-model="q" placeholder="Почта, логин, заказ" fluid size="small" /></IconField>
      <div class="chat-items">
        <button v-for="t in threads" :key="t.id" type="button" class="chat-item" :class="{ on: t.id === id, wait: t.last_from === 'user' && t.status === 'open' }" @click="pick(t)">
          <span class="ci-top"><b>{{ who(t) }}</b><span class="muted">{{ time(t.last_message_at) }}</span></span>
          <span class="ci-sub">{{ t.order_id ? t.product_name + ' · ' + t.order_id : 'Общий вопрос' }}</span>
          <span class="ci-last"><span class="muted">{{ t.last_from === 'admin' ? 'Вы: ' : '' }}{{ t.last_text }}</span><span v-if="t.unread_admin" class="ci-n">{{ t.unread_admin }}</span></span>
        </button>
        <p v-if="!threads.length" class="muted" style="padding:12px">{{ filter === 'waiting' ? 'Все ответили — новых сообщений нет.' : 'Чатов нет.' }}</p>
      </div>
    </aside>
    <section class="chat-view panel">
      <template v-if="cur">
        <header class="cv-head">
          <Button icon="pi pi-arrow-left" text severity="secondary" class="cv-back" aria-label="К списку" @click="router.replace({ query: {} })" />
          <div class="cv-who">
            <b>{{ cur.name || cur.username }}</b> <NuxtLink v-if="can('users')" :to="'/admin/users/' + cur.user_id" class="muted" style="font-size:13px">{{ cur.email }}</NuxtLink>
            <div class="muted" style="font-size:13px">
              <template v-if="cur.order_id"><NuxtLink :to="'/admin/orders/' + cur.order_id" class="mono">{{ cur.order_id }}</NuxtLink> · {{ cur.product_name }} {{ cur.plan_label }} · {{ OST[cur.order_status] || cur.order_status }} · {{ kop(cur.amount_kop) }}</template>
              <template v-else>Общий вопрос</template>
              <template v-if="cur.telegram"> · <a :href="'https://t.me/' + cur.telegram" target="_blank" rel="noopener">@{{ cur.telegram }}</a></template>
            </div>
          </div>
          <Tag v-if="cur.status === 'closed'" value="Закрыт" severity="secondary" />
          <Button :label="cur.status === 'closed' ? 'Открыть' : 'Закрыть'" size="small" severity="secondary" outlined @click="toggleClose" />
        </header>
        <div v-if="other.length" class="cv-other"><span class="muted">Другие чаты:</span> <a v-for="o in other" :key="o.id" href="#" @click.prevent="pick(o)">{{ o.title }}<i v-if="o.last_from === 'user' && o.status === 'open'" class="dot" /></a></div>
        <div ref="box" class="cv-msgs">
          <div v-for="m in msgs" :key="m.id" class="msg" :class="m.author">
            <div class="bubble">
              <div v-if="m.text" class="t">{{ m.text }}</div>
              <a v-if="m.file" :href="m.file.url" target="_blank" rel="noopener" class="att"><img v-if="isImg(m.file)" :src="m.file.url" alt=""><span v-else><i class="pi pi-file-pdf" /> {{ m.file.name }}</span></a>
              <div class="meta">{{ m.author === 'admin' ? (m.admin_name || 'Поддержка') : 'Клиент' }} · {{ dt(m.created_at) }}</div>
            </div>
          </div>
        </div>
        <div class="cv-reply">
          <div v-if="file" class="muted" style="font-size:13px">📎 {{ file.name }} <Button icon="pi pi-times" text size="small" severity="secondary" aria-label="Убрать" @click="file = null; fileIn && (fileIn.value = '')" /></div>
          <div class="cv-row">
            <Button icon="pi pi-paperclip" text severity="secondary" aria-label="Прикрепить файл" @click="fileIn?.click()" />
            <input ref="fileIn" type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" @change="(e: any) => file = e.target.files?.[0] || null">
            <Textarea v-model="text" rows="1" auto-resize placeholder="Ответ клиенту… (Enter — отправить, Shift+Enter — новая строка)" class="grow" @keydown="onKey" />
            <Button icon="pi pi-send" :loading="busy" :disabled="!text.trim() && !file" aria-label="Отправить" @click="send" />
          </div>
        </div>
      </template>
      <div v-else class="cv-empty muted"><i class="pi pi-comments" style="font-size:28px" /><p>Выберите чат слева. Клиент пишет из карточки заказа или из раздела «Поддержка» в кабинете.</p></div>
    </section>
  </div>
</template>
<style scoped>
.chat { display:grid; grid-template-columns:minmax(260px, 340px) minmax(0, 1fr); gap:14px; height:calc(100vh - 230px); min-height:520px }
.chat-list { display:flex; flex-direction:column; gap:10px; padding:12px; min-height:0 }
.chat-filters { display:flex; flex-wrap:wrap; gap:4px }
.chat-items { overflow:auto; display:flex; flex-direction:column; gap:4px; min-height:0; margin:0 -6px; padding:0 6px }
.chat-item { display:grid; gap:2px; text-align:left; background:none; border:1px solid transparent; border-radius:10px; padding:9px 10px; cursor:pointer; color:inherit; font:inherit }
.chat-item:hover { background:var(--ink-800, rgba(255,255,255,.03)) }
.chat-item.on { border-color:var(--p-primary-color); background:color-mix(in oklab, var(--p-primary-color) 10%, transparent) }
.chat-item.wait .ci-top b::after { content:''; display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--warn); margin-left:6px; vertical-align:middle }
.ci-top { display:flex; justify-content:space-between; gap:8px; font-size:14px } .ci-top b { color:var(--text) } .ci-top .muted { font-size:12px; flex:none }
.ci-sub { font-size:12px; color:var(--text-2) }
.ci-last { display:flex; justify-content:space-between; gap:8px; font-size:13px } .ci-last .muted { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.ci-n { flex:none; min-width:20px; height:20px; border-radius:10px; background:var(--p-primary-color); color:#fff; font:600 11px var(--mono); display:grid; place-items:center; padding:0 6px }
.chat-view { display:flex; flex-direction:column; min-height:0; padding:0; overflow:hidden }
.cv-head { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--line) }
.cv-who { flex:1; min-width:0 } .cv-who b { color:var(--text) }
.cv-back { display:none }
.cv-other { padding:6px 14px; font-size:13px; border-bottom:1px solid var(--line); display:flex; gap:10px; flex-wrap:wrap }
.cv-other .dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--warn); margin-left:4px; vertical-align:middle }
.cv-msgs { flex:1; overflow:auto; padding:14px; display:flex; flex-direction:column; gap:8px }
.msg { display:flex } .msg.admin { justify-content:flex-end }
.bubble { max-width:min(560px, 80%); padding:9px 12px; border-radius:14px; background:var(--ink-800, #1b2130); border:1px solid var(--line) }
.msg.admin .bubble { background:color-mix(in oklab, var(--p-primary-color) 22%, var(--ink-900, #121722)); border-color:color-mix(in oklab, var(--p-primary-color) 40%, var(--line)) }
.bubble .t { white-space:pre-wrap; overflow-wrap:anywhere; color:var(--text); font-size:14.5px }
.bubble .meta { font-size:11px; color:var(--text-3); margin-top:4px }
.att { display:block; margin-top:6px } .att img { max-width:260px; max-height:220px; border-radius:8px; display:block }
.cv-reply { border-top:1px solid var(--line); padding:10px 12px; display:grid; gap:4px }
.cv-row { display:flex; gap:8px; align-items:flex-end } .cv-row .grow { flex:1 }
.cv-empty { flex:1; display:grid; place-items:center; text-align:center; padding:30px; align-content:center; gap:8px }
@media (max-width: 860px) {
  .chat { grid-template-columns:minmax(0,1fr); height:auto; min-height:0 }
  .chat.has-cur .chat-list { display:none } .chat:not(.has-cur) .chat-view { display:none }
  .chat-view { height:calc(100dvh - 290px); min-height:420px } .cv-back { display:inline-flex }
}
</style>
