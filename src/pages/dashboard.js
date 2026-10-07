(function(){
  'use strict';
  var $ = MC.$, RATE = MC.RATE, BASE = window.MC_BASE || '';
  var rub = MC.rub, esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); };
  var usdf = function(u){ return '$' + (Math.abs(u - Math.round(u)) < 1e-9 ? u : u.toFixed(2)); };
  function ago(d, h){ var t = new Date(); t.setDate(t.getDate() - (d || 0)); if (h != null) t.setHours(h, (d * 7 + 13) % 60, 0, 0); return t; }
  function fmtD(t, withTime){ t = new Date(t); var s = t.toLocaleString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''); return withTime ? s + ', ' + t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : s; }
  function ico(id){ return '<svg><use href="#i-' + id + '"/></svg>'; }
  function svc(name){ var c = MC.CATALOG.services; for (var i = 0; i < c.length; i++) if (c[i].n === name) return c[i]; return null; }
  function svcImg(name, cls){ var s = svc(name); return s ? '<img class="' + (cls || 'ord-ico') + (s.d ? ' on-dark' : '') + '" src="' + s.l + '" alt="">' : ''; }
  function svcHref(name){ var s = svc(name); return s ? BASE + s.h : BASE + 'catalog.html'; }
  var VCP = null, VMIN = 50, VMAX = 200;   // цены карты с сервера (курс и комиссия из админки)
  function total(u){ return VCP ? VCP.total(u) : MC.charged(u) * RATE; }
  function rate(){ return VCP ? VCP.rate : RATE; }
  function amt(o){ return o.rubv != null ? o.rubv : total(o.usd); }
  function money(o){ return o.rubv != null ? MC.kop(Math.round(o.rubv * 100)) : rub(total(o.usd)); }

  /* ——— сессия ——— */
  var session = null; try { session = JSON.parse(localStorage.getItem('mc-session') || 'null'); } catch (e) {}
  var USER = { name: 'Алексей', id: (session && session.id) || '+7 900 ···-··-77', email: 'f•••••c@gmail.com', phone: '+7 900 ···-··-77', kyc: 'basic', mfa: false, since: ago(310) };
  if (/@/.test(USER.id)) USER.email = USER.id.replace(/^(.).*(.@.*)$/, '$1•••••$2'); else USER.phone = USER.id;
  var demo = !session, LIVE = false, BAL = 0;

  /* ——— данные прототипа ——— */
  var CARDS = [
    { id: 'c1', last4: '4821', brand: 'Visa', status: 'active', balance: 74.30, exp: '09/27', issued: ago(112), pan: '4400 1234 5678 4821', cvv: '731' },
    { id: 'c2', last4: '0157', brand: 'Mastercard', status: 'frozen', balance: 0, exp: '03/27', issued: ago(240), pan: '5536 9100 2244 0157', cvv: '208' }
  ];
  var ORDERS = [
    { id: 'VX-1042', kind: 'topup', title: 'Пополнение карты', sub: 'Visa •• 4821', usd: 150, status: 'action', created: ago(0, 10), card: 'c1', pay: 'P-5581',
      action: { text: 'Для суммы от $150 нужна расширенная верификация', btn: 'Пройти', go: 'kyc' },
      tl: [['Заказ создан', ago(0, 10), 'ok'], ['Оплачен через СБП', ago(0, 10), 'ok', 'Платёж P-5581 · ' + rub(total(150))], ['Верификация', null, 'warn', 'Ждём подтверждение личности — займёт 3–5 минут'], ['Зачисление на карту', null, 'todo']] },
    { id: 'VX-1041', kind: 'svc', svc: 'ChatGPT Plus', title: 'ChatGPT Plus', sub: 'Plus · $20/month', usd: 20, status: 'work', created: ago(0, 9), pay: 'P-5579',
      tl: [['Заказ создан', ago(0, 9), 'ok'], ['Оплачен через СБП', ago(0, 9), 'ok', 'Платёж P-5579 · ' + rub(total(20))], ['Оформляем подписку', null, 'cur', 'Обычно 10–30 минут в рабочее время'], ['Доступ выдан', null, 'todo']] },
    { id: 'VX-1040', kind: 'svc', svc: 'Midjourney', title: 'Midjourney', sub: 'Standard · $30/мес', usd: 30, status: 'new', created: ago(1, 18), pay: 'P-5570',
      tl: [['Заказ создан', ago(1, 18), 'ok'], ['Оплата', null, 'cur', 'Расчёт действует ещё 40 минут'], ['Оформляем подписку', null, 'todo'], ['Доступ выдан', null, 'todo']] },
    { id: 'VX-1039', kind: 'svc', svc: 'Cursor AI', title: 'Cursor Pro', sub: 'Pro · $20/month', usd: 20, status: 'done', created: ago(6, 12), done: ago(6, 13), pay: 'P-5544', cred: 'Подписка активирована на вашем аккаунте Cursor. Письмо с подтверждением — на ' + USER.email + '.',
      tl: [['Заказ создан', ago(6, 12), 'ok'], ['Оплачен через СБП', ago(6, 12), 'ok'], ['Подписка оформлена', ago(6, 13), 'ok'], ['Доступ выдан', ago(6, 13), 'ok', 'Акт сформирован']] },
    { id: 'VX-1033', kind: 'issue', title: 'Выпуск карты', sub: 'Visa •• 4821 · $50', usd: 50, status: 'done', created: ago(112, 15), done: ago(112, 15), pay: 'P-5210', card: 'c1', cred: 'Карта выпущена и пополнена на $50. Реквизиты — в разделе «Мои карты».',
      tl: [['Заказ создан', ago(112, 15), 'ok'], ['Оплачен', ago(112, 15), 'ok'], ['Карта выпущена', ago(112, 15), 'ok'], ['Зачислено $50', ago(112, 15), 'ok']] },
    { id: 'VX-1028', kind: 'svc', svc: 'Spotify', title: 'Spotify', sub: 'Individual · $12/month', usd: 12, status: 'refund', created: ago(40, 11), pay: 'P-5120', refund: 'R-118',
      tl: [['Заказ создан', ago(40, 11), 'ok'], ['Оплачен', ago(40, 11), 'ok'], ['Не удалось оформить', ago(40, 14), 'err', 'Сервис отклонил регион аккаунта'], ['Возврат выполнен', ago(38, 10), 'ok', 'R-118 · ' + rub(total(12)) + ' тем же способом']] },
    { id: 'VX-1021', kind: 'svc', svc: 'Netflix', title: 'Netflix', sub: 'Standard · $16/month', usd: 16, status: 'cancel', created: ago(75, 20),
      tl: [['Заказ создан', ago(75, 20), 'ok'], ['Отменён до оплаты', ago(75, 21), 'err', 'Отменили вы']] }
  ];
  var PAYMENTS = [
    { id: 'P-5581', order: 'VX-1042', method: 'СБП', rubv: total(150), status: 'ok', at: ago(0, 10) },
    { id: 'P-5579', order: 'VX-1041', method: 'СБП', rubv: total(20), status: 'ok', at: ago(0, 9) },
    { id: 'P-5570', order: 'VX-1040', method: 'СБП', rubv: total(30), status: 'pending', at: ago(1, 18) },
    { id: 'P-5544', order: 'VX-1039', method: 'СБП', rubv: total(20), status: 'ok', at: ago(6, 12) },
    { id: 'P-5210', order: 'VX-1033', method: 'Карта РФ', rubv: total(50), status: 'ok', at: ago(112, 15) },
    { id: 'P-5120', order: 'VX-1028', method: 'СБП', rubv: total(12), status: 'refunded', at: ago(40, 11) }
  ];
  var REFUNDS = [{ id: 'R-118', pay: 'P-5120', order: 'VX-1028', why: 'Сервис не подключился', rubv: total(12), status: 'done', at: ago(40, 14), doneAt: ago(38, 10) }];
  var TICKETS = [
    { id: 'T-207', subj: 'Не вижу подписку в аккаунте ChatGPT', order: 'VX-1041', status: 'answered', at: ago(0, 9),
      msgs: [{ me: 1, t: 'Оплатил заказ час назад, в аккаунте пока бесплатный план. Это нормально?', at: ago(0, 9) }, { me: 0, t: 'Здравствуйте! Да, заказ VX-1041 у нас в работе — оформление занимает до 30 минут. Как только подписка активируется, статус заказа изменится, а на почту придёт письмо.', at: ago(0, 9) }] },
    { id: 'T-198', subj: 'Возврат за Spotify', order: 'VX-1028', status: 'closed', at: ago(40, 14),
      msgs: [{ me: 1, t: 'Заказ не оформился, хочу вернуть деньги.', at: ago(40, 14) }, { me: 0, t: 'Оформили возврат R-118 на платёж P-5120. Деньги вернутся тем же способом в течение 1–3 дней.', at: ago(40, 15) }, { me: 0, t: 'Возврат выполнен. Обращение закрываем — если что, напишите снова.', at: ago(38, 10) }] }
  ];
  var DOCS = [
    { name: 'Оферта', ver: '2.3', at: ago(12, 14), href: BASE + 'legal-files/offer.pdf', hist: ['2.2 — принята ' + fmtD(ago(190)), '2.0 — принята ' + fmtD(ago(310))] },
    { name: 'Политика обработки персональных данных', ver: '1.4', at: ago(12, 14), href: BASE + 'legal-files/privacy.pdf', hist: ['1.3 — принята ' + fmtD(ago(310))] },
    { name: 'Тарифы и комиссии', ver: '1.0', at: ago(12, 14), href: BASE + 'tariffs.html', hist: [] }
  ];
  var SESSIONS = [
    { id: 's1', cur: 1, dev: 'Windows · Chrome', place: 'Москва', ip: '93.81.·.·', at: 'сейчас', icon: 'laptop' },
    { id: 's2', dev: 'iPhone · Safari', place: 'Москва', ip: '176.59.·.·', at: fmtD(ago(1), true), icon: 'phone' },
    { id: 's3', dev: 'Android · Chrome', place: 'Алматы', ip: '95.59.·.·', at: fmtD(ago(2), true), icon: 'phone', sus: 1 }
  ];
  var NOTIFS = [
    { t: 'Нужна верификация по заказу VX-1042', s: 'Сумма от $150 — подтвердите личность, займёт несколько минут', at: ago(0, 10), go: 'kyc', unread: 1 },
    { t: 'Ответ поддержки по обращению T-207', s: 'Заказ VX-1041 в работе, до 30 минут', at: ago(0, 9), go: 'support:T-207', unread: 1 },
    { t: 'Вход с нового устройства', s: 'Android · Chrome, Алматы. Это были не вы? Завершите сессию', at: ago(2), go: 'profile:sessions', unread: 1 },
    { t: 'Заказ VX-1040 ждёт оплаты', s: 'Midjourney Standard · расчёт зафиксирован', at: ago(1, 18), go: 'order:VX-1040' },
    { t: 'Cursor Pro оформлен', s: 'Доступ выдан, акт доступен в документах', at: ago(6, 13), go: 'order:VX-1039' }
  ];
  var ST = { new: ['Ожидает оплаты', 'badge-plain'], paid: ['Оплачен', 'badge-info'], work: ['В работе', 'badge-info'], action: ['Нужно действие', 'badge-warn'], done: ['Исполнен', 'badge-ok'], cancel: ['Отменён', 'badge-plain'], refund: ['Возврат', 'badge-plain'] };
  var PST = { ok: ['Проведён', 'badge-ok'], pending: ['Ожидает', 'badge-warn'], refunded: ['Возвращён', 'badge-plain'], failed: ['Отклонён', 'badge-err'] };
  var seq = 1043, pseq = 5582, tseq = 208, rseq = 119;

  function badge(pair){ return '<span class="badge ' + pair[1] + '">' + pair[0] + '</span>'; }
  function order(id){ for (var i = 0; i < ORDERS.length; i++) if (ORDERS[i].id === id) return ORDERS[i]; }
  function card(id){ for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i]; }
  function pay(id){ for (var i = 0; i < PAYMENTS.length; i++) if (PAYMENTS[i].id === id) return PAYMENTS[i]; }
  function isActive(o){ return o.status !== 'done' && o.status !== 'cancel' && o.status !== 'refund'; }
  function ordIcon(o){ return o.kind === 'svc' ? svcImg(o.svc) : '<span class="ord-ico vc">' + ico(o.kind === 'issue' ? 'plus' : 'card') + '</span>'; }
  function progress(o){ var n = o.tl.length, k = 0; o.tl.forEach(function(s){ if (s[2] === 'ok') k++; }); return Math.round(k / n * 100); }

  /* ——— тосты и модалки ——— */
  function toast(title, body, kind){
    var st = $('toasts'), t = document.createElement('div'); t.className = 'toast toast-' + (kind || 'info');
    t.innerHTML = ico(kind === 'ok' ? 'check' : kind === 'err' ? 'warn' : 'info') + '<div><b>' + esc(title) + '</b>' + esc(body || '') + '</div><button type="button" class="x" aria-label="Закрыть">×</button>';
    t.querySelector('.x').addEventListener('click', function(){ t.remove(); }); st.appendChild(t); setTimeout(function(){ t.remove(); }, 4500);
  }
  var lastFocus = null;
  function modal(o){
    lastFocus = document.activeElement;
    $('mTitle').textContent = o.title; $('mSub').textContent = o.sub || ''; $('mSub').hidden = !o.sub;
    $('mBody').innerHTML = o.body || ''; var f = $('mFoot'); f.innerHTML = '';
    (o.foot || [{ label: 'Закрыть' }]).forEach(function(b){
      var el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (b.cls || 'btn-ghost'); el.textContent = b.label;
      el.addEventListener('click', function(){ if (b.onClick && b.onClick(el) === false) return; if (!b.keep) closeModal(); }); f.appendChild(el);
    });
    $('modal').hidden = false; var first = $('mBody').querySelector('input,button,select,textarea'); (first || $('mClose')).focus();
    if (o.onOpen) o.onOpen();
  }
  function closeModal(){ $('modal').hidden = true; if (lastFocus) lastFocus.focus(); }
  $('mClose').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function(e){ if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

  /* 6 полей кода: возвращает разметку, wireOtp вешает поведение */
  function otpHtml(id){ var s = '<div class="otp" id="' + id + '">'; for (var i = 1; i <= 6; i++) s += '<input inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Цифра ' + i + '">'; return s + '</div>'; }
  function wireOtp(box, done){
    var ins = [].slice.call(box.querySelectorAll('input'));
    ins.forEach(function(inp, i){
      inp.addEventListener('input', function(){
        var v = inp.value.replace(/\D/g, ''); if (v.length > 1){ v.split('').slice(0, 6 - i).forEach(function(ch, k){ ins[i + k].value = ch; ins[i + k].classList.add('is-filled'); }); var n = Math.min(i + v.length, 5); ins[n].focus(); }
        else { inp.value = v; inp.classList.toggle('is-filled', !!v); if (v && i < 5) ins[i + 1].focus(); }
        var code = ins.map(function(x){ return x.value; }).join(''); if (code.length === 6) done(code, box, ins);
      });
      inp.addEventListener('keydown', function(e){ if (e.key === 'Backspace' && !inp.value && i > 0){ ins[i - 1].value = ''; ins[i - 1].classList.remove('is-filled'); ins[i - 1].focus(); } });
    });
    ins[0].focus();
  }
  /* step-up: подтверждение кодом перед чувствительным действием */
  function stepUp(title, sub, onOk){
    modal({ title: title, sub: sub || 'Код отправили на ' + USER.id + '. Прототип: подойдут любые 6 цифр, кроме 000000.', body: otpHtml('suBoxes') + '<p class="hint auth-center">Код действует 5 минут</p>', foot: [{ label: 'Отмена' }],
      onOpen: function(){ wireOtp($('suBoxes'), function(code, box){ if (code === '000000'){ box.classList.add('is-err'); setTimeout(function(){ box.classList.remove('is-err'); box.querySelectorAll('input').forEach(function(x){ x.value = ''; x.classList.remove('is-filled'); }); box.querySelector('input').focus(); }, 500); return; } box.classList.add('is-ok'); setTimeout(function(){ closeModal(); onOk(); }, 350); }); } });
  }

  /* ——— роутер ——— */
  var SCREENS = ['overview', 'new', 'orders', 'order', 'cards', 'favs', 'payments', 'kyc', 'profile', 'support', 'docs'];
  var cur = null;
  function go(id, param, opts){
    opts = opts || {};
    var navId = id === 'order' ? 'orders' : id;
    SCREENS.forEach(function(s){ var el = $('s-' + s); if (el) el.hidden = s !== id; });
    document.querySelectorAll('[data-go]').forEach(function(b){
      var on = b.getAttribute('data-go') === navId;
      if (b.closest('.cab-nav')) b.classList.toggle('is-active', on);
      if (b.closest('.cab-tabbar')){ if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    });
    var sc = $('s-' + id); if (sc && !MC.reduce){ sc.style.animation = 'none'; void sc.offsetWidth; sc.style.animation = ''; }
    var render = R[id]; if (render) render(param, opts);
    cur = id;
    var hash = '#' + id + (param ? ':' + param : '');
    if (location.hash !== hash) { if (opts.fromRoute) history.replaceState(null, '', hash); else history.pushState(null, '', hash); }
    setCrumbs(id, param);
    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    closeSheet();
  }
  function route(){ var h = location.hash.replace('#', ''), p = h.split(':'); if (SCREENS.indexOf(p[0]) < 0) p = ['overview']; go(p[0], p[1], { fromRoute: true }); }
  /* хлебные крошки кабинета: Главная › Личный кабинет › Раздел › Заказ */
  var CRUMB = { 'new': 'Новый заказ', orders: 'Мои заказы', order: 'Мои заказы', cards: 'Мои карты', favs: 'Избранное', payments: 'Платежи и возвраты', kyc: 'Верификация', profile: 'Профиль и безопасность', support: 'Поддержка', docs: 'Документы' };
  function setCrumbs(id, param){
    var bar = document.querySelector('.crumbbar'); if (!bar) return;
    var ol = bar.querySelector('.cb-list'), back = bar.querySelector('.cb-back'), base = window.MC_BASE || '';
    var items = [['Главная', base + 'index.html'], ['Личный кабинет', id === 'overview' ? null : '#overview']];
    if (id === 'order') { items.push(['Мои заказы', '#orders']); items.push(['Заказ ' + (param || ''), null]); }
    else if (CRUMB[id]) items.push([CRUMB[id], null]);
    ol.innerHTML = items.map(function(it){ return '<li>' + (it[1] ? '<a href="' + it[1] + '">' + it[0] + '</a>' : '<span aria-current="page">' + it[0] + '</span>') + '</li>'; }).join('');
    if (back) back.setAttribute('href', id === 'order' ? '#orders' : id === 'overview' ? base + 'index.html' : '#overview');
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-go]'); if (!b || b.closest('.tk')) return;
    e.preventDefault();
    var id = b.getAttribute('data-go'), p = id.split(':');
    if (b.getAttribute('data-prod')) W.prod = b.getAttribute('data-prod'), W.step = 1;
    go(p[0], p[1]);
  });
  window.addEventListener('hashchange', route);

  /* ——— мобильный лист «Ещё» ——— */
  var sheet = $('cabSheet'), more = $('cabMore');
  function openSheet(){ sheet.hidden = false; more.setAttribute('aria-expanded', 'true'); requestAnimationFrame(function(){ sheet.classList.add('in'); }); }
  function closeSheet(){ if (sheet.hidden) return; sheet.classList.remove('in'); more.setAttribute('aria-expanded', 'false'); setTimeout(function(){ sheet.hidden = true; }, MC.reduce ? 0 : 260); }
  more.addEventListener('click', function(){ sheet.hidden ? openSheet() : closeSheet(); });
  sheet.querySelectorAll('[data-cab-close]').forEach(function(el){ el.addEventListener('click', closeSheet); });

  /* ——— шапка: пользователь, счётчики ——— */
  function counters(){
    var act = ORDERS.filter(function(o){ return o.status === 'action' || o.status === 'new'; }).length + (USER.kyc === 'more' ? 1 : 0);
    var map = { action: act, orders: ORDERS.filter(isActive).length, cards: CARDS.filter(function(c){ return c.status === 'active'; }).length, tickets: LIVE ? CHAT_UNREAD : TICKETS.filter(function(t){ return t.status !== 'closed'; }).length, favs: FAVS.length };
    document.querySelectorAll('[data-cnt]').forEach(function(el){ var k = el.getAttribute('data-cnt'), v = map[k]; el.textContent = v || ''; el.classList.toggle('hot', k === 'action' && v > 0); });
    $('navKyc').textContent = { none: '!', basic: '', pending: '…', full: '✓', more: '!' }[USER.kyc] || '';
    $('bellDot').hidden = !NOTIFS.some(function(n){ return n.unread && orderNotif(n); });
    $('bell').title = $('bellDot').hidden ? 'Мои заказы' : 'Есть изменения в заказах';
    var hl = document.querySelector('.head-login'); if (hl && hl.lastChild) hl.lastChild.textContent = USER.name;
    $('uName').textContent = USER.name; $('uAvatar').textContent = USER.name.charAt(0).toUpperCase(); $('uId').textContent = USER.id; $('uId').title = demo ? 'Демо-режим: войдите, чтобы увидеть свои данные' : '';
    var hr = new Date().getHours(); $('hello').textContent = (hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер') + ', ' + USER.name;
  }

  function orderNotif(n){ return /^(order|orders|cards)\b/.test(n.go || ''); }
  var FRESH = {};
  $('bell').addEventListener('click', function(){
    var ids = [];
    NOTIFS.forEach(function(n){ if (n.unread && orderNotif(n)) { var m = /^order:(.+)$/.exec(n.go); if (m) FRESH[m[1]] = 1; n.unread = 0; if (n.nid) ids.push(n.nid); } });
    if (ids.length && LIVE) MC.api('POST', '/notifications/read', { ids: ids }).catch(function(){});
    go('orders'); counters();
  });

  var R = {};
  /* ===== Обзор ===== */
  R.overview = function(){
    counters();
    var acts = [];
    ORDERS.forEach(function(o){ if (o.status === 'action') acts.push({ cls: '', ico: 'warn', b: o.title + ' · ' + o.id, s: o.action.text, btn: o.action.btn, go: o.action.go }); if (o.status === 'new') acts.push({ cls: 'info', ico: 'pay', b: 'Оплатите ' + o.title + ' · ' + o.id, s: 'К оплате ' + money(o) + ' — расчёт зафиксирован', btn: 'Оплатить', go: 'order:' + o.id }); });
    if (LIVE && USER.kyc !== 'full') acts.unshift(USER.kyc === 'pending' ? { cls: 'info', ico: 'shield', b: 'Документы на проверке', s: 'Обычно до рабочего дня. После одобрения лимит расходов снимется', btn: 'Статус', go: 'kyc' } : { cls: '', ico: 'shield', b: USER.kyc === 'more' ? 'Верификация отклонена' : 'Пройдите верификацию', s: USER.kyc === 'more' ? (USER.kycReason || 'Загрузите документы ещё раз') : 'Без неё — покупки до ' + limText() + ' в месяц.' + (BONUS_KYC ? ' За верификацию — бонус ' + MC.kop(BONUS_KYC) : ''), btn: 'Пройти', go: 'kyc' });
    if (LIVE) ORDERS.filter(function(o){ return o.status === 'done' && !o.reviewed && Date.now() - new Date(o.done || o.created) < 14 * 864e5; }).slice(0, 1).forEach(function(o){ acts.push({ cls: 'info', ico: 'star', b: 'Как вам ' + o.title + '?', s: 'Оставьте отзыв — он поможет другим покупателям', btn: 'Оценить', go: 'order:' + o.id }); });
    if (LIVE && docsPending().length) acts.unshift({ cls: 'info', ico: 'doc', b: 'Обновились условия сервиса', s: docsPending().map(function(d){ return d.name + ', редакция ' + d.ver; }).join(' · ') + '. Примите их перед следующей покупкой', btn: 'Посмотреть', go: 'docs' });
    if (SESSIONS.some(function(s){ return s.sus; })) acts.push({ cls: 'err', ico: 'shield', b: 'Вход с нового устройства', s: 'Android · Chrome, Алматы. Если это не вы — завершите сессию и смените пароль', btn: 'Проверить', go: 'profile:sessions' });
    $('ovActions').innerHTML = acts.map(function(a){ return '<div class="act ' + a.cls + '">' + ico(a.ico) + '<div><b>' + esc(a.b) + '</b><span>' + esc(a.s) + '</span></div><button type="button" class="btn btn-ghost" data-go="' + a.go + '">' + a.btn + '</button></div>'; }).join('');
    var m = new Date().getMonth(), spent = 0; PAYMENTS.forEach(function(p){ if (p.status === 'ok' && new Date(p.at).getMonth() === m) spent += p.rubv; });
    var bal = 0; CARDS.forEach(function(c){ if (c.status === 'active') bal += c.balance; });
    var openT = TICKETS.filter(function(t){ return t.status !== 'closed'; }).length;
    $('ovKpis').innerHTML =
      '<button type="button" class="kpi k-btn" data-go="orders"><span class="k">Активные заказы</span><span class="v">' + ORDERS.filter(isActive).length + '</span><span class="d">' + (acts.length ? acts.length + ' ' + MC.plural(acts.length, ['требует', 'требуют', 'требуют']) + ' действия' : 'всё идёт по плану') + '</span></button>' +
      (LIVE ? '<button type="button" class="kpi k-btn" data-go="payments"><span class="k">Баланс</span><span class="v">' + MC.kop(BAL) + '</span><span class="d">пополнить или посмотреть операции</span></button>' :
      '<button type="button" class="kpi k-btn" data-go="cards"><span class="k">На картах</span><span class="v">' + usdf(bal) + '</span><span class="d">' + CARDS.filter(function(c){ return c.status === 'active'; }).length + ' активная · ' + CARDS.filter(function(c){ return c.status === 'frozen'; }).length + ' заморожена</span></button>') +
      '<button type="button" class="kpi k-btn" data-go="payments"><span class="k">Оплачено в этом месяце</span><span class="v">' + rub(spent) + '</span><span class="d">' + PAYMENTS.filter(function(p){ return p.status === 'ok' && new Date(p.at).getMonth() === m; }).length + ' платежа</span></button>' +
      '<button type="button" class="kpi k-btn" data-go="support"><span class="k">Обращения</span><span class="v">' + openT + '</span><span class="d">' + (openT ? 'есть ответ оператора' : 'открытых нет') + '</span></button>';
    var act = ORDERS.filter(isActive).slice(0, 4);
    $('ovOrders').innerHTML = act.length ? act.map(ordRow).join('') : '<div class="empty"><span class="ico">' + ico('orders') + '</span><b>Активных заказов нет</b><p>Пополните карту или выберите сервис в каталоге.</p></div>';
    $('ovCards').innerHTML = !CARDS.length ? '<div class="empty"><b>Карт пока нет</b><p>Выпустите первую: «Новый заказ» → виртуальная карта.</p></div>' : CARDS.map(function(c){ return '<button type="button" class="ov-card" data-go="cards">' + cbHtml(c, true) + '<span class="ov-card-t"><b>' + c.brand + ' •• ' + c.last4 + '</b><span>' + (c.status === 'active' ? 'Активна · баланс ' + usdf(c.balance) : 'Заморожена') + '</span><span class="mono">до ' + c.exp + '</span></span></button>'; }).join('');
    renderNotifs();
    renderQuick();
    var ol = $('ovLimit'); ol.hidden = !LIVE || !USER.limit; if (LIVE && USER.limit) ol.innerHTML = limHtml(true);
  };
  function ordRow(o){
    var p = progress(o);
    return '<button type="button" class="ord ' + o.status + (FRESH[o.id] ? ' fresh' : '') + '" data-go="order:' + o.id + '">' + ordIcon(o) + '<span class="ord-t"><b>' + esc(o.title) + '</b><span class="mono">' + o.id + '</span>' + (FRESH[o.id] ? '<span class="badge badge-info">Обновлён</span>' : '') + (o.giftTo ? '<span class="badge badge-plain">Подарок</span>' : '') + '</span><span class="ord-s"><span>' + esc(o.sub) + '</span><span>' + fmtD(o.created, true) + '</span></span><span class="ord-r"><span class="sum">' + money(o) + '</span>' + badge(ST[o.status]) + '</span>' + (isActive(o) || o.status === 'done' ? '<span class="ord-prog"><i style="--v:' + p + '%"></i></span>' : '') + '</button>';
  }
  function renderNotifs(){
    $('ovNotif').innerHTML = NOTIFS.map(function(n, i){ return '<li class="' + (n.unread ? 'unread' : '') + '" data-n="' + i + '">' + ico(n.unread ? 'bell' : 'check') + '<b>' + esc(n.t) + '</b><span>' + esc(n.s) + '</span><time>' + fmtD(n.at, true) + '</time></li>'; }).join('');
    $('ovNotif').querySelectorAll('li').forEach(function(li){ li.addEventListener('click', function(){ var n = NOTIFS[+li.getAttribute('data-n')]; n.unread = 0; var p = n.go.split(':'); go(p[0], p[1]); }); });
  }
  $('readAll').addEventListener('click', function(){ NOTIFS.forEach(function(n){ n.unread = 0; }); renderNotifs(); counters(); });

  /* быстрый заказ */
  var DENOMS = [50, 75, 100, 150, 200], qUsd = 50;
  function renderQuick(){
    $('qDenoms').innerHTML = DENOMS.map(function(d){ return '<button type="button" aria-pressed="' + (d === qUsd) + '" data-d="' + d + '">$' + d + '</button>'; }).join('');
    $('qDenoms').querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ qUsd = +b.getAttribute('data-d'); renderQuick(); }); });
    $('qNom').textContent = usdf(qUsd); $('qFee').textContent = rub(total(qUsd) - qUsd * rate()); $('qTot').textContent = rub(total(qUsd)); MC.bump($('qTot'));
  }
  $('qTabs').querySelectorAll('[role="tab"]').forEach(function(t){ t.addEventListener('click', function(){ $('qTabs').querySelectorAll('[role="tab"]').forEach(function(x){ x.setAttribute('aria-selected', x === t); }); var s = t.getAttribute('data-q') === 'svc'; $('qCard').hidden = s; $('qSvc').hidden = !s; if (s) $('qSearch').focus(); }); });
  $('qGo').addEventListener('click', function(){ W = { prod: LIVE ? 'issue' : 'topup', card: 'c1', usd: qUsd, step: 3 }; go('new'); });
  function svcSearch(input, out){
    input.addEventListener('input', function(){
      var q = input.value.trim().toLowerCase(); if (q.length < 2){ out.innerHTML = ''; return; }
      var list = MC.CATALOG.services.filter(function(s){ return s.n.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      out.innerHTML = list.length ? list.map(function(s){ return '<a href="' + BASE + s.h + '"><img class="' + (s.d ? 'on-dark' : '') + '" src="' + s.l + '" alt=""><span>' + esc(s.n) + '</span><span class="c">' + esc(MC.CATALOG.catName[s.c]) + '</span></a>'; }).join('') : '<div class="none">Ничего не нашли — посмотрите <a href="' + BASE + 'catalog.html">каталог</a>.</div>';
    });
  }
  svcSearch($('qSearch'), $('qRes')); svcSearch($('wSearch'), $('wRes'));

  /* ===== Новый заказ ===== */
  var W = { prod: 'topup', card: 'c1', usd: 50, step: 1 }, newOrder = null;
  function needKyc(){ return LIVE ? overLimit(total(W.usd) * 100) : W.usd >= 150 && USER.kyc !== 'full' && USER.kyc !== 'pending'; }
  function wizShow(n){
    W.step = n;
    document.querySelectorAll('#wiz .wiz-pane').forEach(function(p){ p.hidden = +p.getAttribute('data-pane') !== n; });
    document.querySelectorAll('#wizSteps li').forEach(function(li){ var k = +li.getAttribute('data-step'); li.className = k < n ? 'ok' : k === n ? 'cur' : ''; });
    if (n === 2) wizStep2(); if (n === 3) wizStep3(); if (n === 4) wizStep4(); if (n === 5) $('wpAmount').textContent = rub(total(W.usd));
  }
  function wizStep2(){
    var s = W.prod === 'svc'; $('wp2svc').hidden = !s; $('wp2card').hidden = s; $('wNext2').hidden = s;
    $('wpCardPick').hidden = W.prod !== 'topup';
    var act = CARDS.filter(function(c){ return c.status === 'active' && !c.giftTo; });
    $('wCards').innerHTML = act.map(function(c){ return '<button type="button" class="pick" data-c="' + c.id + '" aria-pressed="' + (c.id === W.card) + '">' + ico('card') + '<b>' + c.brand + ' •• ' + c.last4 + '</b><span>' + usdf(c.balance) + '</span></button>'; }).join('');
    $('wCards').querySelectorAll('.pick').forEach(function(b){ b.addEventListener('click', function(){ W.card = b.getAttribute('data-c'); wizStep2(); }); });
    var isD = DENOMS.indexOf(W.usd) >= 0;
    $('wDenoms').innerHTML = DENOMS.map(function(d){ return '<button type="button" aria-pressed="' + (d === W.usd) + '" data-d="' + d + '">$' + d + '</button>'; }).join('');
    $('wDenoms').querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ W.usd = +b.getAttribute('data-d'); $('wCustom').value = ''; wizStep2(); }); });
    if (!isD) $('wCustom').value = W.usd;
  }
  $('wCustom').addEventListener('input', function(){ var v = Math.round(+this.value); if (v >= VMIN && v <= VMAX){ W.usd = v; $('wDenoms').querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', 'false'); }); } });
  function wizStep3(){
    var u = W.usd, c = card(W.card);
    $('wqProd').textContent = W.prod === 'issue' ? 'Новая виртуальная карта' : 'Пополнение ' + (c ? c.brand + ' •• ' + c.last4 : 'карты');
    $('wqNom').textContent = usdf(u); $('wqFee').textContent = rub(total(u) - u * rate()) + ' (' + Math.round((total(u) / (u * rate()) - 1) * 100) + '%)'; $('wqRate').textContent = rate().toFixed(2) + ' ₽/$'; $('wqTot').textContent = rub(total(u));
    var reqs = [
      ['ok', 'Оферта 2.3 принята', 'Действующая редакция, вы приняли её ' + fmtD(DOCS[0].at)],
      [USER.kyc === 'none' ? 'no' : 'ok', 'Базовая верификация', USER.kyc === 'none' ? 'Подтвердите телефон и почту' : 'Телефон и почта подтверждены'],
      [needKyc() ? 'todo' : 'ok', 'Расширенная верификация', u >= 150 ? (needKyc() ? 'Нужна для сумм от $150 — паспорт, 3–5 минут' : USER.kyc === 'pending' ? 'На проверке — оплатить можно, зачислим после подтверждения' : 'Пройдена') : 'Не требуется для сумм до $150']
    ];
    if (LIVE) reqs = [[docsPending().length ? 'todo' : 'ok', docsPending().length ? 'Обновились условия' : 'Условия приняты', docsPending().length ? 'Примите новую редакцию перед оплатой — раздел «Документы»' : 'Оферта, редакция ' + DOCS[0].ver], [overLimit(total(u) * 100) ? 'todo' : 'ok', 'Лимит расходов', !USER.limit || USER.limit.limit_kop == null ? 'Без лимита' : overLimit(total(u) * 100) ? 'Осталось ' + MC.kop(USER.limit.remaining_kop) + ' — пройдите верификацию или уменьшите сумму' : 'Осталось ' + MC.kop(USER.limit.remaining_kop) + ' из ' + MC.kop(USER.limit.limit_kop)], [BAL >= Math.round(payKop(total(u) * 100)) / 100 ? 'ok' : 'todo', 'Баланс', 'Сейчас ' + MC.kop(BAL) + (BAL / 100 < payKop(total(u) * 100) / 100 ? ' — пополним на недостающее при оплате' : '')]];
    if (LIVE && USER.bonus) reqs.push(['ok', 'Бонус', 'Спишем ' + MC.kop(Math.min(USER.bonus, Math.round(total(u) * 100))) + ' скидкой — к оплате ' + MC.kop(payKop(total(u) * 100)) + (USER.bonus > total(u) * 100 ? ', остаток бонуса сгорит' : '')]);
    else if (W.prod === 'issue') reqs.push(['ok', 'Лимит карт', 'У вас ' + CARDS.length + ' из 5 возможных']);
    $('wqReq').innerHTML = reqs.map(function(r){ return '<div class="req ' + r[0] + '">' + ico(r[0] === 'ok' ? 'check' : r[0] === 'todo' ? 'warn' : 'x') + '<div><b>' + r[1] + '</b><span>' + r[2] + '</span></div></div>'; }).join('');
  }
  function wizStep4(){
    var k = needKyc();
    $('wDocs').innerHTML =
      '<label class="check"><input type="checkbox" id="wAgree" checked><span class="box"></span><span>Подтверждаю параметры заказа и сумму ' + rub(total(W.usd)) + '<span class="sub">Оферта, редакция ' + DOCS[0].ver + ', уже принята' + (DOCS[0].at ? ' ' + fmtD(DOCS[0].at) : '') + ' — повторно соглашаться не нужно</span></span></label>' +
      '<label class="check"><input type="checkbox" id="wMail" checked><span class="box"></span><span>Отправить квитанцию на ' + esc(USER.email) + '</span></label>' +
      (k && LIVE ? '<div class="alert alert-warn">' + ico('warn') + '<div><b>Сумма больше лимита</b>Без верификации можно тратить до ' + limText() + ' в месяц, осталось ' + MC.kop(USER.limit.remaining_kop) + '. Пройдите верификацию — лимит снимется.<div class="alert-actions"><button type="button" class="auth-link" data-go="kyc">Пройти сейчас</button></div></div></div>' : '') +
      (k && !LIVE ? '<div class="alert alert-warn">' + ico('warn') + '<div><b>Нужна расширенная верификация</b>Для сумм от $150 требуется подтверждение личности. Оплатить можно сейчас — заказ подождёт результата проверки, обычно 3–5 минут.<div class="alert-actions"><button type="button" class="auth-link" data-go="kyc">Пройти сейчас</button><button type="button" class="auth-link" id="wLess">Уменьшить до $100</button></div></div></div>' : '');
    var less = $('wLess'); if (less) less.addEventListener('click', function(){ W.usd = 100; wizShow(3); });
    $('wAgree').addEventListener('change', function(){ $('wNext4').disabled = !this.checked; }); $('wNext4').disabled = false;
  }
  $('wiz').addEventListener('click', function(e){
    var b = e.target.closest('[data-wiz]'); if (!b) return;
    var d = b.getAttribute('data-wiz');
    if (d === 'next'){ if (W.step === 2 && W.prod !== 'svc' && !(W.usd >= VMIN && W.usd <= VMAX)){ toast('Сумма', 'От $' + VMIN + ' до $' + VMAX + ' за один заказ.', 'err'); return; } wizShow(Math.min(6, W.step + 1)); }
    else wizShow(Math.max(1, W.step - 1));
  });
  document.querySelectorAll('.pick-grid .pick').forEach(function(b){ b.addEventListener('click', function(){ W.prod = b.getAttribute('data-prod'); document.querySelectorAll('.pick-grid .pick').forEach(function(x){ x.setAttribute('aria-pressed', x === b); }); }); });
  function createOrder(paid){
    var id = 'VX-' + (seq++), pid = 'P-' + (pseq++), c = card(W.card), now = new Date(), k = needKyc();
    var o = { id: id, kind: W.prod, title: W.prod === 'issue' ? 'Выпуск карты' : 'Пополнение карты', sub: (W.prod === 'issue' ? 'Новая Visa' : c.brand + ' •• ' + c.last4) + ' · ' + usdf(W.usd), usd: W.usd, created: now, pay: pid, card: W.prod === 'issue' ? null : W.card,
      status: paid ? (k ? 'action' : 'work') : 'new',
      tl: [['Заказ создан', now, 'ok'], paid ? ['Оплачен через СБП', now, 'ok', 'Платёж ' + pid + ' · ' + rub(total(W.usd))] : ['Оплата', null, 'cur', 'Расчёт действует 15 минут'], k ? ['Верификация', null, paid ? 'warn' : 'todo', 'Подтвердите личность — 3–5 минут'] : [W.prod === 'issue' ? 'Выпуск карты' : 'Зачисление на карту', null, paid ? 'cur' : 'todo', 'Обычно до 15 минут'], [W.prod === 'issue' ? 'Реквизиты доступны' : 'Зачислено', null, 'todo']] };
    if (k && paid) o.action = { text: 'Для суммы от $150 нужна расширенная верификация', btn: 'Пройти', go: 'kyc' };
    ORDERS.unshift(o); PAYMENTS.unshift({ id: pid, order: id, method: 'СБП', rubv: total(W.usd), status: paid ? 'ok' : 'pending', at: now });
    NOTIFS.unshift({ t: (paid ? 'Оплата получена · ' : 'Заказ создан · ') + id, s: o.title + ', ' + usdf(W.usd), at: now, go: 'order:' + id, unread: 1 });
    newOrder = o; counters(); return o;
  }
  $('wPay').addEventListener('click', function(){
    var b = this; if (LIVE) { livePay(b); return; } b.classList.add('is-loading');
    setTimeout(function(){ b.classList.remove('is-loading'); var o = createOrder(true); $('wDoneT').textContent = 'Оплата прошла'; $('wDoneP').innerHTML = 'Заказ <b>' + o.id + '</b> на ' + money(o) + ' принят. ' + (o.status === 'action' ? 'Осталось пройти верификацию — и зачислим.' : 'Зачислим в течение 15 минут, пришлём уведомление.'); wizShow(6); toast('Платёж проведён', 'Квитанция — в разделе «Платежи».', 'ok'); }, 1400);
  });
  $('wPayLater').addEventListener('click', function(){ var o = createOrder(false); $('wDoneT').textContent = 'Заказ создан'; $('wDoneP').innerHTML = 'Заказ <b>' + o.id + '</b> ждёт оплаты — расчёт зафиксирован на 15 минут. Оплатить можно из карточки заказа.'; wizShow(6); });
  $('wOpen').addEventListener('click', function(){ if (newOrder) go('order', newOrder.id); });
  R['new'] = function(){ if (LIVE) { var act = CARDS.filter(function(c){ return c.status === 'active' && !c.giftTo; }); if (W.prod === 'topup' && !act.length) W.prod = 'issue'; if (W.prod === 'topup' && !card(W.card)) W.card = act[0].id; var tp = document.querySelector('.pick-grid [data-prod="topup"]'); if (tp) tp.hidden = !act.length; $('wPayLater').hidden = true; } document.querySelectorAll('.pick-grid .pick').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-prod') === W.prod); }); wizShow(W.step || 1); };

  /* ===== Мои заказы ===== */
  var ordF = 'all';
  var FILT = { all: function(){ return true; }, active: isActive, action: function(o){ return o.status === 'action' || o.status === 'new'; }, done: function(o){ return o.status === 'done'; } };
  R.orders = function(param){
    if (param && FILT[param]) ordF = param;
    var q = $('ordSearch').value.trim().toLowerCase();
    $('ordFilters').querySelectorAll('.cat').forEach(function(b){ var f = b.getAttribute('data-f'); b.setAttribute('aria-selected', f === ordF); b.querySelector('.n').textContent = ORDERS.filter(FILT[f]).length; });
    var list = ORDERS.filter(FILT[ordF]).filter(function(o){ return !q || (o.id + ' ' + o.title + ' ' + o.sub).toLowerCase().indexOf(q) >= 0; });
    $('ordList').innerHTML = list.length ? list.map(ordRow).join('') : '<div class="empty"><span class="ico">' + ico('search') + '</span><b>Ничего не нашли</b><p>Попробуйте другой фильтр или номер заказа.</p></div>';
  };
  $('ordFilters').addEventListener('click', function(e){ var b = e.target.closest('.cat'); if (!b) return; ordF = b.getAttribute('data-f'); R.orders(); });
  $('ordSearch').addEventListener('input', function(){ R.orders(); });

  /* карточка заказа */
  R.order = function(id){
    var o = order(id); if (!o){ go('orders'); return; }
    delete FRESH[id];
    var p = pay(o.pay), c = o.card ? card(o.card) : null;
    var kv = [['Продукт', esc(o.title) + (o.kind === 'svc' ? ' <a class="auth-link" href="' + svcHref(o.svc) + '">страница сервиса</a>' : '')], ['Параметры', esc(o.sub)]];
    if (c) kv.push(['Карта', '<button type="button" class="auth-link" data-go="cards">' + c.brand + ' •• ' + c.last4 + '</button>']);
    kv.push(['Сумма', '<span class="mono">' + usdf(o.usd) + ' → ' + money(o) + '</span>']);
    if (o.bonus) kv.push(['Бонус', '<span class="mono">−' + MC.kop(Math.round(o.bonus * 100)) + '</span> скидкой']);
    if (p) kv.push(['Платёж', '<button type="button" class="auth-link mono" data-pay="' + p.id + '">' + p.id + '</button> · ' + PST[p.status][0]]);
    kv.push(['Создан', fmtD(o.created, true)]); if (o.done) kv.push(['Выполнен', fmtD(o.done, true)]);
    if (LIVE) kv.push(['Курс', '<span class="mono">' + o.rate + ' ₽/$ · зафиксирован</span>']);
    kv.push(['Оферта', 'редакция ' + (o.offer || DOCS[0].ver) + ' · <button type="button" class="auth-link" data-go="docs">документы</button>']);
    var actions = '';
    if (o.status === 'new') actions = '<button type="button" class="btn btn-primary" data-act="pay">Оплатить ' + money(o) + '</button><button type="button" class="btn btn-ghost" data-act="cancel">Отменить</button>';
    else if (o.status === 'action') actions = '<button type="button" class="btn btn-primary" data-go="' + o.action.go + '">' + o.action.btn + '</button>';
    else if (o.status === 'done') actions = '<button type="button" class="btn btn-primary" data-act="repeat">Повторить заказ</button>' + (LIVE ? '' : '<button type="button" class="btn btn-ghost" data-act="receipt">Квитанция</button><button type="button" class="btn btn-ghost" data-act="act">Акт</button>');
    actions += '<button type="button" class="btn btn-ghost" data-act="support">' + ico('chat') + 'Написать по заказу</button>';
    $('orderView').innerHTML = '<div class="ordv">' +
      '<div class="ordv-head">' + ordIcon(o) + '<div><h1>' + esc(o.title) + '</h1><span class="mono">' + o.id + ' · ' + fmtD(o.created, true) + '</span></div>' + badge(ST[o.status]) + '</div>' +
      (o.status === 'action' ? '<div class="act">' + ico('warn') + '<div><b>' + esc(o.action.text) + '</b><span>После подтверждения заказ продолжится автоматически</span></div><button type="button" class="btn btn-ghost" data-go="' + o.action.go + '">' + o.action.btn + '</button></div>' : '') +
      (o.cred ? '<div class="secure"><div class="t"><span>Результат</span><b>' + ico('check') + '</b></div><p style="font-size:14px;color:var(--text-2)">' + esc(o.cred) + '</p></div>' : '') +
      '<div class="ordv-grid"><div class="card"><h3>Детали</h3><dl class="kv">' + kv.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></div>' +
      '<div class="card"><h3>История</h3><ol class="vtl">' + o.tl.map(function(s){ return '<li class="' + s[2] + '"><b>' + s[0] + '</b>' + (s[1] ? '<time>' + fmtD(s[1], true) + '</time>' : '') + (s[3] ? '<p>' + s[3] + '</p>' : '') + '</li>'; }).join('') + '</ol></div></div>' +
      '<div class="ordv-actions">' + actions + '</div></div>';
    $('orderView').querySelectorAll('[data-act]').forEach(function(b){ b.addEventListener('click', function(){ orderAct(o, b.getAttribute('data-act'), b); }); });
    $('orderView').querySelectorAll('[data-pay]').forEach(function(b){ b.addEventListener('click', function(){ receipt(pay(b.getAttribute('data-pay'))); }); });
  };
  function orderAct(o, a, btn){
    if (a === 'pay'){ btn.classList.add('is-loading'); setTimeout(function(){ o.status = 'work'; o.tl[1] = ['Оплачен через СБП', new Date(), 'ok', 'Платёж ' + o.pay + ' · ' + money(o)]; o.tl[2][2] = 'cur'; var p = pay(o.pay); if (p){ p.status = 'ok'; p.at = new Date(); } toast('Оплачено', o.id + ' в работе.', 'ok'); counters(); R.order(o.id); }, 1200); }
    else if (a === 'cancel') modal({ title: 'Отменить заказ ' + o.id + '?', sub: 'Заказ ещё не оплачен — отмена бесплатна.', foot: [{ label: 'Оставить' }, { label: 'Отменить заказ', cls: 'btn-primary', onClick: function(){ o.status = 'cancel'; o.tl = [o.tl[0], ['Отменён до оплаты', new Date(), 'err', 'Отменили вы']]; var p = pay(o.pay); if (p) p.status = 'failed'; counters(); R.order(o.id); toast('Заказ отменён', '', 'ok'); } }] });
    else if (a === 'repeat'){ if (o.kind === 'svc') location.href = svcHref(o.svc); else { W = { prod: o.kind === 'issue' ? 'issue' : 'topup', card: o.card || 'c1', usd: o.usd, step: 3 }; go('new'); } }
    else if (a === 'receipt') receipt(pay(o.pay));
    else if (a === 'act') toast('Акт № ' + o.id.replace('VX-', 'А-'), 'Прототип: PDF сформируется на сервере и скачается.', 'ok');
    else if (a === 'support') go('support', 'new', { order: o.id });
  }
  function receipt(p){
    if (!p) return; var o = order(p.order);
    modal({ title: 'Квитанция ' + p.id, sub: PST[p.status][0] + ' · ' + fmtD(p.at, true), body: '<dl class="kv"><div><dt>Получатель</dt><dd>Vexel</dd></div><div><dt>Назначение</dt><dd>' + esc(o ? o.title + ' · ' + o.id : p.order) + '</dd></div><div><dt>Способ</dt><dd>' + p.method + '</dd></div><div><dt>Сумма</dt><dd class="mono">' + rub(p.rubv) + '</dd></div><div><dt>Идентификатор СБП</dt><dd class="mono">A' + String(Math.abs(hash(p.id))).slice(0, 12) + '</dd></div></dl>', foot: [{ label: 'Закрыть' }, { label: 'Скачать PDF', cls: 'btn-primary', onClick: function(){ toast('Квитанция ' + p.id, 'Прототип: PDF скачается с сервера.', 'ok'); } }] });
  }
  function hash(s){ var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h * 7919; }

  /* ===== Мои карты ===== */
  function cbHtml(c, mini){
    if (mini) return '<div class="cb ' + c.status + '"><div class="cb-top"><span class="cb-chip"></span></div><div class="cb-num">•• ' + c.last4 + '</div><div class="cb-bot"><b>' + c.exp + '</b><span class="cb-brand">' + c.brand + '</span></div></div>';
    return '<div class="cb ' + c.status + '"><div class="cb-top"><span class="cb-chip"></span><span>VIRTUAL</span></div><div class="cb-num">•••• •••• •••• ' + c.last4 + '</div><div class="cb-bot"><div><span class="l">Баланс</span><b>' + usdf(c.balance) + '</b></div><div><span class="l">до</span><b>' + c.exp + '</b></div><span class="cb-brand">' + c.brand + '</span></div></div>';
  }
  var revealed = {}, revealT = {};
  R.cards = function(){
    counters();
    $('cardsGrid').innerHTML = CARDS.map(function(c){
      var linked = ORDERS.filter(function(o){ return o.card === c.id; }), r = revealed[c.id];
      return '<div class="cardp" data-c="' + c.id + '">' + cbHtml(c) +
        '<div class="cardp-meta"><span>Выпущена ' + fmtD(c.issued) + '</span>' + (c.test ? badge(['Тестовая', 'badge-warn']) : '') + (c.gift ? badge(['Подарок', 'badge-info']) : '') + (c.giftTo ? badge(['Ждёт получения', 'badge-warn']) : badge(c.status === 'active' ? ['Активна', 'badge-ok'] : ['Заморожена', 'badge-plain'])) + '</div>' +
        (c.giftTo ? '<div class="alert alert-info">' + ico('gift') + '<div><b>Подарок для ' + esc(c.giftTo) + '</b>Карта перейдёт в кабинет друга, когда он войдёт или зарегистрируется с этой почтой. Реквизиты увидит только он.</div></div>' : '') +
        (r ? '<div class="secure"><div class="t"><span>Реквизиты видны</span><b><span data-sec="' + c.id + '">60</span> с</b></div><div class="cred"><span class="k">Номер</span><span class="v">' + c.pan + '</span><button type="button" class="icon-btn plain" data-copy="' + c.pan.replace(/ /g, '') + '" aria-label="Копировать">' + ico('copy') + '</button></div><div class="cred"><span class="k">Срок</span><span class="v">' + c.exp + '</span><button type="button" class="icon-btn plain" data-copy="' + c.exp + '" aria-label="Копировать">' + ico('copy') + '</button></div><div class="cred"><span class="k">CVV</span><span class="v">' + c.cvv + '</span><button type="button" class="icon-btn plain" data-copy="' + c.cvv + '" aria-label="Копировать">' + ico('copy') + '</button></div><div class="cred"><span class="k">Имя</span><span class="v">VEXEL CARDHOLDER</span><button type="button" class="icon-btn plain" data-copy="VEXEL CARDHOLDER" aria-label="Копировать">' + ico('copy') + '</button></div></div>' : '') +
        (c.giftTo ? '' : '<div class="cardp-btns">' + (r ? '<button type="button" class="btn btn-ghost wide" data-ca="hide">' + ico('lock') + 'Скрыть реквизиты</button>' : '<button type="button" class="btn btn-primary wide" data-ca="reveal" ' + (c.status !== 'active' ? 'disabled' : '') + '>' + ico('eye') + 'Показать реквизиты</button>') +
        '<button type="button" class="btn btn-ghost" data-ca="topup" ' + (c.status !== 'active' ? 'disabled' : '') + '>' + ico('plus') + 'Пополнить</button><button type="button" class="btn btn-ghost" data-ca="freeze">' + ico('snow') + (c.status === 'active' ? 'Заморозить' : 'Разморозить') + '</button></div>') +
        '<div class="cardp-links">Заказы: ' + (linked.length ? linked.map(function(o){ return '<button type="button" class="auth-link mono" data-go="order:' + o.id + '">' + o.id + '</button>'; }).join('') : '—') + '</div></div>';
    }).join('') + '<button type="button" class="cardp issue" data-go="new" data-prod="issue">' + ico('plus') + '<b>Выпустить ещё одну</b><p>Отдельная карта под сервис или покупку — удобно для лимитов.</p></button>' +
      (LIVE ? '<button type="button" class="cardp issue" data-gift="1">' + ico('gift') + '<b>Подарить другу</b><p>Карта с балансом — на почту друга. Появится у него в кабинете.</p></button>' : '');
    var gb = $('cardsGrid').querySelector('[data-gift]'); if (gb) gb.addEventListener('click', giftModal);
    $('giftBtn').hidden = !LIVE;
    $('cardsGrid').querySelectorAll('[data-ca]').forEach(function(b){ b.addEventListener('click', function(){ cardAct(card(b.closest('.cardp').getAttribute('data-c')), b.getAttribute('data-ca')); }); });
    $('cardsGrid').querySelectorAll('[data-copy]').forEach(function(b){ b.addEventListener('click', function(){ var v = b.getAttribute('data-copy'); (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function(){ toast('Скопировано', '', 'ok'); }, function(){ toast('Скопируйте вручную', v); }); }); });
  };
  function cardAct(c, a){
    if (LIVE) { liveCardAct(c, a); return; }
    if (a === 'reveal') stepUp('Показать реквизиты •• ' + c.last4, null, function(){ revealed[c.id] = 60; R.cards(); clearInterval(revealT[c.id]); revealT[c.id] = setInterval(function(){ revealed[c.id]--; var el = document.querySelector('[data-sec="' + c.id + '"]'); if (el) el.textContent = revealed[c.id]; if (revealed[c.id] <= 0){ clearInterval(revealT[c.id]); delete revealed[c.id]; if (cur === 'cards') R.cards(); } }, 1000); });
    else if (a === 'hide'){ clearInterval(revealT[c.id]); delete revealed[c.id]; R.cards(); }
    else if (a === 'topup'){ W = { prod: 'topup', card: c.id, usd: 50, step: 2 }; go('new'); }
    else if (a === 'freeze'){ if (c.status === 'active') modal({ title: 'Заморозить карту •• ' + c.last4 + '?', sub: 'Списания будут отклоняться, баланс сохранится. Разморозить можно в любой момент.', foot: [{ label: 'Отмена' }, { label: 'Заморозить', cls: 'btn-primary', onClick: function(){ c.status = 'frozen'; delete revealed[c.id]; R.cards(); toast('Карта заморожена', '', 'ok'); } }] }); else stepUp('Разморозить карту •• ' + c.last4, null, function(){ c.status = 'active'; R.cards(); toast('Карта активна', '', 'ok'); }); }
  }

  /* ===== Платежи и возвраты ===== */
  R.payments = function(param){
    var tb = $('payTable').querySelector('tbody');
    tb.innerHTML = PAYMENTS.map(function(p){ var o = order(p.order); return '<tr><td class="mono">' + fmtD(p.at, true) + '</td><td><b>' + (o ? esc(o.title) : esc(p.title || '')) + '</b>' + (p.order ? '<br><button type="button" class="act-link mono" data-go="order:' + p.order + '">' + p.order + '</button>' : '') + '</td><td>' + p.method + '</td><td class="num">' + rub(p.rubv) + '</td><td class="st">' + badge(PST[p.status]) + '</td><td>' + (p.status === 'ok' || p.status === 'refunded' ? '<button type="button" class="act-link" data-rc="' + p.id + '">' + ico('doc') + 'Квитанция</button>' : '') + '</td></tr>'; }).join('');
    tb.querySelectorAll('[data-rc]').forEach(function(b){ b.addEventListener('click', function(){ receipt(pay(b.getAttribute('data-rc'))); }); });
    $('refN').textContent = REFUNDS.length;
    $('refList').innerHTML = REFUNDS.length ? REFUNDS.map(function(r){ return '<div class="refc"><b>' + r.id + ' · ' + esc(r.why) + '</b><span class="sum">' + rub(r.rubv) + '</span><span>Платёж ' + r.pay + ' · заказ ' + r.order + ' · ' + fmtD(r.at) + (r.doneAt ? ' → возвращён ' + fmtD(r.doneAt) : '') + '</span>' + badge(r.status === 'done' ? ['Выполнен', 'badge-ok'] : r.status === 'rejected' ? ['Отклонён', 'badge-err'] : ['На рассмотрении', 'badge-warn']) + '</div>'; }).join('') : '<div class="empty"><b>Запросов нет</b></div>';
    var sel = $('refPay'), opts = PAYMENTS.filter(function(p){ return p.status === 'ok'; });
    if (LIVE) { sel.previousElementSibling.textContent = 'Заказ'; sel.innerHTML = ORDERS.filter(function(o){ return o.status !== 'refund' && o.status !== 'cancel'; }).map(function(o){ return '<option value="' + o.id + '">' + o.id + ' · ' + esc(o.title) + ' · ' + money(o) + '</option>'; }).join('') || '<option value="">Заказов для возврата нет</option>'; }
    else sel.innerHTML = opts.map(function(p){ var o = order(p.order); return '<option value="' + p.id + '">' + p.id + ' · ' + (o ? o.title : '') + ' · ' + rub(p.rubv) + '</option>'; }).join('');
    payTab(param === 'refunds' ? 'refunds' : 'pays');
    $('payTopup').hidden = !LIVE; $('balLine').hidden = !LIVE;
    if (LIVE) $('balLine').innerHTML = (USER.limit ? '<div class="lim-card lim-in">' + limHtml(false) + '</div>' : '') + '<span class="k">Баланс</span><b>' + MC.kop(BAL) + '</b><span class="d">возвраты по заказам приходят сюда</span>';
    if (LIVE && param === 'topup') topupModal();
  };
  function payTab(t){ $('payTabs').querySelectorAll('[role="tab"]').forEach(function(x){ x.setAttribute('aria-selected', x.getAttribute('data-pt') === t); }); $('payPane').hidden = t !== 'pays'; $('refPane').hidden = t !== 'refunds'; }
  $('payTabs').addEventListener('click', function(e){ var t = e.target.closest('[role="tab"]'); if (t) payTab(t.getAttribute('data-pt')); });
  $('refForm').addEventListener('submit', function(e){
    e.preventDefault(); if (LIVE) { var oid = $('refPay').value; if (!oid) return; MC.api('POST', '/refunds', { order_id: oid, reason: $('refWhy').value + ($('refTxt').value.trim() ? ': ' + $('refTxt').value.trim() : ''), destination: 'balance' }).then(function(){ $('refTxt').value = ''; return load(); }).then(function(){ R.payments('refunds'); toast('Заявка отправлена', 'Оператор рассмотрит её — деньги вернутся на баланс.', 'ok'); }, fail); return; } var p = pay($('refPay').value); if (!p) return;
    REFUNDS.unshift({ id: 'R-' + (rseq++), pay: p.id, order: p.order, why: $('refWhy').value, rubv: p.rubv, status: 'review', at: new Date() });
    $('refTxt').value = ''; R.payments('refunds'); toast('Запрос отправлен', 'Ответим в течение 3 рабочих дней.', 'ok');
  });

  /* ===== Верификация ===== */
  var kycFiles = [];
  R.kyc = function(){
    counters();
    if (LIVE) { liveKyc(); return; }
    var k = USER.kyc, map = { none: ['Не пройдена', 'badge-err', 10, 'Подтвердите телефон и почту, чтобы оформлять заказы.'], basic: ['Базовая', 'badge-info', 45, 'Телефон и почта подтверждены. Для сумм от $150 и третьей карты нужна расширенная проверка.'], pending: ['На проверке', 'badge-warn', 75, 'Документы у провайдера. Обычно 3–5 минут, максимум — 1 рабочий день. Заказы можно оплачивать, зачислим после подтверждения.'], full: ['Расширенная', 'badge-ok', 100, 'Все лимиты открыты. Повторная проверка не потребуется.'], more: ['Нужны данные', 'badge-warn', 60, 'Провайдер запросил дополнительный документ.'] }[k];
    $('kycStatus').innerHTML = '<div class="row"><h3>Статус: ' + map[0] + '</h3>' + badge([map[0], map[1]]) + '</div><p>' + map[3] + '</p><div class="progress"><i style="--v:' + map[2] + '%"></i></div>' +
      (k === 'more' ? '<div class="alert alert-warn">' + ico('warn') + '<div><b>Нужен документ, подтверждающий адрес</b>Выписка из банка или квитанция ЖКУ не старше 3 месяцев.<div class="alert-actions"><button type="button" class="auth-link" id="kycMore">Загрузить</button></div></div></div>' : '') +
      (k === 'pending' ? '<button type="button" class="btn btn-ghost" id="kycFake">' + ico('refresh') + 'Обновить статус</button>' : '');
    var lv = [
      { t: 'Базовая', s: 'Телефон и почта · заказы до $150', st: k === 'none' ? 'cur' : 'ok' },
      { t: 'Расширенная', s: 'Паспорт и селфи · любые суммы, до 5 карт', st: k === 'full' ? 'ok' : (k === 'pending' || k === 'more') ? 'cur' : '' },
      { t: 'Для бизнеса', s: 'Реквизиты компании, закрывающие документы', st: '', soon: 1 }
    ];
    $('kycLevels').innerHTML = lv.map(function(l){ return '<div class="lvl ' + l.st + '">' + ico(l.st === 'ok' ? 'check' : 'shield') + '<b>' + l.t + '</b><span>' + l.s + '</span>' + badge(l.soon ? ['Следующий релиз', 'badge-plain'] : l.st === 'ok' ? ['Пройден', 'badge-ok'] : l.st === 'cur' ? [k === 'pending' ? 'На проверке' : 'Доступен', 'badge-info'] : ['Доступен', 'badge-plain']) + '</div>'; }).join('');
    $('kycFiles').innerHTML = kycFiles.map(function(f){ return '<li>' + ico('doc') + esc(f.n) + '<span class="mono">' + f.s + '</span></li>'; }).join('');
    var ff = $('kycFake'); if (ff && LIVE) ff.addEventListener('click', function(){ ff.classList.add('is-loading'); load().then(function(){ R.kyc(); }); });
    if (ff && !LIVE) ff.addEventListener('click', function(){ ff.classList.add('is-loading'); setTimeout(function(){ USER.kyc = 'full'; ORDERS.forEach(function(o){ if (o.status === 'action' && o.action && o.action.go === 'kyc'){ o.status = 'work'; o.tl.forEach(function(s){ if (s[2] === 'warn'){ s[1] = new Date(); s[2] = 'ok'; s[3] = 'Подтверждено'; } }); o.tl[o.tl.length - 1][2] = 'cur'; delete o.action; } }); NOTIFS.unshift({ t: 'Верификация пройдена', s: 'Лимиты открыты, заказы продолжены', at: new Date(), go: 'orders', unread: 1 }); R.kyc(); toast('Верификация пройдена', 'Заказы, ждавшие проверки, продолжены.', 'ok'); }, 1500); });
    var km = $('kycMore'); if (km) km.addEventListener('click', function(){ $('kycFile').click(); });
    $('kycStart').disabled = k === 'pending' || k === 'full';
    if (LIVE) { $('kycStart').textContent = k === 'more' ? 'Загрузить заново' : 'Загрузить документы'; var kp = $('kycStatus').querySelector('p'); if (k === 'more') kp.textContent = USER.kycReason ? 'Причина отказа: ' + USER.kycReason + '. Загрузите документы ещё раз.' : 'Проверка не пройдена. Загрузите документы ещё раз.'; else if (k === 'pending') kp.textContent = 'Документы у оператора. Обычно проверяем в течение рабочего дня (9–22 МСК). Покупки откроются сразу после одобрения.'; else if (k === 'basic') kp.textContent = 'Почта подтверждена. Для покупок загрузите фото паспорта (разворот с фото) и селфи с ним.'; }
  };
  $('kycStart').addEventListener('click', function(){
    if (LIVE) { $('kycFile').click(); return; }
    modal({ title: 'Переход к проверке', sub: 'Откроется страница партнёра по верификации. Понадобятся паспорт и камера.', body: '<ul class="check-marks"><li>Данные не сохраняются у Vexel</li><li>Обычно 3–5 минут</li><li>Результат появится в кабинете автоматически</li></ul>', foot: [{ label: 'Позже' }, { label: 'Продолжить', cls: 'btn-primary', onClick: function(){ USER.kyc = 'pending'; R.kyc(); toast('Проверка запущена', 'Прототип: нажмите «Обновить статус», чтобы увидеть результат.'); } }] });
  });
  function addFiles(list){ if (LIVE) { kycUpload(list); return; } [].forEach.call(list, function(f){ kycFiles.push({ n: f.name, s: (f.size / 1024 / 1024).toFixed(1) + ' МБ' }); }); if (kycFiles.length){ if (USER.kyc === 'basic' || USER.kyc === 'more') USER.kyc = 'pending'; R.kyc(); toast('Файлы отправлены на проверку', kycFiles.length + ' ' + MC.plural(kycFiles.length, ['файл', 'файла', 'файлов']), 'ok'); } }
  $('kycFile').addEventListener('change', function(){ addFiles(this.files); this.value = ''; });
  var drop = $('kycDrop'); ['dragenter', 'dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); if (ev === 'drop') addFiles(e.dataTransfer.files); }); });

  /* ===== Профиль и безопасность ===== */
  R.profile = function(param){
    counters();
    if (LIVE) { liveProfile(param); return; }
    $('contactList').innerHTML = '<div><span class="k">Телефон</span><span class="v mono">' + esc(USER.phone) + ' <button type="button" class="auth-link" data-ch="phone">Изменить</button></span></div><div><span class="k">Почта</span><span class="v mono">' + esc(USER.email) + ' <button type="button" class="auth-link" data-ch="email">Изменить</button></span></div><div><span class="k">Telegram</span><span class="v">' + (USER.tg ? '@' + USER.tg + ' <button type="button" class="auth-link" data-ch="tgoff">Отвязать</button>' : 'не привязан <button type="button" class="auth-link" data-ch="tg">Привязать</button>') + '</span></div><div><span class="k">В Vexel с</span><span class="v">' + new Date(USER.since).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + '</span></div>';
    $('contactList').querySelectorAll('[data-ch]').forEach(function(b){ b.addEventListener('click', function(){ changeContact(b.getAttribute('data-ch')); }); });
    $('pName').value = USER.name;
    $('mfaTgl').checked = USER.mfa; $('mfaSub').textContent = USER.mfa ? 'включена' : 'выключена'; $('mfaSetup').hidden = true;
    $('sesN').textContent = SESSIONS.length;
    $('sesList').innerHTML = SESSIONS.map(function(s){ return '<div class="ses ' + (s.sus ? 'sus' : '') + '">' + ico(s.icon) + '<b>' + s.dev + (s.cur ? badge(['Это устройство', 'badge-ok']) : '') + (s.sus ? badge(['Подозрительный', 'badge-err']) : '') + '</b><span>' + s.place + ' · ' + s.ip + ' · ' + s.at + '</span>' + (s.cur ? '' : '<button type="button" class="btn btn-ghost" data-kill="' + s.id + '">Завершить</button>') + '</div>'; }).join('');
    $('sesList').querySelectorAll('[data-kill]').forEach(function(b){ b.addEventListener('click', function(){ var id = b.getAttribute('data-kill'); SESSIONS = SESSIONS.filter(function(s){ return s.id !== id; }); R.profile('sessions'); toast('Сессия завершена', 'Если это были не вы — смените пароль.', 'ok'); }); });
    $('consentList').innerHTML = DOCS.map(function(d){ return '<div><span class="k">' + (d.href ? '<a href="' + esc(d.href) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>' : esc(d.name)) + '</span><span class="v">ред. ' + esc(d.ver) + ' · ' + (d.pending ? '<button type="button" class="auth-link" data-go="docs">нужно принять</button>' : 'приняли ' + fmtD(d.at)) + '</span></div>'; }).join('');
    profTab(param || 'contacts');
  };
  function profTab(t){ $('profTabs').querySelectorAll('[role="tab"]').forEach(function(x){ x.setAttribute('aria-selected', x.getAttribute('data-pp') === t); }); document.querySelectorAll('.prof-pane').forEach(function(p){ p.hidden = p.getAttribute('data-pp') !== t; }); }
  $('profTabs').addEventListener('click', function(e){ var t = e.target.closest('[role="tab"]'); if (t) profTab(t.getAttribute('data-pp')); });
  function changeContact(what){
    if (what === 'tg'){ modal({ title: 'Привязать Telegram', sub: 'Откройте бота и отправьте код — он свяжет аккаунт.', body: '<div class="cred"><span class="k">Бот</span><span class="v">@vexel_bot</span></div><div class="cred"><span class="k">Код</span><span class="v">' + String(Math.abs(hash(USER.id))).slice(0, 6) + '</span></div>', foot: [{ label: 'Отмена' }, { label: 'Я отправил код', cls: 'btn-primary', onClick: function(){ USER.tg = 'alex_demo'; R.profile(); toast('Telegram привязан', 'Статусы заказов будут приходить в бот.', 'ok'); } }] }); return; }
    if (what === 'tgoff'){ delete USER.tg; R.profile(); toast('Telegram отвязан', '', 'ok'); return; }
    var isP = what === 'phone';
    modal({ title: isP ? 'Новый телефон' : 'Новая почта', sub: 'Подтвердим кодом на старый контакт, затем на новый.', body: '<div class="field"><label for="ncVal">' + (isP ? 'Телефон' : 'Почта') + '</label><input id="ncVal" type="text" inputmode="' + (isP ? 'tel' : 'email') + '" placeholder="' + (isP ? '+7 900 000-00-00' : 'mail@example.ru') + '"></div>', foot: [{ label: 'Отмена' }, { label: 'Продолжить', cls: 'btn-primary', onClick: function(){ var v = $('ncVal').value.trim(); if (v.length < 5){ $('ncVal').focus(); return false; } setTimeout(function(){ stepUp('Подтвердите смену', 'Код отправили на текущий ' + (isP ? 'телефон' : 'адрес') + ' ' + (isP ? USER.phone : USER.email) + '.', function(){ if (isP) USER.phone = v; else USER.email = v.replace(/^(.).*(.@.*)$/, '$1•••••$2'); SESSIONS = SESSIONS.filter(function(s){ return s.cur; }); R.profile(); toast('Контакт обновлён', 'Остальные сессии завершены для безопасности.', 'ok'); }); }, 50); } }] });
  }
  $('pSave').addEventListener('click', function(){ var v = $('pName').value.trim(); if (!v){ $('pName').focus(); return; } if (LIVE) { MC.api('PATCH', '/profile', { name: v }).then(function(r){ applyUser(r.user); counters(); toast('Сохранено', '', 'ok'); }, fail); return; } USER.name = v; counters(); toast('Сохранено', '', 'ok'); });
  $('pwNew').addEventListener('input', function(){ var v = this.value, s = 0; if (v.length >= 8) s++; if (/[A-ZА-Я]/.test(v) && /[a-zа-я]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^\w\dа-яА-Я]/.test(v) || v.length >= 14) s++; $('pwMeter').setAttribute('data-score', v ? s : 0); });
  $('pwForm').addEventListener('submit', function(e){ e.preventDefault(); if (LIVE) { var f0 = this; MC.api('POST', '/auth/password', { old: $('pwOld').value, new: $('pwNew').value }).then(function(){ f0.reset(); $('pwMeter').removeAttribute('data-score'); toast('Пароль изменён', 'Остальные устройства разлогинены.', 'ok'); load(); }, fail); return; } if (!$('pwOld').value){ $('pwOld').focus(); toast('Введите текущий пароль', '', 'err'); return; } if ($('pwNew').value.length < 8){ $('pwNew').focus(); toast('Пароль короткий', 'Минимум 8 символов.', 'err'); return; } var f = this; stepUp('Подтвердите смену пароля', null, function(){ f.reset(); $('pwMeter').removeAttribute('data-score'); SESSIONS = SESSIONS.filter(function(s){ return s.cur; }); toast('Пароль изменён', 'Остальные устройства разлогинены.', 'ok'); }); });
  $('mfaTgl').addEventListener('change', function(){
    var t = this;
    if (t.checked){ $('mfaSetup').hidden = false; $('mfaSub').textContent = 'настройка…'; wireOtp($('mfaBoxes'), function(code, box, ins){ USER.mfa = true; box.classList.add('is-ok'); setTimeout(function(){ $('mfaSetup').hidden = true; $('mfaSub').textContent = 'включена'; ins.forEach(function(x){ x.value = ''; x.classList.remove('is-filled'); }); box.classList.remove('is-ok'); toast('2FA включена', 'Сохраните резервные коды.', 'ok'); }, 400); }); }
    else if (USER.mfa){ t.checked = true; modal({ title: 'Выключить 2FA?', sub: 'Вход и показ реквизитов станут защищены только паролем и кодом из SMS.', foot: [{ label: 'Оставить' }, { label: 'Выключить', cls: 'btn-primary', onClick: function(){ USER.mfa = false; t.checked = false; $('mfaSub').textContent = 'выключена'; toast('2FA выключена', '', 'ok'); } }] }); }
    else { $('mfaSetup').hidden = true; $('mfaSub').textContent = 'выключена'; }
  });
  $('backupCodes').addEventListener('click', function(){ stepUp('Резервные коды', null, function(){ var c = []; for (var i = 0; i < 8; i++) c.push(String(Math.abs(hash(USER.id + i))).slice(0, 8).replace(/(\d{4})/, '$1-')); modal({ title: 'Резервные коды', sub: 'Каждый работает один раз. Храните не в почте.', body: '<div class="codes">' + c.map(function(x){ return '<span>' + x + '</span>'; }).join('') + '</div>', foot: [{ label: 'Закрыть' }, { label: 'Скопировать', cls: 'btn-primary', keep: true, onClick: function(){ (navigator.clipboard ? navigator.clipboard.writeText(c.join('\n')) : Promise.reject()).then(function(){ toast('Скопировано', '', 'ok'); }, function(){ toast('Скопируйте вручную'); }); } }] }); }); });
  $('killAll').addEventListener('click', function(){ if (LIVE) { if (SESSIONS.length < 2) { toast('Других сессий нет'); return; } MC.api('DELETE', '/auth/sessions/others').then(function(){ return load(); }).then(function(){ R.profile('sessions'); toast('Готово', 'Остались только вы.', 'ok'); }, fail); return; } if (SESSIONS.length < 2){ toast('Других сессий нет'); return; } stepUp('Завершить все сессии', null, function(){ SESSIONS = SESSIONS.filter(function(s){ return s.cur; }); R.profile('sessions'); toast('Готово', 'Остались только вы.', 'ok'); }); });

  /* ===== Поддержка ===== */
  var tkCur = null;
  var TST = { open: ['Открыто', 'badge-info'], answered: ['Есть ответ', 'badge-ok'], closed: ['Закрыто', 'badge-plain'] };
  R.support = function(param, opts){
    counters();
    if (param === 'new'){ tkCur = null; tkNew(opts && opts.order); }
    else { if (param) tkCur = param; if (!tkCur && TICKETS.length) tkCur = TICKETS[0].id; tkOpen(tkCur); }
    tkListRender();
  };
  function tkListRender(){
    $('tkList').innerHTML = TICKETS.length ? TICKETS.map(function(t){ return '<button type="button" class="tk ' + (t.id === tkCur ? 'is-active' : '') + '" data-t="' + t.id + '"><b>' + esc(t.subj) + '</b><span>' + t.id + (t.order ? ' · заказ ' + t.order : '') + ' · ' + fmtD(t.msgs[t.msgs.length - 1].at, true) + '</span>' + badge(TST[t.status]) + '</button>'; }).join('') : '<div class="empty"><b>Обращений нет</b></div>';
    $('tkList').querySelectorAll('.tk').forEach(function(b){ b.addEventListener('click', function(){ tkCur = b.getAttribute('data-t'); tkOpen(tkCur); tkListRender(); history.replaceState(null, '', '#support:' + tkCur); }); });
  }
  function tkOpen(id){
    var t = TICKETS.filter(function(x){ return x.id === id; })[0];
    if (!t){ $('tkView').innerHTML = '<div class="empty tk-empty"><span class="ico">' + ico('chat') + '</span><b>Выберите обращение</b><p>Или создайте новое — оператор увидит заказ и платёж без пересылки данных.</p></div>'; return; }
    var o = t.order ? order(t.order) : null;
    $('tkView').innerHTML = '<div class="tk-head"><div><h3>' + esc(t.subj) + '</h3><div class="meta"><span class="mono">' + t.id + '</span>' + (o ? '<button type="button" class="auth-link" data-go="order:' + o.id + '">' + esc(o.title) + ' · ' + o.id + '</button>' : '') + '<span>' + fmtD(t.at, true) + '</span></div></div>' + badge(TST[t.status]) + '</div>' +
      '<div class="msgs">' + t.msgs.map(function(m){ return m.sys ? '<div class="msg sys">' + esc(m.t) + '</div>' : '<div class="msg ' + (m.me ? 'me' : '') + '">' + esc(m.t) + (m.att ? '<span class="att">' + ico('clip') + esc(m.att) + '</span>' : '') + '<time>' + (m.me ? 'Вы' : 'Оператор') + ' · ' + fmtD(m.at, true) + '</time></div>'; }).join('') + '</div>' +
      (t.status === 'closed' ? '<div class="reply"><p class="hint" style="flex:1">Обращение закрыто. <button type="button" class="auth-link" id="tkReopen">Открыть снова</button></p></div>' : '<form class="reply" id="tkReply"><div class="field"><textarea id="tkText" rows="1" placeholder="Написать оператору…"></textarea></div><button type="button" class="icon-btn" id="tkAttach" aria-label="Прикрепить файл">' + ico('clip') + '</button><button type="submit" class="icon-btn" aria-label="Отправить" style="color:var(--accent)">' + ico('send') + '</button></form>');
    var rp = $('tkReply'); if (rp){ rp.addEventListener('submit', function(e){ e.preventDefault(); var v = $('tkText').value.trim(); if (!v) return; t.msgs.push({ me: 1, t: v, at: new Date() }); t.status = 'open'; tkOpen(t.id); tkListRender(); setTimeout(function(){ t.msgs.push({ me: 0, t: 'Спасибо, передали оператору — ответим в этом обращении. Обычно до 15 минут в рабочее время (9:00–22:00 МСК).', at: new Date() }); t.status = 'answered'; if (tkCur === t.id) tkOpen(t.id); tkListRender(); counters(); }, 1800); }); $('tkAttach').addEventListener('click', function(){ t.msgs.push({ me: 1, t: 'Скриншот экрана', att: 'screenshot.png · 0,4 МБ', at: new Date() }); tkOpen(t.id); }); $('tkText').addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); rp.requestSubmit ? rp.requestSubmit() : rp.dispatchEvent(new Event('submit')); } }); }
    var ro = $('tkReopen'); if (ro) ro.addEventListener('click', function(){ t.status = 'open'; t.msgs.push({ sys: 1, t: 'Обращение открыто снова', at: new Date() }); tkOpen(t.id); tkListRender(); counters(); });
    var ms = $('tkView').querySelector('.msgs'); if (ms) ms.scrollTop = ms.scrollHeight;
  }
  function tkNew(orderId){
    var opts = ORDERS.map(function(o){ return '<option value="' + o.id + '" ' + (o.id === orderId ? 'selected' : '') + '>' + o.id + ' · ' + esc(o.title) + '</option>'; }).join('');
    $('tkView').innerHTML = '<form class="tk-new" id="tkForm" novalidate><div class="tk-head"><div><h3>Новое обращение</h3><div class="meta"><span>Оператор увидит заказ, платёж и статус карты — данные пересылать не нужно</span></div></div></div>' +
      '<div class="form-row"><div class="field"><label for="tkTopic">Тема</label><select id="tkTopic"><option>Не пришли реквизиты или доступ</option><option>Оплата прошла, заказ не создан</option><option>Списание с карты отклонено</option><option>Возврат</option><option>Верификация</option><option>Другое</option></select></div><div class="field"><label for="tkOrder">Заказ</label><select id="tkOrder"><option value="">Без привязки</option>' + opts + '</select></div></div>' +
      '<div class="field"><label for="tkMsg">Сообщение</label><textarea id="tkMsg" rows="4" placeholder="Что случилось и что вы ожидали"></textarea></div>' +
      '<div class="file-list" id="tkFiles"></div><div class="wiz-foot"><button type="button" class="btn btn-ghost" id="tkAdd">' + ico('clip') + 'Прикрепить</button><button type="submit" class="btn btn-primary">Отправить</button></div></form>';
    var files = [];
    $('tkAdd').addEventListener('click', function(){ files.push('screenshot-' + (files.length + 1) + '.png'); $('tkFiles').innerHTML = files.map(function(f){ return '<li>' + ico('doc') + f + '</li>'; }).join(''); });
    $('tkForm').addEventListener('submit', function(e){
      e.preventDefault(); var v = $('tkMsg').value.trim(); if (!v){ $('tkMsg').focus(); toast('Опишите проблему', '', 'err'); return; }
      if (LIVE) { toast('Чат подключаем', 'Пока напишите в Telegram или на почту — ссылки на странице «Поддержка».'); return; }
      var t = { id: 'T-' + (tseq++), subj: $('tkTopic').value, order: $('tkOrder').value || null, status: 'open', at: new Date(), msgs: [{ me: 1, t: v, at: new Date(), att: files.length ? files.join(', ') : null }] };
      TICKETS.unshift(t); tkCur = t.id; tkOpen(t.id); tkListRender(); counters(); toast('Обращение создано', t.id + ' — ответим здесь и на почту.', 'ok');
      setTimeout(function(){ t.msgs.push({ me: 0, t: 'Здравствуйте! Приняли обращение' + (t.order ? ' по заказу ' + t.order : '') + '. Смотрим — ответим в течение 15 минут.', at: new Date() }); t.status = 'answered'; if (tkCur === t.id) tkOpen(t.id); tkListRender(); counters(); }, 2500);
    });
    $('tkMsg').focus();
  }
  $('newTicket').addEventListener('click', function(){ if (LIVE) { go('support', 'general'); return; } tkCur = null; tkNew(); tkListRender(); history.replaceState(null, '', '#support:new'); });

  /* ===== Документы ===== */
  R.docs = function(){
    var pend = DOCS.filter(function(d){ return d.pending; });
    $('docPending').innerHTML = pend.length ? '<div class="alert alert-warn">' + ico('warn') + '<div><b>Обновились условия</b>' + pend.map(function(d){ return esc(d.name) + ' — редакция ' + esc(d.ver) + ' от ' + fmtD(d.published) + (d.note ? ': ' + esc(d.note) : ''); }).join('<br>') + '<br>Прочитайте и примите — без этого новые покупки недоступны.<div class="alert-actions"><button type="button" class="btn btn-primary" id="docAccept">Принимаю</button></div></div></div>' : '';
    var da = $('docAccept'); if (da) da.addEventListener('click', function(){ acceptDocs(da, function(){ R.docs(); }); });
    $('docAccepted').innerHTML = DOCS.map(function(d, i){ return '<div class="docr">' + ico('doc') + '<b>' + esc(d.name) + '<span class="ver">ред. ' + esc(d.ver) + '</span>' + badge(d.pending ? ['Нужно принять', 'badge-warn'] : ['Принята', 'badge-ok']) + '</b><span>' + (d.pending ? 'Опубликована ' + fmtD(d.published) + ' · вы её ещё не приняли' : 'Вы приняли ' + fmtD(d.at, true) + (d.published ? ' · опубликована ' + fmtD(d.published) : '')) + (d.hist.length ? ' · <button type="button" class="auth-link" data-h="' + i + '">прошлые редакции</button>' : '') + '</span><div class="r">' + (d.href ? '<a class="icon-btn" href="' + d.href + '" target="_blank" rel="noopener" aria-label="Открыть">' + ico('dl') + '</a>' : '') + '</div><div class="hist" hidden id="dh' + i + '">' + d.hist.map(function(h){ return '<div>' + h + '</div>'; }).join('') + '</div></div>'; }).join('');
    $('docAccepted').querySelectorAll('[data-h]').forEach(function(b){ b.addEventListener('click', function(){ var el = $('dh' + b.getAttribute('data-h')); el.hidden = !el.hidden; }); });
    var files = [];
    PAYMENTS.forEach(function(p){ if (p.status === 'ok' || p.status === 'refunded'){ var o = order(p.order); files.push({ t: 'Квитанция ' + p.id, s: (o ? o.title + ' · ' : '') + rub(p.rubv) + ' · ' + fmtD(p.at), pay: p.id, at: p.at }); } });
    ORDERS.forEach(function(o){ if (o.status === 'done') files.push({ t: 'Акт ' + o.id.replace('VX-', 'А-'), s: o.title + ' · ' + fmtD(o.done), act: o.id, at: o.done }); });
    files.sort(function(a, b){ return new Date(b.at) - new Date(a.at); });
    $('docFiles').innerHTML = files.map(function(f){ return '<div class="docr">' + ico(f.act ? 'orders' : 'pay') + '<b>' + f.t + '</b><span>' + esc(f.s) + '</span><div class="r"><button type="button" class="icon-btn" ' + (f.pay ? 'data-rc="' + f.pay + '"' : 'data-actd="' + f.act + '"') + ' aria-label="Открыть">' + ico(f.pay ? 'eye' : 'dl') + '</button></div></div>'; }).join('');
    $('docFiles').querySelectorAll('[data-rc]').forEach(function(b){ b.addEventListener('click', function(){ receipt(pay(b.getAttribute('data-rc'))); }); });
    $('docFiles').querySelectorAll('[data-actd]').forEach(function(b){ b.addEventListener('click', function(){ toast('Акт по заказу ' + b.getAttribute('data-actd'), 'Прототип: PDF скачается с сервера.', 'ok'); }); });
  };


  /* ===================== Сервер: живые данные вместо демо ===================== */
  var OST = { paid: 'paid', in_work: 'work', need_info: 'action', done: 'done', canceled: 'cancel', refunded: 'refund' };
  var PSTAT = { succeeded: 'ok', pending: 'pending', canceled: 'failed', refunded: 'refunded' };
  var KYC = { none: 'basic', pending: 'pending', approved: 'full', rejected: 'more' };
  var EVT = { created: 'Заказ оплачен', status: 'Статус изменён', delivered: 'Выдано', note: 'Комментарий', refund: 'Возврат на баланс' };
  function fail(e){ toast('Не получилось', e.message, 'err'); if (e.code === 'unauthorized') setTimeout(function(){ location.href = BASE + 'login.html'; }, 900); }
  function applyUser(u){
    USER.email = u.email; USER.id = u.username || u.email; USER.phone = u.phone || 'не указан'; USER.rawPhone = u.phone;
    USER.name = u.name || u.username || u.email.split('@')[0]; USER.login = u.username; USER.tg = u.telegram || ''; USER.kyc = KYC[u.kyc_status] || 'basic'; USER.kycReason = u.kyc_reason; USER.since = u.created_at;
    BAL = u.balance_kop || 0; USER.limit = u.limit || null; USER.bonus = u.bonus_kop || 0;
    var hl = document.querySelector('.head-login'); if (hl && hl.lastChild) hl.lastChild.textContent = USER.name;
  }
  function mapOrder(o, events){
    var st = OST[o.status] || 'paid', slug = o.product_slug, svcN = svc(o.product_name) ? o.product_name : null;
    var tl = (events || [{ kind: 'created', created_at: o.created_at }]).map(function(e){ return [e.text || EVT[e.kind] || e.kind, e.created_at, e.kind === 'refund' ? 'err' : 'ok']; });
    if (st === 'paid' || st === 'work' || st === 'action') tl.push([slug === 'virtual-card' ? 'Выпуск карты' : 'Оформляем', null, 'cur', 'Обычно до 30 минут в рабочее время (9–22 МСК)'], ['Готово', null, 'todo']);
    var r = { reviewed: o.reviewed, chatUnread: o.chat_unread, bonus: (o.bonus_kop || 0) / 100, id: o.id, kind: slug === 'virtual-card' ? 'issue' : 'svc', svc: svcN, title: o.product_name, sub: o.plan_label || '', usd: o.price_cents / 100, rubv: o.amount_kop / 100, rate: o.rate,
      status: st, created: o.created_at, done: o.delivered_at, tl: tl, slug: slug };
    if (o.delivery) r.cred = o.delivery;
    if (o.buyer_fields && o.buyer_fields.card_id) r.card = o.buyer_fields.card_id;
    if (o.gift_to) { r.giftTo = o.gift_to; r.sub = (r.sub ? r.sub + ' · ' : '') + 'подарок для ' + o.gift_to; }
    if (st === 'action') r.action = { text: 'Оператору нужны данные по заказу', btn: 'Написать', go: 'support:new' };
    return r;
  }
  function setArr(a, b){ a.length = 0; [].push.apply(a, b); }
  function load(){
    return MC.api('GET', '/auth/me').then(function(r){
      if (!r.user) { location.replace(BASE + 'login.html'); return false; }
      applyUser(r.user);
      return Promise.all([MC.api('GET', '/orders'), MC.api('GET', '/payments'), MC.api('GET', '/notifications'), MC.api('GET', '/auth/sessions'), MC.api('GET', '/cards'), MC.api('GET', '/refunds'), MC.api('GET', '/me/documents').catch(function(){ return null; }), MC.api('GET', '/favorites').catch(function(){ return null; }), MC.api('GET', '/chats').catch(function(){ return null; }), MC.site()]).then(function(x){
        if (x[7]) setArr(FAVS, x[7].favorites); if (x[8]) { CHAT_UNREAD = x[8].unread; setArr(THREADS, x[8].threads); } if (x[9] && x[9].limits) { BONUS_KYC = x[9].limits.kyc_bonus_kop || 0; LIM_UNV = x[9].limits.unverified_kop; }
        setArr(ORDERS, x[0].orders.map(function(o){ return mapOrder(o); }));
        setArr(PAYMENTS, x[1].payments.map(function(p){ return { id: p.id.slice(0, 8).toUpperCase(), full: p.id, order: null, title: 'Пополнение баланса', method: p.provider === 'test' ? 'Тестовая оплата' : 'СБП', rubv: p.amount_kop / 100, status: PSTAT[p.status] || 'pending', at: p.paid_at || p.created_at }; }));
        setArr(NOTIFS, x[2].notifications.map(function(n){ var h = (n.link || '').split('#')[1] || 'overview'; return { t: n.title, s: n.body || '', at: n.created_at, go: h, unread: !n.read_at, nid: n.id }; }));
        SESSIONS = x[3].sessions.map(function(s){ return { id: s.id, cur: s.current ? 1 : 0, dev: s.device, place: '', ip: (s.ip || '').replace(/\.\d+\.\d+$/, '.·.·'), at: s.current ? 'сейчас' : fmtD(s.last_seen_at, true), icon: /iPhone|Android/.test(s.device) ? 'phone' : 'laptop' }; });
        setArr(CARDS, x[4].cards.map(function(c){ var old = card(c.id); return { id: c.id, last4: c.last4, brand: c.brand, status: c.status === 'frozen' ? 'frozen' : 'active', balance: c.balance_cents / 100, exp: c.exp, issued: c.created_at, test: c.test, giftTo: c.gift_to, gift: c.gift, pan: old && old.pan, cvv: old && old.cvv }; }));
        CARDS.forEach(function(c){ var src = x[4].cards.filter(function(k){ return k.id === c.id; })[0]; var o = src && src.order_id && order(src.order_id); if (o) o.card = c.id; });
        setArr(TICKETS, []);
        var RST = { new: 'review', approved: 'review', rejected: 'rejected', done: 'done' };
        setArr(REFUNDS, x[5].refunds.map(function(r){ return { id: 'R-' + r.id.slice(0, 6).toUpperCase(), pay: r.payment_id ? r.payment_id.slice(0, 8).toUpperCase() : '—', order: r.order_id || '—', why: r.reason + (r.admin_note ? ' · ' + r.admin_note : ''), rubv: r.amount_kop / 100, status: RST[r.status], at: r.created_at, doneAt: r.status === 'done' ? r.decided_at : null, dest: r.destination }; }));
        if (x[6]) setArr(DOCS, x[6].current.map(function(d){
          return { id: d.id, kind: d.kind, name: d.title, ver: d.version, at: d.accepted_at, pending: !d.accepted_at, published: d.published_at, note: d.note, href: d.url,
            hist: x[6].history.filter(function(h){ return h.kind === d.kind && h.id !== d.id; }).map(function(h){ return 'редакция ' + esc(h.version) + ' — вы приняли ' + fmtD(h.accepted_at, true) + (h.url ? ' · <a class="auth-link" href="' + esc(h.url) + '" target="_blank" rel="noopener">открыть</a>' : ''); }) };
        }));
        counters(); return true;
      });
    }).catch(function(e){ fail(e); return false; });
  }
  // карточка заказа — с событиями и выдачей с сервера
  var baseOrder = R.order;
  R.order = function(id){
    if (!LIVE) return baseOrder(id);
    var full = function(r){ var m = mapOrder(r.order, r.events); m.review = r.review; m.chat = r.chat; m.reviewed = !!r.review; return m; };
    if (!order(id)) { MC.api('GET', '/orders/' + encodeURIComponent(id)).then(function(r){ ORDERS.unshift(full(r)); baseOrder(id); orderExtras(order(id)); }, function(){ go('orders'); }); return; }
    baseOrder(id); orderExtras(order(id), true);
    MC.api('GET', '/orders/' + encodeURIComponent(id)).then(function(r){
      var prev = order(id), i = ORDERS.indexOf(prev), m = full(r); if (prev && prev.card && !m.card) m.card = prev.card; ORDERS[i] = m; if (cur === 'order') { baseOrder(id); orderExtras(m); }
    }).catch(function(){});
  };
  // уведомления: прочитать на сервере
  $('readAll').addEventListener('click', function(){ if (LIVE) MC.api('POST', '/notifications/read', {}).catch(function(){}); });
  $('ovNotif').addEventListener('click', function(e){ var li = e.target.closest('li'); if (!LIVE || !li) return; var n = NOTIFS[+li.getAttribute('data-n')]; if (n && n.nid) MC.api('POST', '/notifications/read', { ids: [n.nid] }).catch(function(){}); }, true);

  // пополнение баланса: сумма → платёж → (тестовый провайдер) подтверждение
  function topupModal(needKop, forOrder, onDone){
    var v = needKop ? Math.max(100, Math.ceil(needKop / 100)) : 1000;
    modal({ title: needKop ? 'Пополнить на недостающее' : 'Пополнить баланс', sub: needKop ? 'Не хватает ' + MC.kop(needKop) + '. После оплаты заказ оформится сам.' : 'От 100 до 300 000 ₽. Деньги придут на баланс сразу после оплаты.',
      body: '<div class="field"><label for="tuSum">Сумма, ₽</label><input id="tuSum" type="number" inputmode="numeric" min="100" max="300000" step="1" value="' + v + '"></div>',
      foot: [{ label: 'Отмена' }, { label: 'Перейти к оплате', cls: 'btn-primary', keep: true, onClick: function(btn){
        var s = Math.round(+$('tuSum').value); if (!(s >= 100 && s <= 300000)) { $('tuSum').focus(); toast('Сумма', 'От 100 до 300 000 ₽.', 'err'); return false; }
        btn.classList.add('is-loading');
        MC.api('POST', '/topups', { amount_kop: s * 100, for_order: forOrder || undefined }).then(function(r){ btn.classList.remove('is-loading'); testPay(r.payment, onDone); }, function(e){ btn.classList.remove('is-loading'); fail(e); });
        return false;
      } }] });
  }
  function testPay(p, onDone){
    modal({ title: 'Тестовая оплата', sub: 'Стенд: платёжный провайдер ещё не подключён — эта форма заменяет страницу банка.',
      body: '<div class="testpay"><span class="k">К оплате</span><b>' + MC.kop(p.amount_kop) + '</b><span class="hint">Платёж ' + p.id.slice(0, 8).toUpperCase() + '</span></div>',
      foot: [{ label: 'Отменить платёж', onClick: function(){ MC.api('POST', '/topups/' + p.id + '/test', { action: 'cancel' }).then(function(){ toast('Платёж отменён', ''); load(); }); } },
             { label: 'Оплатить', cls: 'btn-primary', keep: true, onClick: function(btn){
               btn.classList.add('is-loading');
               MC.api('POST', '/topups/' + p.id + '/test', { action: 'succeed' }).then(function(r){
                 closeModal(); toast('Баланс пополнен', MC.kop(p.amount_kop), 'ok');
                 if (r.order_error) toast('Заказ не оформлен', r.order_error === 'kyc_required' ? 'Нужна верификация — деньги остались на балансе.' : 'Деньги остались на балансе — попробуйте ещё раз.', 'err');
                 load().then(function(){ if (onDone) onDone(r); else if (cur) go(cur === 'order' ? 'payments' : cur, null, { keepScroll: true }); });
               }, function(e){ btn.classList.remove('is-loading'); fail(e); });
               return false;
             } }] });
  }
  $('payTopup').addEventListener('click', function(){ topupModal(); });

  // оплата заказа с баланса (мастер «Новый заказ», виртуальная карта)
  var cardPlans = null;
  function cardPlan(usd){
    var get = cardPlans ? Promise.resolve(cardPlans) : MC.api('GET', '/catalog/virtual-card').then(function(r){ return (cardPlans = r.plans); });
    return get.then(function(pl){
      var fixed = pl.filter(function(x){ return x.price_cents === usd * 100 && !x.custom; })[0];
      return fixed ? { plan_id: fixed.id } : { plan_id: pl.filter(function(x){ return x.custom; })[0].id, amount_cents: usd * 100 };
    });
  }
  // покупка с баланса: pp = {plan_id, amount_cents}; недостача → пополнение под заказ; нет KYC → верификация
  function buy(pp, fields, cardId, btn, onOk, giftTo, useBonus){
    if (btn) btn.classList.add('is-loading');
    var body = { plan_id: pp.plan_id, amount_cents: pp.amount_cents, fields: fields || {}, idem: MC.uid() };
    if (cardId) body.card_id = cardId;
    if (giftTo) body.gift_to = giftTo;
    body.use_bonus = useBonus !== false;
    return MC.api('POST', '/orders', body).then(function(r){
      if (btn) btn.classList.remove('is-loading'); onOk(r.order.id);
    }, function(e){
      if (btn) btn.classList.remove('is-loading');
      if (e.code === 'insufficient_funds') { var f = {}; for (var k in (fields || {})) f[k] = fields[k]; if (cardId) f.card_id = cardId; topupModal(e.data.shortfall_kop, { plan_id: pp.plan_id, amount_cents: pp.amount_cents, fields: f, gift_to: giftTo || undefined, use_bonus: useBonus !== false }, function(r){ if (r.order_id) onOk(r.order_id); }); return; }
      if (e.code === 'docs_update_required') { load().then(function(){ docsModal(function(){ buy(pp, fields, cardId, btn, onOk, giftTo, useBonus); }); }); return; }
      if (e.code === 'limit_exceeded') { load().then(function(){ limitModal(e.message); }); return; }
      if (e.code === 'kyc_required') { toast('Нужна верификация', 'Покупки открываются после проверки документов. Баланс можно пополнить уже сейчас.', 'err'); go('kyc'); return; }
      fail(e);
    });
  }
  function livePay(btn){
    cardPlan(W.usd).then(function(pp){ buy(pp, {}, W.prod === 'topup' ? W.card : null, btn, orderDone); }).catch(fail);
  }
  function orderDone(id){
    load().then(function(){
      newOrder = order(id);
      var o = order(id), c = o && o.card && card(o.card);
      $('wDoneT').textContent = o && o.status === 'done' ? (W.prod === 'topup' ? 'Карта пополнена' : 'Карта выпущена') : 'Заказ оплачен';
      $('wDoneP').innerHTML = 'Заказ <b>' + esc(id) + '</b> оплачен с баланса. ' + (c ? 'Карта ' + c.brand + ' •• ' + c.last4 + ' — баланс ' + usdf(c.balance) + '. Реквизиты — в «Мои карты».' : 'Пришлём уведомление, когда будет готово.');
      wizShow(6); toast('Оплачено с баланса', id, 'ok');
    });
  }

  /* ——— лимит расходов и бонус ——— */
  var BONUS_KYC = 0, LIM_UNV = null, FAVS = [], THREADS = [], CHAT_UNREAD = 0;
  function limText(){ var l = USER.limit && USER.kyc !== 'full' && USER.limit.limit_kop != null ? USER.limit.limit_kop : LIM_UNV; return l != null ? MC.kop(l) : 'лимита'; }
  function payKop(k){ return Math.max(0, Math.round(k) - (USER.bonus || 0)); }
  function overLimit(k){ var L = USER.limit; return !!(L && L.limit_kop != null && payKop(k) > L.remaining_kop); }
  function limHtml(full){
    var L = USER.limit, h = '';
    if (L.limit_kop == null) h = '<div class="lim-head"><span class="k">Лимит расходов</span><b>без лимита</b></div><p class="lim-note">Верификация пройдена — тратьте без ограничений.</p>';
    else {
      var pct = Math.min(100, Math.round(L.spent_kop / L.limit_kop * 100)), tone = pct >= 90 ? 'hot' : pct >= 70 ? 'warn' : '';
      h = '<div class="lim-head"><span class="k">Лимит расходов' + (USER.kyc === 'full' ? '' : ' без верификации') + '</span><b class="' + tone + '">' + pct + '%</b></div>' +
        '<div class="lim-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i class="' + tone + '" style="width:' + pct + '%"></i></div>' +
        '<div class="lim-foot"><span><b class="mono">' + MC.kop(L.spent_kop) + '</b> из ' + MC.kop(L.limit_kop) + ' · осталось ' + MC.kop(L.remaining_kop) + '</span><span>' + (L.resets_at ? 'Обновится ' + fmtD(L.resets_at, true) : 'Месяц начнётся с первой покупки') + '</span></div>' +
        (full && USER.kyc !== 'full' ? '<p class="lim-note">' + (USER.kyc === 'pending' ? 'Документы на проверке — после одобрения лимит снимется.' : 'Пройдите верификацию — лимит снимется' + (BONUS_KYC ? ' и придёт бонус ' + MC.kop(BONUS_KYC) : '') + '. <button type="button" class="auth-link" data-go="kyc">Пройти</button>') + '</p>' : '');
    }
    if (USER.bonus) h += '<div class="bonus-line">' + ico('gift') + '<span><b>Бонус ' + MC.kop(USER.bonus) + '</b> — скидка при следующей оплате. Списывается целиком, остаток сгорает.</span></div>';
    return h;
  }
  function limitModal(msg){
    modal({ title: 'Лимит расходов', sub: msg, body: USER.limit ? '<div class="lim-card lim-in">' + limHtml(false) + '</div>' : '',
      foot: USER.kyc === 'full' || USER.kyc === 'pending' ? [{ label: 'Понятно' }] : [{ label: 'Позже' }, { label: 'Пройти верификацию', cls: 'btn-primary', onClick: function(){ setTimeout(function(){ go('kyc'); }, 0); } }] });
  }

  /* ——— отзыв о заказе и чат внутри заказа ——— */
  function stars(n){ return '<span class="stars" aria-label="' + n + ' из 5">' + '★★★★★'.slice(0, n) + '<i>' + '★★★★★'.slice(0, 5 - n) + '</i></span>'; }
  function orderExtras(o, early){
    var v = $('orderView').querySelector('.ordv'); if (!v || !o) return;
    var old = v.querySelector('.ordx'); if (old) old.remove();
    var x = document.createElement('div'); x.className = 'ordx';
    var rv = '';
    if (o.status === 'done') rv = o.review ? '<div class="card rev-mine"><div class="row"><h3>Ваш отзыв</h3>' + stars(o.review.rating) + '</div><p>' + esc(o.review.text) + '</p>' + (o.review.status === 'hidden' ? '<p class="hint">Отзыв скрыт модератором.</p>' : '') + (o.review.reply ? '<div class="rev-reply"><b>Ответ Vexel</b>' + esc(o.review.reply) + '</div>' : '') + '<button type="button" class="auth-link" id="revEdit">Изменить</button></div>'
      : early ? '' : '<div class="card rev-ask"><div>' + ico('star') + '<div><b>Как вам покупка?</b><span>Отзыв появится на странице товара и поможет другим покупателям.</span></div></div><button type="button" class="btn btn-primary" id="revNew">Оставить отзыв</button></div>';
    x.innerHTML = rv + '<div class="card ochat"><div class="row"><h3>Чат по заказу</h3><span class="hint">Оператор видит заказ и платёж — пересылать данные не нужно</span></div><div class="chat-box" data-chat="' + esc(o.id) + '"></div></div>';
    v.appendChild(x);
    var b1 = $('revNew') || $('revEdit'); if (b1) b1.addEventListener('click', function(){ reviewModal(o); });
    chatMount(x.querySelector('.chat-box'), o.id);
  }
  function reviewModal(o){
    var r = o.review || {}, rating = r.rating || 5;
    modal({ title: (o.review ? 'Изменить отзыв' : 'Отзыв') + ' · ' + o.title, sub: 'Отзыв появится на странице товара и в общем блоке на странице виртуальной карты.',
      body: '<div class="rate" id="revRate" role="radiogroup" aria-label="Оценка">' + [1, 2, 3, 4, 5].map(function(n){ return '<button type="button" role="radio" data-n="' + n + '" aria-label="' + n + '">★</button>'; }).join('') + '</div>' +
        '<div class="field"><label for="revText">Что понравилось или нет</label><textarea id="revText" rows="4" maxlength="2000" placeholder="Как быстро оформили, всё ли заработало">' + esc(r.text || '') + '</textarea></div>' +
        '<div class="field"><label for="revAuthor">Подпись</label><input id="revAuthor" type="text" maxlength="40" value="' + esc(r.author || (USER.name !== USER.login ? USER.name : '')) + '" placeholder="Покупатель"><span class="hint">Так отзыв будет подписан на сайте. Почту и логин не показываем.</span></div>',
      onOpen: function(){
        var draw = function(){ $('revRate').querySelectorAll('button').forEach(function(b){ var n = +b.getAttribute('data-n'); b.classList.toggle('on', n <= rating); b.setAttribute('aria-checked', n === rating); }); };
        $('revRate').addEventListener('click', function(e){ var b = e.target.closest('button'); if (b) { rating = +b.getAttribute('data-n'); draw(); } }); draw(); $('revText').focus();
      },
      foot: [{ label: 'Отмена' }, { label: 'Опубликовать', cls: 'btn-primary', keep: true, onClick: function(btn){
        var t = $('revText').value.trim(); if (t.length < 3) { $('revText').focus(); toast('Напишите пару слов', '', 'err'); return false; }
        btn.classList.add('is-loading');
        MC.api('POST', '/reviews', { order_id: o.id, rating: rating, text: t, author: $('revAuthor').value }).then(function(res){ closeModal(); o.review = res.review; o.reviewed = true; toast('Спасибо за отзыв!', 'Он уже на странице товара.', 'ok'); orderExtras(o); }, function(e){ btn.classList.remove('is-loading'); fail(e); });
        return false;
      } }] });
  }
  // чат: сообщения, отправка с файлом, опрос новых раз в 5 секунд, пока чат на экране
  function chatMount(el, orderId){
    var msgs = [], last = 0, timer = null;
    el.innerHTML = '<div class="msgs chat-msgs"><div class="hint">Загружаем…</div></div><form class="reply chat-reply"><div class="field"><textarea rows="1" placeholder="' + (orderId ? 'Вопрос по заказу…' : 'Напишите нам…') + '"></textarea></div><input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf"><button type="button" class="icon-btn" data-att aria-label="Прикрепить файл">' + ico('clip') + '</button><button type="submit" class="icon-btn" aria-label="Отправить" style="color:var(--accent)">' + ico('send') + '</button></form><div class="chat-file hint" hidden></div>';
    var box = el.querySelector('.chat-msgs'), form = el.querySelector('form'), ta = form.querySelector('textarea'), fi = form.querySelector('input[type=file]'), fl = el.querySelector('.chat-file');
    function msgHtml(m){
      var f = m.file ? (/^image\//.test(m.file.mime) ? '<a class="att-img" href="' + esc(m.file.url) + '" target="_blank" rel="noopener"><img src="' + esc(m.file.url) + '" alt=""></a>' : '<span class="att">' + ico('clip') + '<a href="' + esc(m.file.url) + '" target="_blank" rel="noopener">' + esc(m.file.name || 'файл') + '</a></span>') : '';
      return '<div class="msg ' + (m.author === 'user' ? 'me' : '') + '">' + (m.text ? esc(m.text) : '') + f + '<time>' + (m.author === 'user' ? 'Вы' : (m.admin_name ? m.admin_name + ' · поддержка' : 'Поддержка')) + ' · ' + fmtD(m.created_at, true) + '</time></div>';
    }
    function draw(){ box.innerHTML = msgs.length ? msgs.map(msgHtml).join('') : '<div class="msg sys">' + (orderId ? 'Есть вопрос по заказу? Напишите — оператор ответит здесь, мы пришлём уведомление.' : 'Напишите нам — ответим здесь, обычно до 15 минут в рабочее время (9–22 МСК).') + '</div>'; box.scrollTop = box.scrollHeight; }
    function pull(){
      if (!document.body.contains(el)) { clearInterval(timer); return; }
      if (document.visibilityState !== 'visible') return;
      MC.api('GET', '/chats/thread?' + (orderId ? 'order=' + encodeURIComponent(orderId) + '&' : '') + 'after=' + last).then(function(r){
        if (r.messages.length) { msgs = msgs.concat(r.messages); last = msgs[msgs.length - 1].id; draw(); } else if (!last) draw();
      }).catch(function(){});
    }
    function send(){
      var t = ta.value.trim(), f = fi.files[0]; if (!t && !f) return;
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      var req;
      if (f) req = MC.shrinkFiles([f]).then(function(fs){ var fd = new FormData(); fd.append('text', t); if (orderId) fd.append('order_id', orderId); fd.append('file', fs[0]); return MC.upload('/chats/send', fd); });
      else req = MC.api('POST', '/chats/send', { text: t, order_id: orderId || undefined });
      req.then(function(r){ btn.disabled = false; ta.value = ''; fi.value = ''; fl.hidden = true; msgs.push(r.message); last = r.message.id; draw(); }, function(e){ btn.disabled = false; toast('Не отправилось', e.message, 'err'); });
    }
    form.addEventListener('submit', function(e){ e.preventDefault(); send(); });
    ta.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    form.querySelector('[data-att]').addEventListener('click', function(){ fi.click(); });
    fi.addEventListener('change', function(){ var f = fi.files[0]; fl.hidden = !f; if (f) fl.textContent = 'Прикреплён файл: ' + f.name + ' · нажмите «Отправить»'; });
    pull(); timer = setInterval(pull, 5000);
  }

  /* ——— поддержка на сервере: общий чат и чаты заказов ——— */
  var baseSupport = R.support;
  R.support = function(param, opts){
    if (!LIVE) return baseSupport(param, opts);
    counters();
    var sel = param && param !== 'new' ? param : (opts && opts.order) || 'general';
    MC.api('GET', '/chats').then(function(r){
      setArr(THREADS, r.threads); CHAT_UNREAD = r.unread; counters();
      var list = [{ key: 'general', title: 'Общий вопрос', sub: 'Всё, что не про конкретный заказ', unread: 0 }];
      r.threads.forEach(function(t){ if (!t.order_id) { list[0].unread = t.unread_user; list[0].at = t.last_message_at; list[0].last = t.last_text; } else list.push({ key: t.order_id, title: t.title, unread: t.unread_user, at: t.last_message_at, last: t.last_text }); });
      $('tkList').innerHTML = list.map(function(t){ return '<button type="button" class="tk ' + (t.key === sel ? 'is-active' : '') + '" data-k="' + esc(t.key) + '"><b>' + esc(t.title) + '</b><span>' + esc(t.last || t.sub || '') + (t.at ? ' · ' + fmtD(t.at, true) : '') + '</span>' + (t.unread ? badge([t.unread + ' новое', 'badge-info']) : '') + '</button>'; }).join('') +
        '<p class="hint" style="padding:8px 4px">Вопрос по заказу удобнее задать из карточки заказа — там же чат.</p>';
      $('tkList').querySelectorAll('.tk').forEach(function(b){ b.addEventListener('click', function(){ go('support', b.getAttribute('data-k'), { keepScroll: true }); }); });
      var th = list.filter(function(t){ return t.key === sel; })[0];
      $('tkView').innerHTML = '<div class="tk-head"><div><h3>' + esc(th ? th.title : 'Заказ ' + sel) + '</h3><div class="meta">' + (sel !== 'general' ? '<button type="button" class="auth-link" data-go="order:' + esc(sel) + '">Открыть заказ ' + esc(sel) + '</button>' : '<span>Оператор ответит здесь и пришлёт уведомление</span>') + '</div></div></div><div class="chat-box"></div>';
      chatMount($('tkView').querySelector('.chat-box'), sel === 'general' ? null : sel);
    }, fail);
  };

  /* ——— избранное ——— */
  R.favs = function(){
    counters();
    var cat = null; MC.liveCatalog().then(function(c){ cat = c; draw(); }); draw();
    function price(slug){ var p = cat && cat.products.filter(function(x){ return x.slug === slug; })[0]; if (!p) return ''; return p.currency === 'usd' && p.from_cents ? 'от $' + (p.from_cents / 100) : p.from_kop ? 'от ' + MC.kop(p.from_kop) : 'по запросу'; }
    function draw(){
      $('favList').innerHTML = FAVS.length ? FAVS.map(function(f){ var href = BASE + (f.slug === 'virtual-card' ? 'virtual-card.html' : 'service/' + f.slug + '/'); var s = svc(f.name), icon = f.icon || (s && s.l) || '';
        return '<div class="fav"><a href="' + href + '" class="fav-main">' + (icon ? '<img class="ord-ico' + (s && s.d ? ' on-dark' : '') + '" src="' + esc(icon) + '" alt="">' : '<span class="ord-ico vc">' + ico('card') + '</span>') + '<span><b>' + esc(f.name) + '</b><span class="hint">' + (f.active ? price(f.slug) : 'сейчас недоступен') + '</span></span></a>' +
          '<div class="fav-act"><a class="btn btn-primary btn-sm" href="' + href + '">Оплатить</a><button type="button" class="icon-btn fav-on" data-unfav="' + esc(f.slug) + '" aria-label="Убрать из избранного">' + ico('heart') + '</button></div></div>'; }).join('')
        : '<div class="empty"><span class="ico">' + ico('heart') + '</span><b>В избранном пусто</b><p>Нажмите ♡ на странице сервиса — он появится здесь, чтобы оплатить позже.</p><a class="btn btn-primary" href="' + BASE + 'catalog.html">Открыть каталог</a></div>';
      $('favList').querySelectorAll('[data-unfav]').forEach(function(b){ b.addEventListener('click', function(){ var sl = b.getAttribute('data-unfav'); MC.api('DELETE', '/favorites/' + encodeURIComponent(sl)).then(function(){ setArr(FAVS, FAVS.filter(function(x){ return x.slug !== sl; })); R.favs(); toast('Убрали из избранного', '', 'ok'); }, fail); }); });
    }
  };

  // обновлённые документы: принять
  function docsPending(){ return DOCS.filter(function(d){ return d.pending; }); }
  function acceptDocs(btn, onOk){
    if (btn) btn.classList.add('is-loading');
    MC.api('POST', '/me/documents', { ids: docsPending().map(function(d){ return d.id; }) }).then(function(){ return load(); }).then(function(){ if (btn) btn.classList.remove('is-loading'); toast('Спасибо, условия приняты', '', 'ok'); if (onOk) onOk(); }, function(e){ if (btn) btn.classList.remove('is-loading'); fail(e); });
  }
  function docsModal(onOk){
    var p = docsPending(); if (!p.length) { if (onOk) onOk(); return; }
    modal({ title: 'Обновились условия', sub: 'Перед покупкой примите новую редакцию.', body: '<ul class="check-marks">' + p.map(function(d){ return '<li><a href="' + esc(d.href) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>, редакция ' + esc(d.ver) + ' от ' + fmtD(d.published) + (d.note ? '<br><span class="hint">' + esc(d.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>',
      foot: [{ label: 'Позже' }, { label: 'Принимаю и продолжаю', cls: 'btn-primary', keep: true, onClick: function(btn){ acceptDocs(btn, function(){ closeModal(); if (onOk) onOk(); }); return false; } }] });
  }
  // подарок: виртуальная карта на почту друга
  var gUsd = 50;
  function giftModal(){
    if (DENOMS.indexOf(gUsd) < 0) gUsd = DENOMS[0];
    modal({ title: 'Подарить карту другу', sub: 'Карта появится в кабинете друга, когда он войдёт или зарегистрируется с этой почтой. Письмо отправим сразу после оплаты.',
      body: (USER.bonus ? '<p class="hint">Бонус ' + MC.kop(USER.bonus) + ' спишется скидкой.</p>' : '') + '<div class="field"><label for="gEmail">Почта друга</label><input id="gEmail" type="email" inputmode="email" autocomplete="off" placeholder="friend@gmail.com"></div><div class="field"><label>Номинал</label><div class="q-denoms" id="gDen"></div></div><dl class="kv"><div><dt>К оплате</dt><dd class="mono" id="gSum"></dd></div><div><dt>На балансе</dt><dd class="mono">' + MC.kop(BAL) + '</dd></div></dl>',
      onOpen: function(){
        function draw(){ $('gDen').innerHTML = DENOMS.map(function(d){ return '<button type="button" aria-pressed="' + (d === gUsd) + '" data-d="' + d + '">$' + d + '</button>'; }).join(''); $('gSum').textContent = rub(total(gUsd)); $('gDen').querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ gUsd = +b.getAttribute('data-d'); draw(); }); }); }
        draw();
      },
      foot: [{ label: 'Отмена' }, { label: 'Подарить', cls: 'btn-primary', keep: true, onClick: function(btn){
        var em = $('gEmail').value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { $('gEmail').setAttribute('aria-invalid', 'true'); $('gEmail').focus(); toast('Почта', 'Укажите почту друга, например friend@gmail.com.', 'err'); return false; }
        if (em === String(USER.email).toLowerCase()) { $('gEmail').focus(); toast('Это ваша почта', 'Чтобы купить себе, используйте «Выпустить карту».', 'err'); return false; }
        cardPlan(gUsd).then(function(pp){ buy(pp, {}, null, btn, function(id){ closeModal(); load().then(function(){ toast('Подарок оформлен', 'Письмо ушло на ' + em, 'ok'); go('order', id); }); }, em); }).catch(fail);
        return false;
      } }] });
  }
  $('giftBtn').addEventListener('click', giftModal);

  // верификация: загрузка файлов на ручную проверку
  function kycUpload(list){
    var n = (list && list.length) || 0; if (!n) return;
    toast('Отправляем файлы', n + ' ' + MC.plural(n, ['файл', 'файла', 'файлов']));
    MC.shrinkFiles(list).then(function(files){ var fd = new FormData(); files.forEach(function(f){ fd.append('files', f); }); return MC.upload('/kyc', fd); })
      .then(function(){ [].forEach.call(list, function(f){ kycFiles.push({ n: f.name, s: (f.size / 1024 / 1024).toFixed(1) + ' МБ' }); }); return load(); })
      .then(function(){ R.kyc(); toast('Документы на проверке', 'Результат придёт в уведомления и на почту.', 'ok'); }, fail);
  }

  // профиль на сервере
  function liveProfile(param){
    $('contactList').innerHTML = '<div><span class="k">Логин</span><span class="v mono">' + esc(USER.login || '—') + '</span></div><div><span class="k">Почта</span><span class="v mono">' + esc(USER.email) + '</span></div><div><span class="k">Телефон</span><span class="v mono">' + esc(USER.rawPhone || 'не указан') + ' <button type="button" class="auth-link" data-ch="phone">' + (USER.rawPhone ? 'Изменить' : 'Добавить') + '</button></span></div><div><span class="k">Telegram</span><span class="v">' + (USER.tg ? '<a class="mono" href="https://t.me/' + esc(USER.tg) + '" target="_blank" rel="noopener">@' + esc(USER.tg) + '</a>' : 'не указан') + ' <button type="button" class="auth-link" data-ch="tg">' + (USER.tg ? 'Изменить' : 'Добавить') + '</button></span></div><div><span class="k">В Vexel с</span><span class="v">' + new Date(USER.since).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + '</span></div>';
    $('contactList').querySelector('[data-ch="tg"]').addEventListener('click', function(){
      modal({ title: 'Telegram', sub: 'Для связи по заказам: оператор сможет написать вам в Telegram.', body: '<div class="field"><label for="ncVal">Имя пользователя</label><input id="ncVal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="@ivan_petrov" value="' + esc(USER.tg ? '@' + USER.tg : '') + '"><span class="hint">Можно вставить ссылку t.me/… Пустое поле — убрать.</span></div>',
        foot: [{ label: 'Отмена' }, { label: 'Сохранить', cls: 'btn-primary', keep: true, onClick: function(){ MC.api('PATCH', '/profile', { telegram: $('ncVal').value }).then(function(r){ closeModal(); applyUser(r.user); R.profile(); toast('Сохранено', '', 'ok'); }, fail); return false; } }] });
    });
    $('contactList').querySelector('[data-ch="phone"]').addEventListener('click', function(){
      modal({ title: 'Телефон', sub: 'Необязательно: для связи по заказам.', body: '<div class="field"><label for="ncVal">Телефон</label><input id="ncVal" type="tel" inputmode="tel" placeholder="+7 900 000-00-00" value="' + esc(USER.rawPhone || '') + '"></div>',
        foot: [{ label: 'Отмена' }, { label: 'Сохранить', cls: 'btn-primary', keep: true, onClick: function(){ MC.api('PATCH', '/profile', { phone: $('ncVal').value }).then(function(r){ closeModal(); applyUser(r.user); R.profile(); toast('Сохранено', '', 'ok'); }, fail); return false; } }] });
    });
    $('pName').value = USER.name;
    $('mfaTgl').checked = false; $('mfaTgl').disabled = true; $('mfaSub').textContent = 'скоро'; $('mfaSetup').hidden = true;
    $('sesN').textContent = SESSIONS.length;
    $('sesList').innerHTML = SESSIONS.map(function(x){ return '<div class="ses">' + ico(x.icon) + '<b>' + esc(x.dev) + (x.cur ? badge(['Это устройство', 'badge-ok']) : '') + '</b><span>' + esc(x.ip) + ' · ' + x.at + '</span>' + (x.cur ? '' : '<button type="button" class="btn btn-ghost" data-kill="' + x.id + '">Завершить</button>') + '</div>'; }).join('');
    $('sesList').querySelectorAll('[data-kill]').forEach(function(b){ b.addEventListener('click', function(){ MC.api('DELETE', '/auth/sessions/' + b.getAttribute('data-kill')).then(function(){ return load(); }).then(function(){ R.profile('sessions'); toast('Сессия завершена', 'Если это были не вы — смените пароль.', 'ok'); }, fail); }); });
    $('consentList').innerHTML = DOCS.map(function(d){ return '<div><span class="k">' + (d.href ? '<a href="' + esc(d.href) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>' : esc(d.name)) + '</span><span class="v">ред. ' + esc(d.ver) + ' · ' + (d.pending ? '<button type="button" class="auth-link" data-go="docs">нужно принять</button>' : 'приняли ' + fmtD(d.at)) + '</span></div>'; }).join('');
    profTab(param || 'contacts');
  }


  // карты на сервере: показ реквизитов по коду из письма, заморозка, пополнение
  function liveCardAct(c, a){
    if (a === 'reveal') {
      MC.api('POST', '/cards/' + c.id + '/reveal-code', {}).then(function(r){
        modal({ title: 'Показать реквизиты •• ' + c.last4, sub: 'Код отправили на ' + USER.email + (r.dev_code ? ' · стенд: ' + r.dev_code : ''), body: otpHtml('suBoxes') + '<p class="hint auth-center">Код действует 10 минут</p>', foot: [{ label: 'Отмена' }],
          onOpen: function(){ wireOtp($('suBoxes'), function(code, box){
            MC.api('POST', '/cards/' + c.id + '/reveal', { code: code }).then(function(d){
              box.classList.add('is-ok'); c.pan = d.pan; c.cvv = d.cvv;
              setTimeout(function(){ closeModal(); revealed[c.id] = d.ttl_sec || 60; R.cards(); clearInterval(revealT[c.id]); revealT[c.id] = setInterval(function(){ revealed[c.id]--; var el = document.querySelector('[data-sec="' + c.id + '"]'); if (el) el.textContent = revealed[c.id]; if (revealed[c.id] <= 0){ clearInterval(revealT[c.id]); delete revealed[c.id]; delete c.pan; delete c.cvv; if (cur === 'cards') R.cards(); } }, 1000); }, 300);
            }, function(e){ box.classList.add('is-err'); toast('Код не подошёл', e.message, 'err'); setTimeout(function(){ box.classList.remove('is-err'); box.querySelectorAll('input').forEach(function(x){ x.value = ''; x.classList.remove('is-filled'); }); box.querySelector('input').focus(); }, 600); });
          }); } });
      }, fail);
    }
    else if (a === 'hide') { clearInterval(revealT[c.id]); delete revealed[c.id]; delete c.pan; delete c.cvv; R.cards(); }
    else if (a === 'topup') { W = { prod: 'topup', card: c.id, usd: 50, step: 2 }; go('new'); }
    else if (a === 'freeze') {
      var to = c.status === 'active';
      var run = function(){ MC.api('POST', '/cards/' + c.id + '/freeze', { frozen: to }).then(function(){ delete revealed[c.id]; delete c.pan; delete c.cvv; return load(); }).then(function(){ R.cards(); toast(to ? 'Карта заморожена' : 'Карта активна', '', 'ok'); }, fail); };
      if (to) modal({ title: 'Заморозить карту •• ' + c.last4 + '?', sub: 'Списания будут отклоняться, баланс сохранится. Разморозить можно в любой момент.', foot: [{ label: 'Отмена' }, { label: 'Заморозить', cls: 'btn-primary', onClick: run }] }); else run();
    }
  }

  // покупка со страницы сервиса или карты (MC.checkout → #checkout)
  function runCheckout(){
    var o = null; try { o = JSON.parse(sessionStorage.getItem('mc-checkout') || 'null'); sessionStorage.removeItem('mc-checkout'); } catch (e) {}
    if (!o || !o.slug) return;
    MC.api('GET', '/catalog/' + encodeURIComponent(o.slug)).then(function(r){
      var pl = r.plans, pp = null, sum = 0;
      if (o.slug === 'virtual-card') {
        var usd = Math.round(+o.usd || 0), fx = pl.filter(function(x){ return x.price_cents === usd * 100 && !x.custom; })[0], cu = pl.filter(function(x){ return x.custom; })[0];
        pp = fx ? { plan_id: fx.id } : cu ? { plan_id: cu.id, amount_cents: usd * 100 } : null; sum = fx ? fx.charged_kop : Math.round(MC.charged(usd) * 100 * r.rate);
      } else {
        var p = pl.filter(function(x){ return x.label === o.plan && x.purchasable; })[0];
        if (p) { pp = { plan_id: p.id }; sum = p.charged_kop; }
      }
      if (!pp) { toast('Тариф недоступен', 'Этот тариф сейчас нельзя купить онлайн — напишите в поддержку.', 'err'); return; }
      var bon = Math.min(USER.bonus || 0, sum), useB = bon > 0;
      var rows = [['Товар', esc(o.title || r.product.name)], ['Цена', '<span class="mono">' + MC.kop(sum) + '</span>']];
      if (bon) rows.push(['Бонус', '<label class="check"><input type="checkbox" id="cbBonus" checked><span class="box"></span><span class="mono">−' + MC.kop(bon) + '</span><span class="sub">' + (USER.bonus > sum ? 'остаток бонуса ' + MC.kop(USER.bonus - sum) + ' сгорит' : 'спишется целиком') + '</span></label>']);
      rows.push(['К оплате', '<b class="mono" id="cbPay">' + MC.kop(sum - bon) + '</b>'], ['На балансе', '<span class="mono">' + MC.kop(BAL) + '</span>']);
      if (o.fields && o.fields.account_email && !o.gift_to) rows.splice(1, 0, ['Аккаунт в сервисе', esc(o.fields.account_email)]);
      if (o.gift_to) rows.splice(1, 0, ['Подарок для', esc(o.gift_to) + '<br><span class="hint">Отправим письмо на эту почту' + (o.slug === 'virtual-card' ? ', карта появится в кабинете получателя' : '') + '</span>']);
      var need = function(){ return sum - (useB ? bon : 0); };
      var subT = function(){ return BAL >= need() ? 'Спишем с баланса, курс зафиксируем в заказе.' : 'На балансе не хватает ' + MC.kop(need() - BAL) + ' — пополним на недостающее, и заказ оформится сам.'; };
      modal({ title: 'Подтвердите покупку', sub: subT(),
        body: '<dl class="kv">' + rows.map(function(x){ return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' + (overLimit(need()) ? '<div class="alert alert-warn">' + ico('warn') + '<div><b>Сумма больше лимита</b>Без верификации — до ' + limText() + ' в месяц, осталось ' + MC.kop(USER.limit.remaining_kop) + '.<div class="alert-actions"><button type="button" class="auth-link" data-go="kyc">Пройти верификацию</button></div></div></div>' : ''),
        onOpen: function(){ var cb = $('cbBonus'); if (cb) cb.addEventListener('change', function(){ useB = cb.checked; $('cbPay').textContent = MC.kop(need()); $('mSub').textContent = subT(); }); },
        foot: [{ label: 'Отмена' }, { label: BAL >= sum - bon ? 'Оплатить' : 'Пополнить и оплатить', cls: 'btn-primary', keep: true, onClick: function(btn){
          buy(pp, o.fields || {}, null, btn, function(id){ closeModal(); load().then(function(){ toast(o.gift_to ? 'Подарок оформлен' : 'Заказ оформлен', o.gift_to ? 'Письмо ушло на ' + o.gift_to : id, 'ok'); go('order', id); }); }, o.gift_to, useB);
          return false;
        } }] });
    }, fail);
  }


  // верификация на сервере: одна проверка (паспорт + селфи), ручная, отказ — с причиной
  function liveKyc(){
    var k = USER.kyc, st = {
      basic: ['Не пройдена', 'badge-plain', 10, 'Без верификации можно тратить до ' + limText() + ' в месяц. Пройдите её — лимит снимется' + (BONUS_KYC ? ', а на бонусный счёт придёт ' + MC.kop(BONUS_KYC) + ' — скидка на следующую покупку' : '') + '.'],
      pending: ['На проверке', 'badge-warn', 70, 'Документы у оператора. Обычно проверяем в течение рабочего дня (9–22 МСК). После одобрения лимит снимется' + (BONUS_KYC ? ' и придёт бонус ' + MC.kop(BONUS_KYC) : '') + ' — пришлём письмо.'],
      full: ['Пройдена', 'badge-ok', 100, 'Лимит расходов снят. Повторно проходить не нужно.'],
      more: ['Отклонена', 'badge-err', 30, 'Причина: ' + (USER.kycReason || 'не указана') + '. Исправьте и загрузите документы ещё раз.']
    }[k] || ['—', 'badge-plain', 0, ''];
    $('kycStatus').innerHTML = '<div class="row"><h3>Статус: ' + st[0] + '</h3>' + badge([st[0], st[1]]) + '</div><p>' + esc(st[3]) + '</p><div class="progress"><i style="--v:' + st[2] + '%"></i></div>' +
      (k === 'pending' ? '<button type="button" class="btn btn-ghost" id="kycFake">' + ico('refresh') + 'Обновить статус</button>' : '') + (USER.limit ? '<div class="lim-card lim-in">' + limHtml(false) + '</div>' : '');
    $('kycLevels').innerHTML = '<div class="lvl ' + (k === 'full' ? 'ok' : 'cur') + '">' + ico(k === 'full' ? 'check' : 'shield') + '<b>Проверка личности</b><span>Фото разворота паспорта с фотографией и селфи с паспортом в руке. Данные видит только модератор.</span>' + badge(k === 'full' ? ['Пройдена', 'badge-ok'] : k === 'pending' ? ['На проверке', 'badge-warn'] : ['Снимает лимит', 'badge-info']) + '</div>';
    $('kycFiles').innerHTML = kycFiles.map(function(f){ return '<li>' + ico('doc') + esc(f.n) + '<span class="mono">' + f.s + '</span></li>'; }).join('');
    var ff = $('kycFake'); if (ff) ff.addEventListener('click', function(){ ff.classList.add('is-loading'); load().then(function(){ R.kyc(); }); });
    var can = k === 'basic' || k === 'more';
    $('kycStart').disabled = !can; $('kycStart').textContent = k === 'more' ? 'Загрузить заново' : 'Загрузить документы';
    var drop = $('kycDrop'); if (drop) { drop.hidden = !can; }
    $('kycLvlH').textContent = 'Что нужно'; $('kycOr').hidden = true;
    $('kycIntro').textContent = 'Загрузите 2 фото: разворот паспорта с фотографией и селфи, где вы держите паспорт рядом с лицом. Всё должно читаться, без бликов. Проверяет модератор Vexel вручную.';
    $('kycDropHint').textContent = 'Паспорт и селфи с паспортом · JPG, PNG, HEIC или PDF до 10 МБ, до 4 файлов';
    $('kycNote').textContent = 'Файлы хранятся в закрытом хранилище, их видит только модератор. Нужны один раз — для открытия покупок.';
  }

  /* ——— выход ——— */
  function logout(e){ if (e) e.preventDefault(); try { localStorage.removeItem('mc-session'); } catch (x) {} var to = function(){ location.href = BASE + 'login.html'; }; if (LIVE) MC.api('POST', '/auth/logout').then(to, to); else to(); }
  $('logout').addEventListener('click', logout); $('logoutM').addEventListener('click', logout);

  /* ——— шапка сайта: «Войти» → имя ——— */
  var hl = document.querySelector('.head-login'); if (hl){ hl.href = '#profile'; hl.setAttribute('data-go', 'profile'); }

  MC.isLive().then(function(on){
    if (!on) { counters(); route(); return; }
    LIVE = true; demo = false;
    $('ovTopup').hidden = false;
    var qt = $('qTabs').querySelector('[data-q]:not([data-q="svc"])'); if (qt) qt.textContent = 'Виртуальная карта'; $('qGo').textContent = 'Оформить карту';
    var wantCheckout = location.hash === '#checkout'; if (wantCheckout) history.replaceState(null, '', '#overview');
    Promise.all([load(), MC.vcPricing().catch(function(){ return null; })]).then(function(x){
      var v = x[1]; if (v && !v.unavailable) { VCP = v; VMIN = v.min; VMAX = v.max; if (v.denoms.length) { DENOMS.length = 0; [].push.apply(DENOMS, v.denoms); if (DENOMS.indexOf(qUsd) < 0) qUsd = DENOMS[0]; } }
      if (!x[0]) return; route(); if (wantCheckout) runCheckout();
      // свежие статусы: раз в минуту и при возврате на вкладку — колокольчик загорится, если заказ изменился
      var busy = false;
      function refresh(){
        if (busy || document.visibilityState !== 'visible') return; busy = true;
        load().then(function(){ busy = false; if ($('modal').hidden && (cur === 'overview' || cur === 'orders' || cur === 'cards' || cur === 'docs' || cur === 'favs')) R[cur](null, { keepScroll: true }); }, function(){ busy = false; });
      }
      setInterval(refresh, 60000);
      document.addEventListener('visibilitychange', refresh);
    });
  });
  MC.initReveal();
})();
