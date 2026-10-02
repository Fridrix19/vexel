<script setup lang="ts">
const { api, ok } = useAdm()
const emit = defineEmits(['changed'])
const route = useRoute()
const r = ref<any>(null), reason = ref(''), birth = ref(''), busy = ref('')
const REASONS = ['Фото размыто или обрезано', 'Не виден разворот с фото', 'Нужно селфи с документом', 'Документ недействителен', 'Данные не совпадают с аккаунтом']
async function load() { r.value = await api('GET', '/kyc/' + route.params.id) }
onMounted(load)
const s = computed(() => r.value?.submission)
const fileUrl = (f: any) => `/api/admin/kyc/${s.value.id}/file/${f.id}`
async function decide(action: string) {
  busy.value = action
  try {
    await api('POST', `/kyc/${s.value.id}/decide`, { action, reason: reason.value, birth_date: birth.value || null })
    ok(action === 'approve' ? 'Верификация одобрена' : 'Отклонено — пользователь увидит причину'); emit('changed')
    const next: any = await api('GET', '/kyc?status=pending')
    const n = next.submissions.find((x: any) => x.id !== s.value.id)
    if (n) { await navigateTo('/admin/kyc/' + n.id); reason.value = ''; birth.value = ''; await load() } else navigateTo('/admin/kyc')
  } finally { busy.value = '' }
}
</script>
<template>
  <div v-if="s">
    <div class="adm-head"><div><span class="eyebrow"><NuxtLink to="/admin/kyc">Верификация</NuxtLink></span><h1>{{ s.email }}</h1></div><Tag :value="KYC_ST[s.status][0]" :severity="KYC_ST[s.status][1]" /></div>
    <div class="grid g-wide">
      <div class="grid">
        <div v-for="f in r.files" :key="f.id" class="panel">
          <div class="adm-head" style="margin-bottom:10px"><span class="mono muted">{{ f.name }} · {{ (f.size_bytes / 1024 / 1024).toFixed(1) }} МБ</span><a :href="fileUrl(f)" target="_blank" rel="noopener">Открыть отдельно</a></div>
          <img v-if="f.mime.startsWith('image/') && f.mime !== 'image/heic'" :src="fileUrl(f)" class="kyc-img" alt="Документ" />
          <p v-else class="muted">Файл {{ f.mime }} — откройте отдельно.</p>
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="panel"><dl class="kv kv-narrow">
          <dt>Имя</dt><dd>{{ s.name || '—' }}</dd><dt>Аккаунт с</dt><dd>{{ d(s.user_created) }}</dd><dt>Отправлено</dt><dd>{{ dt(s.created_at) }}</dd>
          <dt>Профиль</dt><dd><NuxtLink :to="'/admin/users/' + s.user_id">открыть</NuxtLink></dd>
          <template v-if="s.status !== 'pending'"><dt>Решение</dt><dd>{{ dt(s.reviewed_at) }}{{ s.reason ? ' · ' + s.reason : '' }}</dd></template>
        </dl></div>
        <div v-if="s.status === 'pending'" class="panel grid">
          <h2>Решение</h2>
          <div class="field"><label>Дата рождения из документа (необязательно)</label><InputText v-model="birth" type="date" fluid /></div>
          <Button label="Одобрить" icon="pi pi-check" severity="success" :loading="busy === 'approve'" @click="decide('approve')" />
          <div class="field"><label>Причина отказа — её увидит пользователь</label>
            <div class="row-actions"><Button v-for="x in REASONS" :key="x" :label="x" size="small" severity="secondary" outlined @click="reason = x" /></div>
            <Textarea v-model="reason" rows="2" auto-resize fluid /></div>
          <Button label="Отклонить" icon="pi pi-times" severity="danger" outlined :disabled="!reason.trim()" :loading="busy === 'reject'" @click="decide('reject')" />
        </div>
        <div v-if="r.history.length" class="panel"><h3 style="margin-bottom:8px">Предыдущие попытки</h3>
          <p v-for="h in r.history" :key="h.id" style="margin:6px 0"><Tag :value="KYC_ST[h.status][0]" :severity="KYC_ST[h.status][1]" /> {{ dt(h.created_at) }}<span v-if="h.reason" class="muted"> · {{ h.reason }}</span></p></div>
      </div>
    </div>
  </div>
</template>
