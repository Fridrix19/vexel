(function(){
  var MC = window.MC, $ = MC.$, CAT = MC.CATALOG, reduce = MC.reduce;
  var RATE = MC.RATE, ISSUE_FEE = 5, FEE_RATE = 0.20, DENOM = 20;

  /* — сцена 1: плитки из каталога — */
  var tiles = $('scTiles');
  ['Cursor AI', 'ChatGPT Plus', 'Netflix', 'Steam'].forEach(function(n, i){
    var s = CAT.services.find(function(x){ return x.n === n; }); if (!s) return;
    var d = document.createElement('div'); d.className = 'sc-tile sc-anim' + (i === 0 ? ' pick' : ''); d.style.setProperty('--sd', (0.5 + i * 0.08) + 's');
    d.innerHTML = '<img alt="" src="' + s.l + '"' + (s.d ? ' class="on-dark"' : '') + '><span class="t"><b>' + s.n + '</b><span>' + CAT.catName[s.c] + '</span></span>';
    tiles.appendChild(d);
  });
  document.querySelectorAll('#scene1 .sc-plan').forEach(function(p, i){ p.classList.add('sc-anim'); p.style.setProperty('--sd', (1 + i * 0.06) + 's'); });

  /* — сцена 2: расчёт как на странице карты — */
  var fee = DENOM * FEE_RATE + ISSUE_FEE, total = (DENOM + fee) * RATE;
  $('scSum').innerHTML = '<div class="sc-anim" style="--sd:.9s"><dt>Cursor Pro · номинал</dt><dd>' + MC.usd(DENOM) + ' → ' + MC.rub(DENOM * RATE) + '</dd></div>'
    + '<div class="sc-anim" style="--sd:1s"><dt>Комиссия и выпуск</dt><dd>' + MC.rub(fee * RATE) + '</dd></div>'
    + '<div class="total sc-anim" style="--sd:1.1s"><dt>Итого</dt><dd>' + MC.rub(total) + '</dd></div>';
  $('scTotal').textContent = MC.rub(total);
  var f2 = document.querySelector('#scene2 .sc-field'); f2.classList.add('sc-anim');
  document.querySelector('#scene2 .sc-btn').style.setProperty('--sd', '1.2s');

  /* — сцена 3: псевдо-QR (детерминированный узор с finder-паттернами) — */
  (function(){
    var N = 25, seed = 7, cells = [];
    function rnd(){ seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    function finder(x, y){ for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) { var on = i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4); if (on) cells.push([x + j, y + i]); } }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var inF = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8); if (inF) continue;
      if (rnd() < 0.44) cells.push([x, y]);
    }
    $('scQr').innerHTML = cells.map(function(c){ return '<rect x="' + c[0] + '" y="' + c[1] + '" width="1" height="1"/>'; }).join('');
    var t = document.querySelector('#scene3 .sc-qr'); t.classList.add('sc-anim'); t.style.setProperty('--sd', '.1s');
  })();

  /* — набор текста в полях — */
  var typers = [];
  function typeInto(scene, done){
    typers.forEach(clearTimeout); typers = [];
    var el = scene.querySelector('.type'); if (!el) return;
    var txt = el.getAttribute('data-text'), inp = el.closest('.sc-input');
    el.textContent = ''; if (inp) inp.classList.remove('is-done');
    if (reduce) { el.textContent = txt; if (inp) inp.classList.add('is-done'); return; }
    var i = 0, start = scene.id === 'scene2' ? 900 : 500;
    function step(){ el.textContent = txt.slice(0, ++i); if (i < txt.length) typers.push(setTimeout(step, 55 + Math.random() * 70)); else if (inp) typers.push(setTimeout(function(){ inp.classList.add('is-done'); }, 350)); }
    typers.push(setTimeout(step, start));
  }

  /* — таймер СБП (декоративный) — */
  var tmr = null;
  function startTimer(){
    clearInterval(tmr); var s = 9 * 60 + 58, el = $('scTimer');
    function draw(){ el.textContent = ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
    draw(); if (reduce) return;
    tmr = setInterval(function(){ s--; if (s < 0) { clearInterval(tmr); return; } draw(); }, 1000);
  }

  /* — сцена 3: шаги в банке завершаются вместе с «Оплачено» — */
  var stTimer = null;
  function stepperReset(){
    clearTimeout(stTimer); var lis = document.querySelectorAll('#scStepper li');
    lis[0].className = 'done'; lis[1].className = 'current'; lis[2].className = '';
    if (reduce) { lis[1].className = 'done'; lis[2].className = 'done'; return; }
    stTimer = setTimeout(function(){ lis[1].className = 'done'; lis[2].className = 'current'; }, 2000);
    typers.push(setTimeout(function(){ lis[2].className = 'done'; }, 3000));
  }

  /* — контроллер шагов: автопрокрутка, клик, пауза при наведении — */
  var steps = Array.prototype.slice.call(document.querySelectorAll('#hiwSteps .hiw-step'));
  var scenes = steps.map(function(_, i){ return $('scene' + (i + 1)); });
  var DUR = 7000, cur = -1, auto = !reduce, timer = null, paused = false;
  var screen = $('hiwScreen');

  function go(i, timed){
    if (i === cur) { restartTimer(); return; }
    cur = i;
    steps.forEach(function(li, k){
      var on = k === i; li.classList.toggle('is-active', on); li.classList.toggle('is-timed', on && !!timed);
      li.querySelector('button').setAttribute('aria-expanded', on ? 'true' : 'false');
      var bar = li.querySelector('.hs-bar i'); if (on && timed) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; bar.style.setProperty('--dur', DUR + 'ms'); }
    });
    scenes.forEach(function(sc, k){
      var on = k === i;
      if (on) { sc.classList.remove('is-active'); void sc.offsetWidth; } // перезапуск CSS-анимаций сцены
      sc.classList.toggle('is-active', on);
    });
    typeInto(scenes[i]);
    if (i === 2) { startTimer(); stepperReset(); } else clearInterval(tmr);
    restartTimer();
  }
  function restartTimer(){ clearTimeout(timer); if (auto && !paused) timer = setTimeout(function(){ go((cur + 1) % steps.length, true); }, DUR); }

  steps.forEach(function(li, i){ li.querySelector('button').addEventListener('click', function(){ auto = false; go(i, false); }); });
  screen.addEventListener('pointerenter', function(){ paused = true; clearTimeout(timer); steps.forEach(function(li){ var b = li.querySelector('.hs-bar i'); b.style.animationPlayState = 'paused'; }); });
  screen.addEventListener('pointerleave', function(){ paused = false; steps.forEach(function(li){ var b = li.querySelector('.hs-bar i'); b.style.animationPlayState = ''; }); restartTimer(); });
  document.addEventListener('visibilitychange', function(){ if (document.hidden) clearTimeout(timer); else restartTimer(); });

  // стартуем, когда блок попал в экран — иначе анимации первой сцены пройдут «вхолостую»
  var startedFlow = false;
  function startFlow(){ if (startedFlow) return; startedFlow = true; go(0, auto); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ if (es.some(function(e){ return e.isIntersecting; })) { startFlow(); io.disconnect(); } }, {threshold:.25});
    io.observe($('steps'));
    steps.forEach(function(li, k){ li.classList.toggle('is-active', k === 0); }); scenes[0].classList.add('is-active');
  } else startFlow();

  /* — письмо: подсветка частей — */
  var parts = document.querySelectorAll('#letterMock .lt-part'), notes = document.querySelectorAll('#letterNotes li');
  function hi(p){
    parts.forEach(function(el){ el.classList.toggle('is-hi', el.getAttribute('data-part') === p); });
    notes.forEach(function(el){ el.classList.toggle('is-hi', el.getAttribute('data-part') === p); });
  }
  notes.forEach(function(li){
    var p = li.getAttribute('data-part'); li.tabIndex = 0;
    li.addEventListener('pointerenter', function(){ hi(p); }); li.addEventListener('focus', function(){ hi(p); }); li.addEventListener('click', function(){ hi(p); if (window.innerWidth <= 1000) { var t = document.querySelector('#letterMock [data-part="' + p + '"]'); if (t) t.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'}); } });
  });
  parts.forEach(function(el){ el.addEventListener('pointerenter', function(){ hi(el.getAttribute('data-part')); }); });
  hi('1');

  MC.initReveal();
})();
