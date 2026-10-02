<script setup lang="ts">
import logo from '~/assets/logo.svg?url'
const { me } = useAdm()
const f = reactive({ login: '', password: '', busy: false, err: '' })
async function submit() {
  f.busy = true; f.err = ''
  try {
    await $fetch('/api/admin/auth/login', { method: 'POST', body: { login: f.login, password: f.password } })
    const r: any = await $fetch('/api/admin/auth/me'); me.value = { admin: r.admin, perms: r.perms }
    await navigateTo('/admin')
  } catch (e: any) { f.err = e?.data?.message || 'Не удалось войти' } finally { f.busy = false }
}
</script>
<template>
  <div class="login-wrap">
    <form class="panel login" @submit.prevent="submit">
      <div class="login-head"><img :src="logo" alt=""><div><span>vexel admin</span><h1>login:</h1></div></div>
      <div class="field"><label for="l">Логин</label><InputText id="l" v-model="f.login" autocomplete="username" autofocus fluid /></div>
      <div class="field"><label for="p">Пароль</label><Password input-id="p" v-model="f.password" :feedback="false" toggle-mask fluid autocomplete="current-password" /></div>
      <Message v-if="f.err" severity="error" size="small">{{ f.err }}</Message>
      <Button type="submit" label="Войти" :loading="f.busy" />
      <p class="muted" style="margin:0;font-size:13px">На время разработки: admin / admin. После входа смените пароль.</p>
    </form>
  </div>
</template>
