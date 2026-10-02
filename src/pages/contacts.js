(function(){
  var MC = window.MC, $ = MC.$, reduce = MC.reduce;
  var OPEN = 9, CLOSE = 22; // МСК

  /* — тема → рекомендуемый канал — */
  var TOPICS = [
    { id:'pay', n:'Оплата и СБП', rec:['tg'] },
    { id:'card', n:'Привязка карты', rec:['tg'] },
    { id:'mail', n:'Письмо не пришло', rec:['tg','max'] },
    { id:'refund', n:'Возврат', rec:['mail'] },
    { id:'docs', n:'Документы и юрлица', rec:['mail'] },
    { id:'choose', n:'Выбор сервиса', rec:['tg','max'] }
  ];
  var wrap = $('ctTopics'), cards = document.querySelectorAll('.ct-ch'), cur = null;
  TOPICS.forEach(function(t){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cat'; b.setAttribute('role','tab'); b.setAttribute('aria-selected','false'); b.textContent = t.n;
    b.addEventListener('click', function(){ pick(cur === t.id ? null : t.id); });
    wrap.appendChild(b);
  });
  function pick(id){
    cur = id; var t = TOPICS.filter(function(x){ return x.id === id; })[0];
    wrap.querySelectorAll('.cat').forEach(function(b, i){ b.setAttribute('aria-selected', TOPICS[i].id === id ? 'true' : 'false'); });
    cards.forEach(function(c){
      var rec = t ? t.rec.indexOf(c.dataset.ch) >= 0 : false;
      c.classList.toggle('is-rec', rec); c.classList.toggle('is-dim', !!t && !rec);
    });
  }

  /* — статус: онлайн по МСК — */
  function msk(){ var d = new Date(); return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000); }
  function status(){
    var m = msk(), h = m.getHours(), on = h >= OPEN && h < CLOSE;
    $('ctStatus').textContent = on ? 'Онлайн' : 'Офлайн';
    $('ctStatusSub').textContent = on ? 'ответим в течение ~15 мин' : 'ответим с ' + OPEN + ':00 МСК';
    document.querySelectorAll('.ct-sla').forEach(function(s){ s.classList.toggle('is-online', on); });
    var days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'], today = (m.getDay() + 6) % 7;
    $('ctWeek').innerHTML = days.map(function(d, i){ return '<li' + (i === today ? ' class="is-today"' : '') + '>' + d + '<b>' + OPEN + '–' + CLOSE + '</b></li>'; }).join('');
  }
  status(); setInterval(status, 60000);

  /* — копирование — */
  document.querySelectorAll('[data-copy]').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.getAttribute('data-copy');
      var done = function(){ b.classList.add('is-done'); toast('Скопировано', v); setTimeout(function(){ b.classList.remove('is-done'); }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done); else done();
    });
  });
  function toast(title, body){
    var st = $('toasts'); var t = document.createElement('div'); t.className = 'toast toast-ok';
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg><div><b>' + title + '</b>' + body + '</div><button type="button" class="x" aria-label="Закрыть">×</button>';
    t.querySelector('.x').addEventListener('click', function(){ t.remove(); }); st.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
  }
  MC.initReveal();
})();
