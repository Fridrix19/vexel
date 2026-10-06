window.MC = (function(){
  var CATALOG = /*__CATALOG__*/;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0});
  var $ = function(id){ return document.getElementById(id); };
  function usd(v){ return '$' + v.toFixed(2); }
  function rub(v){ return nf.format(Math.round(v)) + ' ₽'; }
  function plural(n, f){ n = Math.abs(n) % 100; var d = n % 10; return (n > 10 && n < 20) ? f[2] : (d > 1 && d < 5) ? f[1] : (d === 1) ? f[0] : f[2]; }
  /* формула сайта (payment-flow.v2.js → computeChargedUsd): до $45 — (сумма + $5) × 1.2, выше — сумма × 1.3 */
  function charged(u){ var b = Number(u) || 20; return Math.round((b <= 45 ? (b + 5) * 1.2 : b * 1.3) * 100) / 100; }
  function bump(el){ if (reduce || !el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  /* — витрина сервисов: категории + поиск, плитки ведут на страницы сервисов — */
  function initShowcase(opts){
    opts = opts || {};
    if (!$('cats')) return;
  var cats = $('cats'), tiles = $('tiles'), more = $('tilesMore'), q = $('svcSearch');
  var activeCat = 'all', query = '', shown = 0, PAGE = opts.page || 20;
  var CATS = [{ id:'all', name:'Все', icon:CATALOG.allIcon, count:CATALOG.services.length }].concat(CATALOG.categories);
  CATS.forEach(function(c, i){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cat'; b.setAttribute('role','tab');
    b.id = 'cat-' + c.id; b.setAttribute('aria-selected', i === 0 ? 'true':'false'); b.tabIndex = i === 0 ? 0 : -1;
    b.innerHTML = '<img alt="" src="' + c.icon + '"><span>' + c.name + '</span><span class="n">' + c.count + '</span>';
    b.addEventListener('click', function(){ selectCat(i, true); });
    b.addEventListener('keydown', function(e){
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? CATS.length - 1 : null;
      if (n === null) return; e.preventDefault();
      n = (n + CATS.length) % CATS.length; selectCat(n, true); cats.children[n].focus();
    });
    cats.appendChild(b);
  });
  function selectCat(i, user){
    activeCat = CATS[i].id;
    [].forEach.call(cats.children, function(b, k){ b.setAttribute('aria-selected', k === i ? 'true':'false'); b.tabIndex = k === i ? 0 : -1; });
    if (user) cats.children[i].scrollIntoView({block:'nearest', inline:'nearest', behavior: reduce ? 'auto' : 'smooth'});
    shown = 0; renderTiles(true);
  }
  function matches(s){
    return (activeCat === 'all' || s.c === activeCat) && (!query || s.n.toLowerCase().indexOf(query) !== -1);
  }
  function renderTiles(swap){
    var list = CATALOG.services.filter(matches);
    var next = Math.min(list.length, shown + PAGE);
    tiles.innerHTML = '';
    if (swap) { tiles.classList.remove('swap'); void tiles.offsetWidth; tiles.classList.add('swap'); }
    if (!list.length) {
      var e = document.createElement('div'); e.className = 'tiles-empty';
      e.innerHTML = '<b>Ничего не найдено по «' + query.replace(/</g,'&lt;') + '»</b>Проверьте написание или <button type="button" id="resetSearch">сбросьте поиск</button>';
      tiles.appendChild(e);
      e.querySelector('#resetSearch').addEventListener('click', function(){ q.value = ''; query = ''; shown = 0; renderTiles(true); q.focus(); });
    }
    list.slice(0, next).forEach(function(s){
      var t = document.createElement('a');
      t.className = 'tile tile-link' + (opts.current === s.h ? ' is-current' : ''); t.href = (opts.base || window.MC_BASE || '') + s.h; t.setAttribute('role','listitem');
      if (opts.current === s.h) t.setAttribute('aria-current','page');
      var sub = opts.sub ? opts.sub(s) : null;
      t.innerHTML = '<img alt="" class="' + (s.d ? 'on-dark' : '') + '" src="' + s.l + '"><span class="t"><b>' + s.n + '</b>' + (sub ? '<span>' + sub + '</span>' : '<span class="cat-name">' + CATALOG.catName[s.c] + '</span>') + '</span>';
      tiles.appendChild(t);
    });
    shown = next;
    $('tilesCount').textContent = list.length ? (query ? 'Найдено ' + list.length : 'Показано ' + shown + ' из ' + list.length) : '';
    more.hidden = shown >= list.length;
    more.textContent = 'Показать ещё ' + Math.min(PAGE, list.length - shown);
  }
  more.addEventListener('click', function(){ renderTiles(false); });
  var qt = null;
  q.addEventListener('input', function(){
    clearTimeout(qt);
    qt = setTimeout(function(){ query = q.value.trim().toLowerCase(); shown = 0; renderTiles(true); }, 120);
  });
  var start = Math.max(0, CATS.findIndex(function(c){ return c.id === (opts.cat || 'all'); }));
  selectCat(start, false);
  document.addEventListener('mc:catalog', function(){
    CATS[0].count = CATALOG.services.length;
    [].forEach.call(cats.children, function(b, k){ var n = b.querySelector('.n'); if (n && CATS[k]) n.textContent = CATS[k].count; });
    shown = 0; renderTiles(false);
  });
  }

  /* — появление панелей и линии таймлайна — */
  function initReveal(){
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, {rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
    var io2 = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in-view'); io2.unobserve(e.target); } }); }, {threshold:.35});
    if ($('timeline')) io2.observe($('timeline'));
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
    if ($('timeline')) $('timeline').classList.add('in-view');
  }

  }

  /* — тема: тёмный экран CRT по умолчанию, светлый «режим печати» — по переключателю; выбор запоминается в браузере; переключателей может быть несколько (шапка, мобильный лист) — */
  function setTheme(next){
    var root = document.documentElement;
    // на время смены темы гасим все transition, иначе страница «размазывается»
    var kill = document.createElement('style'); kill.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(kill); void document.body.offsetHeight;
    root.setAttribute('data-mc-theme', next); root.classList.toggle('mc-dark', next !== 'light');
    try { localStorage.setItem('mc-theme', next); } catch (e) {}
    syncTheme();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ kill.remove(); }); });
  }
  function syncTheme(){
    var light = document.documentElement.getAttribute('data-mc-theme') === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(function(btn){
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
      btn.setAttribute('aria-label', light ? 'Включить экран CRT' : 'Включить режим печати'); var l = btn.querySelector('.tb-l'); if (l) l.textContent = light ? 'Экран CRT' : 'Режим печати';
    });
    var sw = $('sheetTheme'); if (sw) sw.checked = !light;
  }
  function initTheme(){
    var btns = document.querySelectorAll('[data-theme-toggle]'); if (!btns.length) return;
    btns.forEach(function(btn){ btn.addEventListener('click', function(){ setTheme(document.documentElement.getAttribute('data-mc-theme') === 'light' ? 'dark' : 'light'); }); });
    var sw = $('sheetTheme'); if (sw) sw.addEventListener('change', function(){ setTheme(sw.checked ? 'dark' : 'light'); });
    if (document.readyState === 'complete') syncTheme(); else window.addEventListener('load', function(){ setTimeout(syncTheme, 0); }, { once: true });
  }

  /* — мобильный нижний бар: лист «Ещё» — */
  function initTabbar(){
    var more = $('tabMore'), wrap = $('moreSheet'); if (!more || !wrap) return;
    var lastFocus = null;
    function open(){ lastFocus = document.activeElement; wrap.hidden = false; more.setAttribute('aria-expanded', 'true'); document.body.classList.add('sheet-open'); requestAnimationFrame(function(){ wrap.classList.add('in'); var f = wrap.querySelector('.sheet a, .sheet button'); if (f) f.focus(); }); }
    function close(){ wrap.classList.remove('in'); more.setAttribute('aria-expanded', 'false'); document.body.classList.remove('sheet-open'); setTimeout(function(){ wrap.hidden = true; if (lastFocus) lastFocus.focus(); }, reduce ? 0 : 260); }
    more.addEventListener('click', function(){ wrap.hidden ? open() : close(); });
    wrap.querySelectorAll('[data-sheet-close]').forEach(function(el){ el.addEventListener('click', close); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !wrap.hidden) close(); });
    wrap.querySelectorAll('.sheet a').forEach(function(a){ a.addEventListener('click', close); });
  }
  initTabbar();

  /* — мобильная плашка оплаты: зеркалит итог расчёта, показывается пока итог не виден — */
  function initPaybar(){
    var bar = $('paybar'), total = $('rowTotal'), pay = $('pay'), calc = document.querySelector('.calc'), cfg = document.querySelector('.config');
    if (!bar || !total || !pay || !calc || !cfg || !('IntersectionObserver' in window)) return;
    var label = document.querySelector('[data-pb-label]'), cfgIn = false, totIn = false;
    function mirror(){
      $('pbTotal').textContent = total.textContent;
      if (label) $('pbLabel').textContent = label.textContent;
      $('pbPay').textContent = /^Запросить/.test(pay.textContent) ? 'Запросить' : 'Оплатить';
    }
    function sync(){ bar.hidden = !(cfgIn && !totIn && window.innerWidth <= 760); }
    new MutationObserver(mirror).observe(total, { childList: true, characterData: true, subtree: true });
    if (label) new MutationObserver(mirror).observe(label, { childList: true, characterData: true, subtree: true });
    new IntersectionObserver(function(es){ es.forEach(function(e){ cfgIn = e.isIntersecting; }); sync(); }, { rootMargin: '-25% 0px -10% 0px' }).observe(cfg);
    new IntersectionObserver(function(es){ es.forEach(function(e){ totIn = e.isIntersecting; }); sync(); }, { threshold: 0.6 }).observe(calc.querySelector('.calc-total') || calc);
    window.addEventListener('resize', sync);
    $('pbPay').addEventListener('click', function(){ calc.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); setTimeout(function(){ pay.click(); }, reduce ? 0 : 450); });
    mirror();
  }

  /* — API бэкенда. На статике (Vercel, артефакт, file://) /api нет — страницы работают в демо-режиме — */
  var API = window.MC_API || '/api', liveP = null;
  function isLive(){
    if (!liveP) liveP = (location.protocol === 'file:' || !window.fetch) ? Promise.resolve(false)
      : fetch(API + '/health', { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : null; })
          .then(function(j){ return !!(j && j.ok); }).catch(function(){ return false; });
    return liveP;
  }
  function api(method, path, body){
    return fetch(API + path, { method: method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(j){
          if (r.ok) return j;
          var d = j.data || {}, e = new Error(r.status >= 500 ? 'Что-то пошло не так. Попробуйте ещё раз.' : (j.message || 'Ошибка запроса'));
          e.status = r.status; e.code = d.code || 'error'; e.data = d; throw e;
        });
      }, function(){ var e = new Error('Нет связи с сервером. Проверьте интернет.'); e.code = 'network'; throw e; });
  }
  /* — сессия на любой странице: вместо «Войти» — имя и ссылка в кабинет — */
  var meP = null;
  function me(){ if (!meP) meP = isLive().then(function(on){ return on ? api('GET', '/auth/me').then(function(r){ return r.user; }, function(){ return null; }) : null; }); return meP; }
  function initSession(){
    me().then(function(u){
      if (!u) return;
      var base = window.MC_BASE || '', name = u.name || u.username || u.email.split('@')[0];
      document.querySelectorAll('.head-login').forEach(function(a){ if (!a.hasAttribute('data-go')) a.href = base + 'dashboard.html'; a.lastChild.textContent = name; a.title = u.email; a.classList.add('is-auth'); });
      document.querySelectorAll('.sheet-login').forEach(function(a){ a.href = base + 'dashboard.html'; a.lastChild.textContent = 'Личный кабинет'; });
    });
  }
  /* — живой каталог: цены, скрытые и новые товары из админки (только когда рядом есть сервер) — */
  var catP = null, LIVE_CAT = null;
  function liveCatalog(){ if (!catP) catP = isLive().then(function(on){ return on ? api('GET', '/catalog').catch(function(){ return null; }) : null; }); return catP; }
  function slugOf(h){ return String(h || '').replace(/^.*service\//, '').replace(/\/.*$/, ''); }
  function fmtUsd(c){ var v = c / 100; return v % 1 ? v.toFixed(2) : String(v); }
  function priceHtml(p){
    if (!p) return 'недоступно';
    var mo = /month|\/mo\b|мес/i.test(p.from_text || '');
    if (p.currency === 'usd' && p.from_cents) return 'от <b>$' + fmtUsd(p.from_cents) + '</b>' + (mo ? ' / мес' : '');
    if (p.currency === 'rub' && p.from_kop) return 'от <b>' + kop(p.from_kop) + '</b>' + (mo ? ' / мес' : '');
    return 'по запросу';
  }
  function applyPrices(root){
    if (!LIVE_CAT) return;
    (root.querySelectorAll ? root : document).querySelectorAll('[data-price-slug]').forEach(function(el){
      var p = LIVE_CAT.bySlug[el.getAttribute('data-price-slug')];
      el.innerHTML = priceHtml(p);
      var card = el.closest('.svc-card, .pop-card, article'); if (card && !p) card.hidden = true;
    });
    (root.querySelectorAll ? root : document).querySelectorAll('[data-price-cat]').forEach(function(el){
      var cid = el.getAttribute('data-price-cat'), best = null;
      LIVE_CAT.products.forEach(function(p){ if (p.category === cid && p.currency === 'usd' && p.from_cents && (!best || p.from_cents < best.from_cents)) best = p; });
      if (best) el.innerHTML = priceHtml(best).replace(' / мес', ' в месяц');
    });
  }
  function syncCatalog(){
    liveCatalog().then(function(r){
      if (!r) return;
      var bySlug = {}; r.products.forEach(function(p){ bySlug[p.slug] = p; });
      LIVE_CAT = { bySlug: bySlug, products: r.products, rate: r.rate };
      var known = {};
      for (var i = CATALOG.services.length - 1; i >= 0; i--) { var sl = slugOf(CATALOG.services[i].h); known[sl] = 1; if (!bySlug[sl]) CATALOG.services.splice(i, 1); }
      r.products.forEach(function(p){
        if (known[p.slug] || p.category === 'cards' || !CATALOG.catName[p.category]) return;
        CATALOG.services.unshift({ n: String(p.name).replace(/[<>&"]/g, ''), l: /^(\/|https:)/.test(p.icon || '') ? p.icon : CATALOG.allIcon, h: 'service/' + p.slug + '/', c: p.category, d: 0, desc: String(p.description || '').replace(/[<>&"]/g, '') });   // новые — первыми
      });
      CATALOG.categories.forEach(function(c){ c.count = CATALOG.services.filter(function(s){ return s.c === c.id; }).length; });
      MC.RATE = r.rate;
      applyPrices(document);
      if (window.MutationObserver) new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if (n.nodeType === 1) applyPrices(n.parentNode || n); }); }); }).observe(document.body, { childList: true, subtree: true });
      document.dispatchEvent(new CustomEvent('mc:catalog', { detail: LIVE_CAT }));
    });
  }
  /* — цены виртуальной карты с сервера (номиналы, своя сумма, курс и комиссия из админки) — */
  var vcP = null;
  function vcPricing(){
    if (!vcP) vcP = isLive().then(function(on){
      if (!on) return null;
      return api('GET', '/catalog/virtual-card').then(function(r){
        var pct = r.product.commission_pct, cu = r.plans.filter(function(p){ return p.custom; })[0];
        return {
          rate: r.rate, plans: r.plans, min: cu ? cu.custom.min_cents / 100 : 50, max: cu ? cu.custom.max_cents / 100 : 200,
          denoms: r.plans.filter(function(p){ return !p.custom && p.purchasable && p.currency === 'usd'; }).map(function(p){ return p.price_cents / 100; }),
          total: function(usd){
            var cents = Math.round(usd * 100), fx = r.plans.filter(function(p){ return !p.custom && p.price_cents === cents && p.charged_kop != null; })[0];
            if (fx) return fx.charged_kop / 100;
            var u = cents / 100, c = pct == null ? Math.round((u <= 45 ? (u + 5) * 1.2 : u * 1.3) * 100) : Math.round(cents * (1 + pct / 100));
            return Math.round(c * r.rate) / 100;
          }
        };
      }, function(e){ return e.status === 404 ? { unavailable: true } : null; });
    });
    return vcP;
  }
  /* — покупка со страницы сервиса/карты: запоминаем выбор и ведём в кабинет (без входа — через вход) — */
  function checkout(o){
    try { sessionStorage.setItem('mc-checkout', JSON.stringify(o)); } catch (e) {}
    var base = window.MC_BASE || '', dest = 'dashboard.html#checkout';
    return me().then(function(u){ location.href = base + (u ? dest : 'login.html?next=' + encodeURIComponent(dest)); });
  }
  function kop(v){ return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: v % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(v / 100) + ' ₽'; }
  function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2); }

  /* — контакты и действующие документы (правятся в админке → Настройки) — */
  var CONTACTS = { email: 'support@vexel.ru', telegram: 'vexel_support', max: 'vexel_support' }, siteP = null;
  function site(){ if (!siteP) siteP = isLive().then(function(on){ return on ? api('GET', '/site').catch(function(){ return null; }) : null; }); return siteP; }
  function applyContacts(){
    var c = CONTACTS, L = { tg: 'https://t.me/' + c.telegram, max: 'https://max.ru/' + c.max, mail: 'mailto:' + c.email }, T = { tg: '@' + c.telegram, max: c.max, mail: c.email };
    document.querySelectorAll('[data-contact]').forEach(function(a){ var k = a.getAttribute('data-contact'), h = a.getAttribute('href') || '', q = h.indexOf('?'); if (L[k]) a.href = L[k] + (k === 'mail' && q > 0 ? h.slice(q) : ''); });
    document.querySelectorAll('[data-contact-text]').forEach(function(el){ var k = el.getAttribute('data-contact-text'); if (T[k]) el.textContent = T[k]; });
    document.querySelectorAll('[data-contact-copy]').forEach(function(el){ var k = el.getAttribute('data-contact-copy'); if (T[k]) el.setAttribute('data-copy', T[k]); });
  }
  function applyDocs(root, docs){
    var by = {}; (docs || []).forEach(function(d){ by[d.kind] = d; });
    (root || document).querySelectorAll('a[data-doc]').forEach(function(a){ var d = by[a.getAttribute('data-doc')]; if (d && d.url) { a.href = d.url; a.title = d.title + ', редакция ' + d.version; } });
  }
  function initSite(){
    site().then(function(r){
      if (!r) return;
      if (r.contacts) for (var k in r.contacts) if (r.contacts[k]) CONTACTS[k] = r.contacts[k];
      DOCS.length = 0; (r.documents || []).forEach(function(d){ DOCS.push(d); });
      applyContacts(); applyDocs(document, DOCS);
      document.dispatchEvent(new CustomEvent('mc:contacts', { detail: CONTACTS }));
    });
  }
  var DOCS = [];

  /* — аналитика: просмотры страниц, время на странице (пока вкладка видна), прокрутка, клики — и гостей, и пользователей.
       Только на сайте с сервером; id браузера — случайный, без личных данных. Введённые значения полей не собираются. — */
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function initTrack(){
    if (/^\/admin/.test(location.pathname)) return;
    isLive().then(function(on){
      if (!on) return;
      var Q = [], aid = store('mc-aid'), sid, last = +store('mc-sid-at') || 0;
      if (!aid || !/^[\w-]{8,64}$/.test(aid)) { aid = uid().replace(/[^\w-]/g, '').slice(0, 40); store('mc-aid', aid); }
      sid = store('mc-sid');
      if (!sid || Date.now() - last > 30 * 60000) { sid = uid().replace(/[^\w-]/g, '').slice(0, 40); store('mc-sid', sid); }
      function touch(){ store('mc-sid-at', String(Date.now())); }
      var cur = null, shown = 0, acc = 0, maxScroll = 0;
      function path(){ var h = location.hash.replace(/^#/, '').split(':')[0]; return location.pathname + (/dashboard/.test(location.pathname) && /^[a-z]+$/.test(h) ? '#' + h : ''); }
      function scrollPct(){ var d = document.documentElement, h = d.scrollHeight - innerHeight; return h > 0 ? Math.min(100, Math.round(scrollY / h * 100)) : 100; }
      function push(e){ e.ts = Date.now(); Q.push(e); touch(); if (Q.length >= 40) flush(); }
      function view(){ cur = path(); acc = 0; shown = document.visibilityState === 'visible' ? Date.now() : 0; maxScroll = scrollPct(); push({ t: 'view', p: cur }); }
      var paused = null;
      function leave(keep){ if (!cur) return; var d = acc + (shown ? Date.now() - shown : 0); push({ t: 'leave', p: cur, d: d, sp: maxScroll }); paused = keep ? cur : null; cur = null; acc = 0; shown = 0; }
      function check(){ var p = path(); if (p !== cur) { leave(); view(); } }
      function flush(beacon){
        if (!Q.length) return;
        var body = JSON.stringify({ a: aid, s: sid, r: document.referrer || '', e: Q.splice(0, 50) });
        if (beacon && navigator.sendBeacon) { try { if (navigator.sendBeacon(API + '/t', new Blob([body], { type: 'application/json' }))) return; } catch (e) {} }
        fetch(API + '/t', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
      }
      addEventListener('scroll', function(){ var s = scrollPct(); if (s > maxScroll) maxScroll = s; }, { passive: true });
      document.addEventListener('visibilitychange', function(){
        if (document.visibilityState === 'hidden') { leave(true); flush(true); }
        else if (paused && paused === path()) { cur = paused; paused = null; acc = 0; shown = Date.now(); }
        else if (!cur) view();   // вернулись на вкладку — время продолжает копиться без нового просмотра
      });
      addEventListener('pagehide', function(){ leave(); flush(true); });
      addEventListener('hashchange', check);
      ['pushState', 'replaceState'].forEach(function(m){ var o = history[m]; history[m] = function(){ var r = o.apply(this, arguments); setTimeout(check, 0); return r; }; });
      document.addEventListener('click', function(ev){
        var el = ev.target.closest && ev.target.closest('a, button, [role="button"], [role="tab"], summary, label, .plan, .denom, .tile, .svc-card');
        if (!el) return;
        var sec = el.closest('[id]'), tg = el.id ? '#' + el.id : (sec && sec !== el ? '#' + sec.id + ' ' : '') +
          (el.getAttribute('data-go') ? 'go:' + el.getAttribute('data-go') : el.getAttribute('href') && el.getAttribute('href') !== '#' ? el.getAttribute('href').split('?')[0] : el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : ''));
        var lb = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        push({ t: 'click', p: cur || path(), tg: tg.slice(0, 200), l: lb });
      }, true);
      view();
      setInterval(function(){ flush(); }, 10000);
      // уведомление о статистике — один раз
      if (!store('mc-stat-ok') && !/dashboard|login/.test(location.pathname)) {
        var n = document.createElement('div'); n.className = 'stat-note'; n.setAttribute('role', 'status');
        n.innerHTML = '<span>Мы учитываем посещения страниц и нажатия, чтобы делать сайт удобнее. Подробнее — в <a data-doc="privacy" href="' + (window.MC_BASE || '') + 'legal-files/privacy.pdf" target="_blank" rel="noopener">политике конфиденциальности</a>.</span><button type="button" class="btn btn-ghost btn-sm">Понятно</button>';
        n.querySelector('button').addEventListener('click', function(){ store('mc-stat-ok', '1'); n.remove(); });
        document.body.appendChild(n); site().then(function(){ applyDocs(n, DOCS); });
      }
    });
  }

  /* — поле-число: свои кнопки −/+ вместо системных стрелок — */
  function enhanceNumber(inp){
    if (inp.__ns || inp.closest('.p-inputnumber, .num-step')) return; inp.__ns = 1;
    var w = document.createElement('span'); w.className = 'num-step';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    [['-1', '−', 'Меньше'], ['1', '+', 'Больше']].forEach(function(b){
      var x = document.createElement('button'); x.type = 'button'; x.className = 'ns-btn'; x.textContent = b[1]; x.setAttribute('aria-label', b[2]); x.tabIndex = -1;
      x.addEventListener('click', function(){
        var st = +inp.step || 1, mn = inp.min !== '' ? +inp.min : -Infinity, mx = inp.max !== '' ? +inp.max : Infinity, v = +inp.value;
        if (!isFinite(v) || inp.value === '') v = isFinite(mn) ? mn : 0; else v = v + st * +b[0];
        v = Math.min(mx, Math.max(mn, Math.round(v / st) * st));
        inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
      w.appendChild(x);
    });
  }
  function initNumbers(){
    if (/^\/admin/.test(location.pathname)) return;
    document.querySelectorAll('input[type="number"]').forEach(enhanceNumber);
    if (window.MutationObserver) new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if (n.nodeType !== 1) return; if (n.matches && n.matches('input[type="number"]')) enhanceNumber(n); else if (n.querySelectorAll) n.querySelectorAll('input[type="number"]').forEach(enhanceNumber); }); }); }).observe(document.body, { childList: true, subtree: true });
  }

  /* — кому: себе (почта аккаунта) или «Подарить другу» — над полем почты на страницах оплаты — */
  var rcpN = 0;
  function recipient(input){
    var field = input && input.closest('.field'), mode = 'me', mine = '';
    if (!field) return { gift: function(){ return null; }, mode: function(){ return 'me'; } };
    var n = 'rcp' + (++rcpN), lbl = field.querySelector('label'), base = lbl ? lbl.textContent : '', ph = input.placeholder, typed = '';
    var wrap = document.createElement('div'); wrap.className = 'check-list rcp'; wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', 'Кому');
    wrap.innerHTML = '<label class="check radio"><input type="radio" name="' + n + '" value="me" checked><span class="box"></span><span>На мою почту<span class="sub" data-rcp-me>почта, на которую придут данные</span></span></label>' +
      '<label class="check radio"><input type="radio" name="' + n + '" value="gift"><span class="box"></span><span>Подарить другу<span class="sub">отправим на почту друга, оплата — с вашего баланса</span></span></label>';
    field.parentNode.insertBefore(wrap, field);
    function set(m){
      if (m === mode) return;
      if (mode === 'me') typed = input.value;
      mode = m; input.removeAttribute('aria-invalid');
      if (m === 'gift') { if (lbl) lbl.textContent = 'Почта друга'; input.value = ''; input.placeholder = 'friend@gmail.com'; input.focus(); }
      else { if (lbl) lbl.textContent = base; input.placeholder = ph; input.value = mine || typed; }
      input.dispatchEvent(new CustomEvent('mc:recipient', { detail: m }));
    }
    wrap.addEventListener('change', function(e){ if (e.target.name === n) set(e.target.value); });
    me().then(function(u){
      if (!u) return; mine = u.email;
      wrap.querySelector('[data-rcp-me]').textContent = u.email + ' — почта аккаунта';
      if (mode === 'me' && !input.value) input.value = mine;
    });
    return { gift: function(){ return mode === 'gift' ? input.value.trim().toLowerCase() : null; }, mode: function(){ return mode; } };
  }

  /* — отзывы: ?product=slug на странице товара, все вместе — на странице виртуальной карты — */
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
  function initReviews(slug){
    var list = document.querySelector('[data-rv-list]'); if (!list) return;
    var more = document.querySelector('[data-rv-more]'), sum = document.querySelector('[data-rv-sum]'), off = 0, all = !slug;
    function star(n){ return '<span class="rv-stars" aria-label="' + n + ' из 5">' + '★★★★★'.slice(0, n) + '<i>' + '★★★★★'.slice(0, 5 - n) + '</i></span>'; }
    function item(r){
      var d = new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      var prod = all ? '<a class="rv-prod" href="' + (window.MC_BASE || '') + (r.slug === 'virtual-card' ? 'virtual-card.html' : 'service/' + esc(r.slug) + '/') + '">' + (r.product_icon ? '<img src="' + esc(r.product_icon) + '" alt="">' : '') + esc(r.product_name) + '</a>' : (r.plan_label ? '<span class="rv-plan">' + esc(r.plan_label) + '</span>' : '');
      return '<article class="rv-item"><header><span class="rv-av">' + esc(String(r.author || 'П').charAt(0).toUpperCase()) + '</span><div><b>' + esc(r.author) + '</b><span>' + d + '</span></div>' + star(r.rating) + '</header>' + prod +
        '<p>' + esc(r.text) + '</p>' + (r.reply ? '<div class="rv-reply"><b>Ответ Vexel</b>' + esc(r.reply) + '</div>' : '') + '</article>';
    }
    function load(){
      api('GET', '/reviews?limit=12&offset=' + off + (slug ? '&product=' + encodeURIComponent(slug) : '')).then(function(r){
        document.querySelectorAll('[data-rv-count]').forEach(function(el){ el.textContent = r.total; });
        if (!off) list.innerHTML = '';
        if (!r.total) { list.innerHTML = '<p class="rv-empty">' + (all ? 'Пока нет отзывов — они появятся после первых покупок.' : '0 отзывов — станьте первым после покупки.') + '</p>'; return; }
        list.insertAdjacentHTML('beforeend', r.reviews.map(item).join(''));
        off += r.reviews.length; if (more) more.hidden = off >= r.total;
        if (sum && r.total) { sum.hidden = false; sum.innerHTML = '<b>' + String(r.avg).replace('.', ',') + '</b>' + star(Math.round(r.avg)) + '<span>' + r.total + ' ' + plural(r.total, ['отзыв', 'отзыва', 'отзывов']) + '</span>'; }
      }).catch(function(){});
    }
    if (more) more.addEventListener('click', load);
    isLive().then(function(on){ if (on) load(); });
  }
  /* — избранное: сердечко на странице товара; без входа — запомним и вернёмся после входа — */
  function initFav(slug){
    var btn = document.querySelector('[data-fav]'); if (!btn || !slug) return;
    var on = false, label = btn.querySelector('span');
    function set(v){ on = v; btn.setAttribute('aria-pressed', v); btn.classList.toggle('is-on', v); label.textContent = v ? 'В избранном' : 'В избранное'; }
    isLive().then(function(live){
      if (!live) { btn.hidden = true; return; }
      me().then(function(u){
        if (!u) { btn.addEventListener('click', function(){ try { sessionStorage.setItem('mc-fav', slug); } catch (e) {} location.href = (window.MC_BASE || '') + 'login.html?next=' + encodeURIComponent(location.pathname.replace(/^\//, '').replace(/index\.html$/, '')); }); return; }
        api('GET', '/favorites').then(function(r){
          set(r.favorites.some(function(f){ return f.slug === slug; }));
          var pend = null; try { pend = sessionStorage.getItem('mc-fav'); sessionStorage.removeItem('mc-fav'); } catch (e) {}
          if (pend === slug && !on) api('POST', '/favorites', { slug: slug }).then(function(){ set(true); });
        });
        btn.addEventListener('click', function(){
          var v = !on; set(v);
          (v ? api('POST', '/favorites', { slug: slug }) : api('DELETE', '/favorites/' + encodeURIComponent(slug))).catch(function(){ set(!v); });
        });
      });
    });
  }


  /* — разделы каталога: плитки с крупным числом и стопкой логотипов (главная и каталог) — */
  function dirTiles(el, META, o){
    if (!el) return; o = o || {};
    var base = o.base || '', GO = '<span class="dir-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>';
    var vc = document.createElement('a'); vc.className = 'dir dir-vc'; vc.href = base + 'virtual-card.html';
    vc.innerHTML = '<div class="dir-vc-copy"><span class="dir-k">Для любого сервиса</span><h3>Виртуальная карта</h3><p>Долларовая карта без привязки к каталогу. Выпуск за 15 минут, пополнение по СБП.</p><div class="dir-chips"><span>USD</span><span>$50–200</span><span>многоразовая</span></div></div>'
      + '<div class="dir-mini" aria-hidden="true"><span class="dm-back"></span><span class="dm-card"><i class="dm-chip"></i><b>vexel</b><em>4021 •••• 7788</em></span></div>' + GO;
    el.appendChild(vc);
    CATALOG.categories.forEach(function(c){
      var m = (META && META.cats && META.cats[c.id]) || { text: '', top: [] }, shown = 0;
      var logos = (m.top || []).slice(0, 4).map(function(n){ var s = CATALOG.services.find(function(x){ return x.n === n; }); if (!s) return ''; shown++; return '<img alt="' + s.n + '" title="' + s.n + '"' + (s.d ? ' class="on-dark"' : '') + ' src="' + s.l + '">'; }).join('');
      var rest = c.count - shown;
      var a = document.createElement('a'); a.className = 'dir'; a.href = base + 'section/' + c.id + '/index.html';
      a.innerHTML = '<div class="dir-top"><span class="dir-n">' + c.count + '</span><span class="dir-nw">' + plural(c.count, ['сервис','сервиса','сервисов']) + '</span></div>' + GO
        + '<div class="dir-logos">' + logos + (rest > 0 ? '<span class="more">+' + rest + '</span>' : '') + '</div>'
        + '<h3>' + c.name + '</h3><p>' + (m.text || '') + '</p>'
        + (m.from ? '<span class="dir-from" data-price-cat="' + c.id + '">от <b>$' + m.from + '</b>' + (m.monthly ? ' в месяц' : '') + '</span>' : '');
      el.appendChild(a);
    });
  }


  /* — «Назад» в хлебных крошках: если пришли с этого же сайта — шаг назад по истории, иначе — на уровень выше по ссылке — */
  function initBack(){
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('[data-back]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (_) {}
      if ((same || a.hasAttribute('data-back-hist')) && history.length > 1) { e.preventDefault(); history.back(); }
    });
  }

  initPaybar();
  initTheme();
  initBack();
  initSession();
  syncCatalog();
  initSite();
  initTrack();
  initNumbers();

  return { CATALOG: CATALOG, RATE: 80.2254, charged: charged, reduce: reduce, usd: usd, rub: rub, bump: bump, plural: plural, $: $, initShowcase: initShowcase, initReveal: initReveal, api: api, isLive: isLive, kop: kop, uid: uid, me: me, checkout: checkout, liveCatalog: liveCatalog, slugOf: slugOf, vcPricing: vcPricing, site: site, contacts: CONTACTS, docs: DOCS, applyDocs: applyDocs, recipient: recipient, initReviews: initReviews, initFav: initFav, dirTiles: dirTiles };
})();
