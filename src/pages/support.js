(function(){
  var MC = window.MC, $ = MC.$, reduce = MC.reduce;
  var C = MC.contacts, TG = 'https://t.me/' + C.telegram, MAX = 'https://max.ru/' + C.max, MAIL = C.email;
  document.addEventListener('mc:contacts', function(e){ C = e.detail; TG = 'https://t.me/' + C.telegram; MAX = 'https://max.ru/' + C.max; MAIL = C.email; links(); });
  var I = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4"/><path d="M14 14h3v3M20.5 14v6.5H17M14 20.5h1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>'
  };

  var ISSUES = [
    { id:'mail', ico:I.grid, t:'Письмо не пришло', s:'после оплаты прошло больше 15 минут',
      title:'Письмо идёт до 15 минут после подтверждения платежа',
      steps:['Проверьте папку <b>«Спам»</b> и «Промоакции» — письмо от noreply@vexel.ru.','Сверьте почту: реквизиты уходят на адрес, указанный при заказе.','Откройте <b>кабинет</b> — там те же реквизиты, что и в письме.'],
      note:'Если платёж списался, а письма нет и через 15 минут — напишите нам, найдём заказ по почте и отправим повторно.',
      msg:'Здравствуйте! Оплатил(а) карту, письмо с реквизитами не пришло. Почта из заказа: {mail}. Время оплаты: ' },
    { id:'decline', ico:I.card, t:'Сервис отклонил карту', s:'ошибка при привязке или оплате',
      title:'Чаще всего дело в платёжном адресе',
      steps:['Введите <b>адрес, индекс и страну</b> из письма — сервис сверяет их с картой.','Проверьте баланс в кабинете: должно хватать на списание с запасом.','Попробуйте ещё раз через 2–3 минуты — некоторые сервисы делают пробное списание.'],
      note:'Если отказ повторяется, пришлите название сервиса и текст ошибки — подскажем точный вариант для него.',
      msg:'Здравствуйте! Сервис {svc} отклоняет карту. Почта из заказа: {mail}. Текст ошибки: ' },
    { id:'sbp', ico:I.qr, t:'Не проходит оплата по СБП', s:'QR не открывается или платёж завис',
      title:'Проверьте QR и лимиты банка',
      steps:['Сканируйте QR камерой приложения банка, а не сторонней камерой.','Проверьте <b>лимит СБП</b> в банке — иногда он ниже суммы заказа.','Не оплачивайте повторно: если деньги списались, статус обновится в течение 5 минут.'],
      note:'Если списание прошло, а заказ не подтверждён — напишите нам, сверим по времени платежа.',
      msg:'Здравствуйте! Не проходит оплата по СБП. Почта: {mail}. Банк: , что происходит: ' },
    { id:'topup', ico:I.plus, t:'Пополнить карту', s:'нужна сумма для продления',
      title:'Пополнение — тем же способом, номер карты прежний',
      steps:['Откройте <b>кабинет → карта → пополнить</b> и выберите сумму.','Оплатите по QR через СБП — баланс обновится до 15 минут.','Продления сервиса спишутся автоматически, ничего перепривязывать не нужно.'],
      note:'Если нужен другой номинал, которого нет в списке, напишите — добавим вручную.',
      msg:'Здравствуйте! Хочу пополнить карту на $ . Почта из заказа: {mail}.' },
    { id:'refund', ico:I.back, t:'Вернуть деньги', s:'карта не нужна или не выпущена',
      title:'Возврат — на тот же счёт, с которого платили',
      steps:['Если карта <b>не выпущена</b> — вернём платёж целиком, ничего доказывать не нужно.','Если карта выпущена, но не использована — возврат по оферте, минус комиссия выпуска.','Срок зачисления — до 5 рабочих дней, зависит от банка.'],
      note:'Напишите с почты из заказа — это подтверждает, что запрос от владельца.',
      msg:'Здравствуйте! Прошу вернуть платёж. Почта из заказа: {mail}. Причина: ' },
    { id:'other', ico:I.chat, t:'Другой вопрос', s:'выбор сервиса, документы, юрлицо',
      title:'Напишите как есть — разберёмся',
      steps:['Укажите сервис и план, если вопрос про конкретную подписку.','Для документов и закрывающих для юрлиц — лучше на почту.','Про выбор сервиса можно спросить до оплаты — подскажем, подойдёт ли карта.'],
      note:'Telegram отвечает быстрее всего; почта — для документов и возвратов.',
      msg:'Здравствуйте! Вопрос: ' }
  ];

  var wrap = $('supIssues'), cur = null;
  ISSUES.forEach(function(it, i){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'sup-issue'; b.setAttribute('role','tab'); b.setAttribute('aria-selected','false'); b.dataset.id = it.id;
    b.innerHTML = '<span class="m-ico">' + it.ico + '</span><span><b>' + it.t + '</b><span class="s">' + it.s + '</span></span>';
    b.addEventListener('click', function(){ select(it, true); if (window.innerWidth <= 760) $('supAnswer').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'}); });
    wrap.appendChild(b);
  });
  /* первый экран: быстрый выбор ситуации */
  document.querySelectorAll('.ps-list [data-pick]').forEach(function(a){
    a.addEventListener('click', function(e){
      var b = wrap.querySelector('[data-id="' + a.dataset.pick + '"]'); if (!b) return;
      e.preventDefault(); b.click();
      $('helper').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  var mail = $('supMail'), text = $('supText');
  function fill(it){
    var m = mail.value.trim() || '[почта из заказа]';
    text.value = it.msg.replace('{mail}', m).replace('{svc}', '[название]');
  }
  function select(it, user){
    cur = it;
    wrap.querySelectorAll('.sup-issue').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.id === it.id ? 'true' : 'false'); });
    $('supTitle').textContent = it.title;
    $('supList').innerHTML = it.steps.map(function(s){ return '<li><span>' + s + '</span></li>'; }).join('');
    $('supNoteText').textContent = it.note;
    fill(it);
    var a = $('supAnswer'); if (user && !reduce) { a.classList.remove('bump'); void a.offsetWidth; a.classList.add('bump'); }
    links();
  }
  function links(){
    var body = encodeURIComponent(text.value);
    $('supTg').href = TG; $('supMax').href = MAX;
    $('supMailto').href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Поддержка: ' + (cur ? cur.t : 'вопрос')) + '&body=' + body;
  }
  mail.addEventListener('input', function(){ if (cur) { var before = text.value; fill(cur); if (before !== text.value) links(); } });
  text.addEventListener('input', links);

  var copy = $('supCopy');
  copy.addEventListener('click', function(){
    var done = function(){ copy.classList.add('is-done'); copy.querySelector('span').textContent = 'Скопировано'; toast('Текст скопирован', 'Вставьте его в чат поддержки.'); setTimeout(function(){ copy.classList.remove('is-done'); copy.querySelector('span').textContent = 'Скопировать'; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.value).then(done, function(){ text.select(); done(); });
    else { text.select(); try { document.execCommand('copy'); } catch (e) {} done(); }
  });
  function toast(title, body){
    var st = $('toasts'); var t = document.createElement('div'); t.className = 'toast toast-ok';
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg><div><b>' + title + '</b>' + body + '</div><button type="button" class="x" aria-label="Закрыть">×</button>';
    t.querySelector('.x').addEventListener('click', function(){ t.remove(); }); st.appendChild(t); setTimeout(function(){ t.remove(); }, 3500);
  }

  select(ISSUES[0], false);
  MC.initReveal();
})();
