(function(){
  var MC = window.MC, $ = MC.$, usd = MC.usd, rub = MC.rub;
  var SVC = /*__SERVICE__*/;                       // null — общая страница для товаров, добавленных в админке
  var RATE = MC.RATE;
  /* формула с сайта (payment-flow.v2.js → computeChargedUsd): до $45 — (цена + $5) × 1.2, выше — цена × 1.3; 0 и пусто → базовые $20 */
  function quote(u){ return { base: u, usd: MC.charged(u) }; }
  /* итог в рублях: с сервера (актуальная цена, курс и комиссия из админки), иначе — по формуле прототипа */
  function totalRub(p){ return p.kop != null ? p.kop / 100 : quote(p.usd).usd * RATE; }
  function payable(p){ return p.kop != null || (typeof p.usd === 'number' && p.usd > 0 && !p.live); }
  /* форматы цен — те же функции, что на сайте (payment-flow.v2.js): короткая для карточек и расчёта, полная для деталей */
  var PF = window.MC_PRICE;
  function ru(t){ return String(t || '').replace(/^Free$/i,'Бесплатно').replace(/^Custom(?: pricing)?$/i,'По запросу').replace(/^Уточняется$/,'По запросу')
    .replace(/\bbilled monthly\b/gi,'ежемесячно').replace(/\bbilled yearly\b/gi,'при оплате за год').replace(/\bbilled\s+/gi,'').replace(/\btokens\b/gi,'токенов').replace(/\bcredits\b/gi,'кредитов').replace(/\s+at\s+/gi,' · ').replace(/\bper user\b/gi,'за пользователя').replace(/\bper seat\b/gi,'за место'); }
  function priceShort(p){ return p.rubText ? p.rubText : ru(PF.monthly(p.priceText, p.usd)); }
  function priceFull(p){ return p.rubText ? p.rubText : ru(PF.localize(p.priceText)); }
  var pay = $('pay'), status = $('status'), email = $('email'), emailHint = $('emailHint'), details = $('planDetails');
  var groups = $('planGroups'), current = null, buttons = [];
  var RCP = MC.recipient(email);
  email.addEventListener('mc:recipient', function(e){ emailHint.className = 'hint'; emailHint.textContent = e.detail === 'gift' ? 'Подписку оформим на аккаунт друга с этой почтой — пришлём ему письмо.' : 'Отправим номер карты, срок, CVC и инструкцию по привязке к ' + SVC.short + '.'; });

  function start(){
    groups.innerHTML = ''; buttons = [];
    SVC.groups.forEach(function(g){
      if (!g.plans.length) return;
      var wrap = document.createElement('div'); wrap.className = 'plan-group';
      if (SVC.groups.filter(function(x){ return x.plans.length; }).length > 1) { var h = document.createElement('h4'); h.textContent = g.name; wrap.appendChild(h); }
      var grid = document.createElement('div'); grid.className = 'plans'; grid.setAttribute('role','group'); grid.setAttribute('aria-label', g.name);
      g.plans.forEach(function(p){
        var b = document.createElement('button'); b.type = 'button'; b.className = 'plan';
        b.innerHTML = '<b>' + esc(p.label) + '</b><span class="price">' + esc(priceShort(p)) + '</span>' +
          (p.free ? '<span class="rub ask">бесплатно</span>' : !payable(p) ? '<span class="rub ask">по запросу</span>' : '<span class="rub">' + rub(totalRub(p)) + '</span>');
        b.addEventListener('click', function(){ select(p, b); });
        grid.appendChild(b); buttons.push(b);
      });
      wrap.appendChild(grid); groups.appendChild(wrap);
    });
    // стартовый план — первый платный, чтобы расчёт сразу был содержательным
    var all = [].concat.apply([], SVC.groups.map(function(g){ return g.plans; }));
    if (!all.length) { unavailable('Тарифы скоро появятся — напишите в поддержку, посчитаем вручную.'); return; }
    var first = all.filter(payable)[0] || all[0];
    select(first, buttons[all.indexOf(first)]);
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

  function select(p, b){
    current = p;
    buttons.forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true':'false'); });
    var feats = String(p.features || '').split('\n').map(function(s){ return s.replace(/^•\s*/,'').trim(); }).filter(Boolean);
    var shortP = priceShort(p), fullP = priceFull(p);
    details.innerHTML = '<h4>' + esc(p.label) + '</h4><span class="pd-price">' + esc(shortP) + '</span><p>' + esc(p.description || '') + '</p>' + (fullP && fullP !== shortP ? '<p class="pd-note">Условия: ' + esc(fullP) + '</p>' : '') +
      (feats.length ? '<ul>' + feats.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '');
    MC.bump(details);
    render();
  }

  function render(){
    $('calcSub').textContent = SVC.name + ' · ' + current.label;
    $('rowPlan').textContent = priceShort(current);
    if (current.free) {
      $('rowComm').textContent = '—'; $('rowTotal').textContent = 'бесплатно';
      pay.textContent = 'Оплата не требуется'; pay.disabled = true; MC.bump($('rowTotal')); return;
    }
    pay.disabled = false;
    if (!payable(current)) {
      $('rowComm').textContent = '—'; $('rowTotal').textContent = 'по запросу';
      pay.textContent = 'Запросить расчёт'; MC.bump($('rowTotal')); return;
    }
    var tot = totalRub(current), sub = current.rubBase != null ? current.rubBase : (current.usd || 0) * RATE;
    $('rowComm').textContent = rub(Math.max(0, tot - sub));
    $('rowTotal').textContent = rub(tot);
    pay.textContent = 'Оплатить ' + rub(tot);
    MC.bump($('rowTotal'));
  }

  function unavailable(text){
    groups.innerHTML = ''; details.innerHTML = '<p>' + esc(text) + '</p>';
    $('rowPlan').textContent = '—'; $('rowComm').textContent = '—'; $('rowTotal').textContent = '—';
    pay.textContent = 'Сейчас недоступно'; pay.disabled = true; current = null;
  }

  pay.addEventListener('click', function(){
    if (!current) return;
    var v = email.value.trim(), ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (!ok) {
      email.setAttribute('aria-invalid','true'); emailHint.className = 'hint err';
      emailHint.textContent = 'Укажите почту в виде mail@example.ru — на неё придут реквизиты.';
      status.className = 'calc-status bad'; status.textContent = 'Не удалось перейти к оплате: проверьте почту.';
      email.focus(); return;
    }
    email.removeAttribute('aria-invalid'); emailHint.className = 'hint';
    emailHint.textContent = RCP.mode() === 'gift' ? 'Подписку оформим на аккаунт друга с этой почтой — пришлём ему письмо.' : 'Отправим номер карты, срок, CVC и инструкцию по привязке к ' + SVC.short + '.';
    status.className = 'calc-status ok';
    var demoText = !payable(current) ? 'Прототип: заявка на индивидуальный расчёт уйдёт в поддержку.' : 'Прототип: здесь откроется окно СБП на ' + rub(totalRub(current)) + '.';
    MC.isLive().then(function(on){
      if (!on || !payable(current)) { status.textContent = on ? 'Индивидуальный расчёт — напишите в поддержку, посчитаем под ваш тариф.' : demoText; return; }
      status.textContent = 'Переходим к оплате…'; pay.disabled = true;
      MC.checkout({ slug: SLUG, plan: current.label, fields: { account_email: v }, gift_to: RCP.gift() || undefined, title: SVC.name + ' · ' + current.label, back: location.pathname });
    });
  });

  /* — живые данные из админки: цены, новые и выключенные тарифы, выключенный товар — */
  var SLUG = SVC ? MC.slugOf(SVC.href) : MC.slugOf(location.pathname);
  function fromApi(r){
    var byLabel = {}, used = {};
    r.plans.forEach(function(p){ byLabel[p.label] = p; });
    function merge(p, a){
      return { label: a.label, usd: a.currency === 'usd' && a.price_cents ? a.price_cents / 100 : (a.free ? 0 : null), free: a.free,
        priceText: a.price_text || (p && p.priceText) || '', description: a.description || (p && p.description) || '', features: (p && p.features) || '',
        kop: a.purchasable && a.charged_kop != null ? a.charged_kop : null, live: true,
        rubText: a.currency === 'rub' ? (a.price_text || rub((a.price_kop || 0) / 100)) : null, rubBase: a.currency === 'rub' ? (a.price_kop || 0) / 100 : null };
    }
    var gs = (SVC ? SVC.groups : [{ name: r.product.name, plans: [] }]).map(function(g){
      return { name: g.name, plans: g.plans.filter(function(p){ return byLabel[p.label]; }).map(function(p){ used[p.label] = 1; return merge(p, byLabel[p.label]); }) };
    });
    var extra = r.plans.filter(function(a){ return !used[a.label] && !a.custom; }).map(function(a){ return merge(null, a); });
    if (extra.length) { if (!gs.length) gs.push({ name: r.product.name, plans: [] }); gs[gs.length - 1].plans = gs[gs.length - 1].plans.concat(extra); }
    return gs;
  }
  function fillDynamic(p){
    // общая страница: заполняем тексты из товара
    var name = p.name;
    document.title = name + ' — Vexel';
    var h1 = document.querySelector('.hsv-copy h1'); if (h1) h1.textContent = name;
    var lg = document.querySelector('.hsv-logo'); if (lg) { var img = lg.querySelector('img'); if (p.icon && img) img.src = p.icon; else lg.classList.add('is-empty'); }
    var lead = h1 && h1.nextElementSibling; if (lead) lead.textContent = (p.description ? p.description + ' ' : '') + 'Оплатите виртуальной картой через СБП — данные и инструкция придут на почту и в кабинет.';
    var crumb = document.querySelector('.crumbs [aria-current="page"]'); if (crumb) crumb.textContent = name;
    var cat = MC.CATALOG.categories.filter(function(c){ return c.id === p.category; })[0], cl = document.querySelector('.crumbs a[href*="section/"]');
    if (cat && cl) { cl.href = (window.MC_BASE || '') + 'section/' + cat.id + '/index.html'; cl.lastChild.textContent = cat.name; var ci = cl.querySelector('img'); if (ci) ci.src = cat.icon; }
    document.querySelectorAll('h2, .step-hint, #emailHint, #calcSub').forEach(function(el){ el.textContent = el.textContent.replace(/Сервис/g, name); });
  }
  if (SVC) start();
  else { SVC = { name: 'Сервис', short: 'сервису', href: 'service/' + SLUG + '/', groups: [] }; unavailable('Загружаем тарифы…'); }
  MC.isLive().then(function(on){
    if (!on) { if (!SVC.groups.length) unavailable('Страница доступна только на сайте.'); return; }
    MC.api('GET', '/catalog/' + encodeURIComponent(SLUG)).then(function(r){
      RATE = r.rate;
      if (!SVC.groups.length) { SVC.name = r.product.name; SVC.short = r.product.name; SVC.cat = r.product.category; fillDynamic(r.product); }
      SVC.groups = fromApi(r);
      start();
      var all = [].concat.apply([], SVC.groups.map(function(g){ return g.plans; })), paid = all.filter(payable);
      var facts = document.querySelectorAll('.facts .fact');
      if (facts[0] && paid.length) { var m = paid.reduce(function(a, b){ return totalRub(a) <= totalRub(b) ? a : b; }); facts[0].querySelector('b').textContent = m.rubText ? 'от ' + rub(totalRub(m)) : 'от $' + (m.usd % 1 ? m.usd.toFixed(2) : m.usd); }
      if (facts[2]) facts[2].querySelector('b').textContent = all.length + ' ' + MC.plural(all.length, ['вариант', 'варианта', 'вариантов']);
    }, function(e){
      if (e.status === 404) unavailable('Этот сервис сейчас недоступен для оплаты. Посмотрите другие в каталоге или напишите в поддержку.');
    });
  });

  MC.initReviews(SLUG); MC.initFav(SLUG);
  MC.initShowcase({ cat: SVC.cat || 'all', current: SVC.href });
  MC.initReveal();
})();
