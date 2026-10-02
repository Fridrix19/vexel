(function(){
  var MC = window.MC, $ = MC.$, CAT = MC.CATALOG, reduce = MC.reduce;
  var SEC = /*__SECTION__*/;
  var all = CAT.services.filter(function(s){ return s.c === SEC.cat; });
  document.addEventListener('mc:catalog', function(){ all = CAT.services.filter(function(s){ return s.c === SEC.cat; }); shown = 0; render(false); var n = document.querySelector('[data-sec-count]'); if (n) n.textContent = all.length; });
  var grid = $('secGrid'), sub = $('secSub'), q = $('secSearch'), more = $('secMore'), count = $('secCount');
  var active = 'all', query = '', shown = 0, PAGE = 18;
  var SUBS = [['all', 'Все']].concat(SEC.subcats);
  function counts(id){ return id === 'all' ? all.length : all.filter(function(s){ return (SEC.items[s.n] || [])[0] === id; }).length; }

  SUBS.forEach(function(c, i){
    if (c[0] !== 'all' && !counts(c[0])) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cat cat-sub'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false'); b.dataset.id = c[0];
    b.innerHTML = '<span>' + c[1] + '</span><span class="n">' + counts(c[0]) + '</span>';
    b.addEventListener('click', function(){ active = c[0]; [].forEach.call(sub.children, function(o){ o.setAttribute('aria-selected', o === b ? 'true' : 'false'); }); b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); shown = 0; render(true); });
    sub.appendChild(b);
  });

  function matches(s){ var m = SEC.items[s.n] || []; return (active === 'all' || m[0] === active) && (!query || s.n.toLowerCase().indexOf(query) !== -1 || (m[1] || '').toLowerCase().indexOf(query) !== -1); }
  function card(s){
    var m = SEC.items[s.n] || ['', ''], p = SEC.prices[s.n], subName = (SEC.subcats.find(function(x){ return x[0] === m[0]; }) || ['', ''])[1];
    var a = document.createElement('article'); a.className = 'card svc-card'; a.setAttribute('role', 'listitem');
    a.innerHTML = '<div class="svc-head"><img class="svc-logo-sm' + (s.d ? ' on-dark' : '') + '" alt="" src="' + s.l + '">' + (subName ? '<span class="badge badge-plain">' + subName + '</span>' : '') + '</div><h3>' + s.n + '</h3><p>' + (m[1] || s.desc || '') + '</p><span class="svc-price" data-price-slug="' + MC.slugOf(s.h) + '">' + (p ? 'от <b>$' + p.v + '</b>' + (p.m ? ' / мес' : '') : 'по запросу') + '</span><div class="card-foot"><a class="btn btn-ghost btn-sm" href="' + (window.MC_BASE || '') + s.h + '">Оплатить</a></div>';
    return a;
  }
  function render(swap){
    var list = all.filter(matches), next = Math.min(list.length, shown + PAGE);
    grid.innerHTML = '';
    if (swap) { grid.classList.remove('swap'); void grid.offsetWidth; grid.classList.add('swap'); }
    if (!list.length) {
      var e = document.createElement('div'); e.className = 'empty'; e.style.gridColumn = '1/-1';
      e.innerHTML = '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></div><b>Ничего не найдено по «' + query.replace(/</g, '&lt;') + '»</b><p>Проверьте написание или посмотрите весь раздел.</p><button type="button" class="btn btn-ghost btn-sm" id="secReset">Сбросить поиск</button>';
      grid.appendChild(e);
      $('secReset').addEventListener('click', function(){ q.value = ''; query = ''; shown = 0; render(true); q.focus(); });
    }
    list.slice(0, next).forEach(function(s){ grid.appendChild(card(s)); });
    shown = next;
    count.textContent = list.length ? (query ? 'Найдено ' + list.length : (shown < list.length ? 'Показано ' + shown + ' из ' + list.length : list.length + ' ' + MC.plural(list.length, ['сервис', 'сервиса', 'сервисов']))) : '';
    more.hidden = shown >= list.length; more.textContent = 'Показать ещё ' + Math.min(PAGE, list.length - shown);
  }
  more.addEventListener('click', function(){ render(false); });
  var qt = null; q.addEventListener('input', function(){ clearTimeout(qt); qt = setTimeout(function(){ query = q.value.trim().toLowerCase(); shown = 0; render(true); }, 120); });
  render(false);
  MC.initReveal();
})();
