import { fileURLToPath } from 'node:url'
import Vexel from './app/theme/vexel'

const root = fileURLToPath(new URL('..', import.meta.url))
// Vercel: бета-стенд — secure-cookie, коды на экране, загрузки до 4,4 МБ, сборка в корень репозитория (.vercel/output)
const onVercel = !!process.env.VERCEL
const beta = onVercel || process.env.NUXT_PUBLIC_BETA === 'true'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  ssr: true,
  modules: ['@primevue/nuxt-module'],
  primevue: {
    options: { theme: { preset: Vexel, options: { darkModeSelector: '.mc-dark', cssLayer: false } }, ripple: false },
    components: { include: '*' },
    directives: { include: ['Tooltip'] },
  },
  css: ['primeicons/primeicons.css', '~/assets/admin.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
      link: [{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
             { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Fira+Code:wght@400;500;600;700&display=swap' }],
    },
  },
  routeRules: { '/admin/**': { ssr: false }, '/admin': { ssr: false } },
  runtimeConfig: {
    databaseUrl: '',            // NUXT_DATABASE_URL (или DATABASE_URL)
    secret: '',                 // NUXT_SECRET — HMAC кодов и ключ шифрования выдач
    mailProvider: 'log',        // NUXT_MAIL_PROVIDER: log | unisender
    unisenderKey: '',           // NUXT_UNISENDER_KEY
    unisenderUrl: 'https://goapi.unisender.ru/ru/transactional/api/v1', // NUXT_UNISENDER_URL (или go1/go2 — как в кабинете)
    mailFrom: 'noreply@vexel.ru',
    mailFromName: 'Vexel',
    paymentProvider: 'test',    // NUXT_PAYMENT_PROVIDER: test | … (боевой — позже)
    cookieSecure: onVercel,     // NUXT_COOKIE_SECURE=true за HTTPS
    devCodes: beta,             // NUXT_DEV_CODES=true — код приходит в ответе API (только стенд)
    adminNotifyEmail: '',       // NUXT_ADMIN_NOTIFY_EMAIL — куда слать о новых заказах, KYC и возвратах
    public: { siteUrl: '', beta, uploadMax: onVercel ? 4_400_000 : 0 },    // NUXT_PUBLIC_SITE_URL — для ссылок в письмах, напр. https://vexel.onrender.com
  },
  nitro: {
    // на Vercel кладём результат туда, где его ищет платформа: <repo>/.vercel/output
    ...(onVercel ? { output: { dir: root + '.vercel/output' } } : {}),
    // на Vercel кладём результат туда, где его ищет платформа: <repo>/.vercel/output
    ...(onVercel ? { output: { dir: root + '.vercel/output' }, vercel: { config: { crons: [{ path: '/api/cron/rate', schedule: '0 5 * * *' }] } as any } } : {}),
    // прототип отдаётся как статика; API — /api/*; админка — /admin (Nuxt + PrimeVue)
    // общая страница сервиса для товаров из админки (см. server/routes/service)
    serverAssets: [{ baseName: 'tpl', dir: root + '_proto/service/_new' }],
    publicAssets: [
      { dir: root + '_proto', baseURL: '/', maxAge: 0 },
      { dir: root + 'source-site/assets', baseURL: '/assets', maxAge: 60 * 60 * 24 },
    ],
  },
})
