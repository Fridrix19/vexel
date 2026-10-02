(function(){
  var MC = window.MC, $ = MC.$, usd = MC.usd, rub = MC.rub, reduce = MC.reduce;
  var RATE = MC.RATE, MIN = 50, MAX = 200;
  var den = 50, mode = 'fixed';
  var total = function(d){ return MC.charged(d) * RATE; };  // как на сайте: номинал × 1.3 (≥ $50); на сервере — цены из админки (ниже)
  var pay = $('pay'), status = $('status'), email = $('email'), emailHint = $('emailHint');
  var RCP = MC.recipient(email);
  email.addEventListener('mc:recipient', function(e){ emailHint.className = 'hint'; emailHint.textContent = e.detail === 'gift' ? 'Карта появится в кабинете друга, когда он войдёт с этой почтой. Письмо отправим сразу.' : 'Сюда придут реквизиты и инструкция.'; });

  function render(){
    $('rowDen').textContent = '$' + den;
    $('rowTotal').textContent = rub(total(den));
    pay.textContent = 'Оплатить ' + rub(total(den));
    MC.bump($('rowTotal'));
  }
  document.querySelectorAll('.denom').forEach(function(b){
    b.querySelector('span').textContent = rub(total(+b.dataset.den));
    b.addEventListener('click', function(){
      den = +b.dataset.den;
      document.querySelectorAll('.denom').forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true':'false'); });
      render();
    });
  });
  function setMode(next){
    mode = next;
    $('tabFixed').setAttribute('aria-pressed', next === 'fixed' ? 'true':'false');
    $('tabCustom').setAttribute('aria-pressed', next === 'custom' ? 'true':'false');
    $('denoms').hidden = next !== 'fixed';
    $('customRow').hidden = next !== 'custom';
    if (next === 'custom') { $('customAmount').value = den; }
  }
  $('tabFixed').addEventListener('click', function(){ setMode('fixed'); });
  $('tabCustom').addEventListener('click', function(){ setMode('custom'); });
  $('customAmount').addEventListener('input', function(){ den = Math.min(MAX, Math.max(MIN, +this.value || 0)); render(); });

  MC.vcPricing().then(function(v){
    if (!v) return;
    if (v.unavailable) { pay.disabled = true; pay.textContent = 'Выпуск карт временно недоступен'; return; }
    total = v.total; MIN = v.min; MAX = v.max;
    $('customAmount').min = MIN; $('customAmount').max = MAX;
    document.querySelectorAll('.denom').forEach(function(b){ var d = +b.dataset.den; b.hidden = v.denoms.indexOf(d) < 0; b.querySelector('span').textContent = rub(total(d)); });
    render();
  });
  pay.addEventListener('click', function(){
    var v = email.value.trim(), ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (!ok) {
      email.setAttribute('aria-invalid','true'); emailHint.className = 'hint err';
      emailHint.textContent = 'Укажите почту в виде mail@example.ru.';
      status.className = 'calc-status bad'; status.textContent = 'Проверьте почту — без неё не отправить реквизиты.';
      email.focus(); return;
    }
    email.removeAttribute('aria-invalid'); emailHint.className = 'hint';
    emailHint.textContent = RCP.mode() === 'gift' ? 'Карта появится в кабинете друга, когда он войдёт с этой почтой.' : 'Сюда придут реквизиты и инструкция.';
    status.className = 'calc-status ok';
    MC.isLive().then(function(on){
      if (!on) { status.textContent = 'Прототип: здесь откроется окно СБП на ' + rub(total(den)) + '.'; return; }
      status.textContent = 'Переходим к оплате…'; pay.disabled = true;
      MC.checkout({ slug: 'virtual-card', usd: den, fields: {}, gift_to: RCP.gift() || undefined, title: (RCP.gift() ? 'Подарок: виртуальная карта' : 'Виртуальная карта') + ' · $' + den, back: location.pathname });
    });
  });

  /* — карта: наклон за курсором, автовращение на паузе — */
  var stage = $('cardStage'), tilt = $('cardTilt');
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    stage.addEventListener('pointermove', function(e){
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tilt.style.setProperty('--ty', (x * 26).toFixed(1)); tilt.style.setProperty('--tx', (-8 - y * 22).toFixed(1));
    });
    stage.addEventListener('pointerleave', function(){ tilt.style.removeProperty('--ty'); tilt.style.removeProperty('--tx'); });
  }


  MC.initReviews(null);
  MC.initShowcase({ cat: 'all' });
  MC.initReveal();
  render();
})();
