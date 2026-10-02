(function(){
  var MC = window.MC, $ = MC.$, reduce = MC.reduce;
  var TOPICS = [['all','Все'],['pay','Оплата'],['card','Карта'],['mail','Письмо'],['svc','Сервисы'],['money','Возвраты и лимиты']];
  var FAQ = [
    { id:'flow', t:'pay', q:'Как проходит оплата?', a:'<p>Выбираете сервис или номинал карты, указываете почту, платите по QR через СБП. В течение 15 минут на почту приходят реквизиты карты и инструкция.</p>', top:true },
    { id:'sbp-only', t:'pay', q:'Почему только СБП?', a:'<p>СБП работает у всех российских банков, без комиссии банка и ввода данных карты. Итог в рублях виден до оплаты.</p>' },
    { id:'rub', t:'pay', q:'Сколько это стоит в рублях?', a:'<p>Номинал в долларах по курсу ЦБ плюс комиссия — всё считается в расчёте до оплаты. Скрытых списаний нет: на сайте вы платите один раз, дальше сервис списывает с карты.</p>' },
    { id:'sbp-stuck', t:'pay', q:'Оплата по СБП не проходит', a:'<p>Сканируйте QR камерой приложения банка и проверьте лимит СБП — иногда он ниже суммы заказа. Если деньги списались, не платите повторно: статус обновится в течение 5 минут.</p>' },
    { id:'card-vs-svc', t:'card', q:'Я сразу оплачиваю сервис?', a:'<p>Нет. На сайте вы покупаете виртуальную карту в долларах, а ею уже оплачиваете подписку на сайте сервиса. Сначала карта — потом сервис.</p>', top:true },
    { id:'time', t:'card', q:'Сколько занимает выпуск карты?', a:'<p>До 15 минут после подтверждения платежа, обычно 2–5 минут. Если требуется дополнительная проверка — напишем на почту.</p>', top:true },
    { id:'reuse', t:'card', q:'Карта одноразовая?', a:'<p>Нет, многоразовая. Продления списываются с неё автоматически, пополнить можно тем же способом — номер карты не меняется.</p>' },
    { id:'topup', t:'card', q:'Как пополнить карту?', a:'<p>Кабинет → карта → пополнить: выбираете сумму и платите по QR. Баланс обновляется до 15 минут.</p>' },
    { id:'where', t:'mail', q:'Куда приходят реквизиты?', a:'<p>На почту, указанную при оформлении, и в личный кабинет. В письме — номер, срок, CVC, платёжный адрес и инструкция для вашего сервиса.</p>', top:true },
    { id:'nomail', t:'mail', q:'Письмо не пришло. Что делать?', a:'<p>Проверьте «Спам» и «Промоакции» — письмо от noreply@vexel.ru. Реквизиты также есть в кабинете. Если прошло больше 15 минут — <a href="#">напишите в поддержку</a>, найдём заказ по почте и отправим повторно.</p>', top:true },
    { id:'address', t:'mail', q:'Зачем в письме платёжный адрес?', a:'<p>Сервисы сверяют адрес с картой при привязке. Введите страну, индекс и город из письма — это самая частая причина отказа, если пропустить.</p>' },
    { id:'which', t:'svc', q:'Какие сервисы можно оплатить?', a:'<p>Любой сервис с оплатой в USD: нейросети, игры, развлечения, дизайн, рабочие инструменты. В каталоге — 139 сервисов с инструкцией по привязке для каждого.</p>' },
    { id:'notlisted', t:'svc', q:'Сервиса нет в каталоге', a:'<p>Карта всё равно подойдёт, если сервис не относится к запрещённым категориям по оферте. Сомневаетесь — спросите в поддержке до оплаты.</p>' },
    { id:'declined', t:'svc', q:'Сервис отклонил карту', a:'<p>Проверьте платёжный адрес из письма и баланс — некоторые сервисы делают пробное списание. Повторите через 2–3 минуты. Если отказ повторяется, пришлите название сервиса и текст ошибки.</p>' },
    { id:'limit', t:'money', q:'Есть ли лимит на покупки?', a:'<p>Без подтверждения личности можно тратить до <b>15 000 ₽ в месяц</b>. Месяц отсчитывается с первой покупки: ровно через месяц лимит обновится сам. Шкала с остатком и датой обновления — в личном кабинете.</p><p>После верификации (фото паспорта и селфи) лимит снимается, а на бонусный счёт приходит <b>500 ₽</b> — они спишутся скидкой при следующей оплате.</p>' },
    { id:'refund', t:'money', q:'Можно вернуть деньги?', a:'<p>Если карта не выпущена — вернём платёж целиком на тот же счёт. Если выпущена, но не использована — по оферте, минус комиссия выпуска. Зачисление до 5 рабочих дней.</p>' },
    { id:'limits', t:'money', q:'Есть ли лимиты?', a:'<p>Номинал карты — от $50 до $200 за один выпуск. Пополнять можно без ограничения по количеству раз.</p>' },
    { id:'docs', t:'money', q:'Нужны закрывающие документы', a:'<p>Для юрлиц и ИП — напишите на support@vexel.ru с реквизитами, подготовим счёт и акт.</p>' }
  ];

  var list = $('faqList'), topics = $('faqTopics'), search = $('faqSearch'), count = $('faqCount'), reset = $('faqReset');
  var topic = 'all', q = '';
  var TN = {}; TOPICS.forEach(function(t){ TN[t[0]] = t[1]; });

  TOPICS.forEach(function(t){
    var n = t[0] === 'all' ? FAQ.length : FAQ.filter(function(f){ return f.t === t[0]; }).length;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cat'; b.setAttribute('role','tab'); b.dataset.id = t[0];
    b.innerHTML = t[1] + '<span class="n">' + n + '</span>';
    b.addEventListener('click', function(){ topic = t[0]; render(true); });
    topics.appendChild(b);
  });
  /* первый экран: темы плитками */
  var ht = $('faqHeroTopics');
  if (ht) TOPICS.forEach(function(t){
    if (t[0] === 'all') return;
    var n = FAQ.filter(function(f){ return f.t === t[0]; }).length;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'hf-topic';
    b.innerHTML = '<b>' + n + '</b><span>' + t[1] + '</span>';
    b.addEventListener('click', function(){ topic = t[0]; render(true); $('faq').scrollIntoView({ behavior: MC.reduce ? 'auto' : 'smooth', block: 'start' }); });
    ht.appendChild(b);
  });

  function esc(s){ return s.replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function hl(html, needle){
    if (!needle) return html;
    var re = new RegExp('(' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return html.split(/(<[^>]+>)/g).map(function(part){ return part.charAt(0) === '<' ? part : part.replace(re, '<mark>$1</mark>'); }).join('');
  }
  function matches(f){
    if (topic !== 'all' && f.t !== topic) return false;
    if (!q) return true;
    return (f.q + ' ' + f.a.replace(/<[^>]+>/g, ' ')).toLowerCase().indexOf(q) >= 0;
  }
  function render(swap){
    topics.querySelectorAll('.cat').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.id === topic ? 'true' : 'false'); });
    var items = FAQ.filter(matches), open = q ? true : false;
    list.innerHTML = items.map(function(f, i){
      return '<details class="acc" id="q-' + f.id + '"' + ((open || (i === 0 && !q)) ? ' open' : '') + '><summary><span class="q"><span class="t">' + TN[f.t] + '</span>' + hl(esc(f.q), q) + '</span><span class="acc-ico" aria-hidden="true"></span></summary><div class="acc-body">' + hl(f.a, q) + '</div></details>';
    }).join('') || '<div class="faq-empty"><b>Ничего не нашли</b>Попробуйте другое слово или спросите нас напрямую.<br><a class="btn btn-primary btn-sm" href="#">Написать в Telegram</a></div>';
    count.textContent = items.length ? items.length + ' ' + MC.plural(items.length, ['вопрос','вопроса','вопросов']) + (topic !== 'all' ? ' · ' + TN[topic] : '') + (q ? ' · «' + q + '»' : '') : '';
    reset.hidden = topic === 'all' && !q;
    if (swap && !reduce) { list.classList.remove('swap'); void list.offsetWidth; list.classList.add('swap'); }
  }
  var deb; search.addEventListener('input', function(){ clearTimeout(deb); deb = setTimeout(function(){ q = search.value.trim().toLowerCase(); render(false); }, 120); });
  reset.addEventListener('click', function(){ topic = 'all'; q = ''; search.value = ''; render(true); search.focus(); });

  /* — популярные: открывают вопрос — */
  $('faqTop').innerHTML = FAQ.filter(function(f){ return f.top; }).map(function(f){ return '<li><a href="#q-' + f.id + '" data-q="' + f.id + '">' + f.q + '</a></li>'; }).join('');
  function openQ(id){
    var f = FAQ.filter(function(x){ return x.id === id; })[0]; if (!f) return;
    if (!matches(f)) { topic = 'all'; q = ''; search.value = ''; render(false); }
    var el = $('q-' + id); if (!el) return;
    el.open = true; el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  $('faqTop').addEventListener('click', function(e){ var a = e.target.closest('a[data-q]'); if (!a) return; e.preventDefault(); openQ(a.dataset.q); });
  render(false);
  if (location.hash.indexOf('#q-') === 0) openQ(location.hash.slice(3));
  MC.initReveal();
})();
