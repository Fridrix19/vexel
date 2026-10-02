(function(){
  var MC = window.MC, $ = MC.$, reduce = MC.reduce;
  var screens = ['scrLogin','scrReg','scrOtp','scrMfa','scrRecover','scrNewPass','scrDone'];
  var tabs = $('authTabs'), flow = null, target = '', history = [];

  /* — логин или почта — */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, ULOGIN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
  function digits(v){ return String(v || '').replace(/\D/g, ''); }
  function parseId(v){   // только почта (регистрация)
    v = String(v || '').trim().toLowerCase();
    if (!v) return { err: 'Укажите почту.' };
    return EMAIL.test(v) ? { kind: 'email', value: v, pretty: v } : { err: 'Проверьте почту — например, mail@gmail.com.' };
  }
  function parseLogin(v){  // логин или почта (вход, восстановление)
    v = String(v || '').trim().toLowerCase();
    if (!v) return { err: 'Укажите логин или почту.' };
    if (v.indexOf('@') >= 0) return parseId(v);
    return ULOGIN.test(v) ? { kind: 'login', value: v, pretty: v } : { err: 'Логин — латиница, цифры, точка, дефис или _, от 3 символов.' };
  }
  function maskId(id){ return id.kind === 'email' ? id.value.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2') : 'почту аккаунта ' + id.value; }

  /* — «сервер»: настоящий API, если он есть, иначе демо-правила прототипа — */
  var LIVE = false, pending = null;   // pending — что подтверждаем кодом: {purpose, id, password, agree, news}
  function wait(v){ return new Promise(function(res){ setTimeout(function(){ res(v); }, reduce ? 0 : 650); }); }
  function err(code, message, data){ var e = new Error(message); e.code = code; e.data = data || {}; return e; }
  var demo = {
    login: function(id, pass){ return wait().then(function(){ if (/^wrong/i.test(pass)) throw err('bad_credentials', 'Неверная почта или пароль. После 5 попыток вход блокируется на 15 минут.'); return { mfa: /mfa/i.test(id.value) }; }); },
    codeStart: function(purpose, id){ return wait().then(function(){ if (purpose === 'register' && /taken/i.test(id.value)) throw err('email_taken', 'Аккаунт уже зарегистрирован. Войдите или восстановите пароль.'); return {}; }); },
    codeVerify: function(p, code){ return wait().then(function(){ if (code === '000000') throw err('code_wrong', 'Код не подошёл. Осталось попыток: 2.'); return p.purpose === 'reset' ? { ticket: 'demo' } : {}; }); },
    resetComplete: function(){ return wait({}); },
    resetLink: function(){ return wait({ sent: true }); },
    resetCheck: function(){ return wait({ username: 'demo' }); },
    mfa: function(code){ return wait().then(function(){ if (code === '000000') throw err('code_wrong', 'Код не подошёл. Проверьте время на устройстве или запросите код на почту.'); return {}; }); }
  };
  var live = {
    login: function(id, pass){ return MC.api('POST', '/auth/login', { login: id.value, password: pass }); },
    codeStart: function(purpose, id, p){ return purpose === 'register' ? MC.api('POST', '/auth/register/start', { email: id.value, username: p.username }) : MC.api('POST', '/auth/login/code-start', { login: id.value }); },
    codeVerify: function(p, code){
      if (p.purpose === 'register') return MC.api('POST', '/auth/register/complete', { email: p.id.value, username: p.username, password: p.password, code: code, agree: p.agree, news: p.news });
      return MC.api('POST', '/auth/login/code', { login: p.id.value, code: code });
    },
    resetLink: function(id){ return MC.api('POST', '/auth/reset/start', { login: id.value }); },
    resetCheck: function(ticket){ return MC.api('POST', '/auth/reset/check', { ticket: ticket }); },
    resetComplete: function(ticket, pass){ return MC.api('POST', '/auth/reset/complete', { ticket: ticket, password: pass }); }
  };
  function srv(){ return LIVE ? live : demo; }
  // куда вернуть после входа: ?next=dashboard.html#checkout (только относительные адреса)
  var NEXT = (function(){ var m = location.search.match(/[?&]next=([^&]+)/); var v = m ? decodeURIComponent(m[1]) : ''; return /^[\w\-.\/]+(#[\w:\-]*)?$/.test(v) && v.indexOf('//') < 0 ? v : 'dashboard.html'; })();
  function goNext(){ location.href = (window.MC_BASE || '') + NEXT; }
  MC.isLive().then(function(on){
    LIVE = on;
    document.documentElement.classList.toggle('mc-live', on);
    $('otpDemo').hidden = on;
    if (on) MC.api('GET', '/auth/me').then(function(r){ if (r.user && NEXT !== 'dashboard.html') { goNext(); return; } if (r.user) toast('Вы уже вошли', String(r.user.username || r.user.email).replace(/[<>&"]/g, '') + ' · <a href="' + (window.MC_BASE || '') + 'dashboard.html">открыть кабинет</a>'); }).catch(function(){});
  });

  /* — экраны — */
  function show(id, push){
    var cur = screens.filter(function(s){ return !$(s).hidden; })[0];
    if (push !== false && cur && cur !== id) history.push(cur);
    screens.forEach(function(s){ $(s).hidden = s !== id; });
    var tabbed = id === 'scrLogin' || id === 'scrReg';
    tabs.hidden = !tabbed;
    $('tabLogin').setAttribute('aria-selected', id === 'scrLogin' ? 'true' : 'false');
    $('tabReg').setAttribute('aria-selected', id === 'scrReg' ? 'true' : 'false');
    var f = $(id).querySelector('input:not([type=checkbox]):not([disabled])'); if (f && !reduce) setTimeout(function(){ f.focus(); }, 60);
  }
  function back(){ var prev = history.pop() || 'scrLogin'; stopTimer(); show(prev, false); }
  $('tabLogin').addEventListener('click', function(){ show('scrLogin'); });
  $('tabReg').addEventListener('click', function(){ show('scrReg'); });
  document.querySelectorAll('[data-tab]').forEach(function(b){ b.addEventListener('click', function(){ show(b.dataset.tab === 'reg' ? 'scrReg' : 'scrLogin'); }); });
  document.querySelectorAll('[data-back]').forEach(function(b){ b.addEventListener('click', back); });
  $('toRecover').addEventListener('click', function(){ $('recId').value = $('loginId').value; show('scrRecover'); });

  /* — показать/скрыть пароль — */
  document.querySelectorAll('[data-eye]').forEach(function(b){
    b.addEventListener('click', function(){ var i = $(b.dataset.eye); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль'); b.style.color = show ? 'var(--accent)' : ''; i.focus(); });
  });

  /* — сила пароля — */
  function score(p){ var s = 0; if (p.length >= 8) s++; if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w\s]/.test(p) || p.length >= 14) s++; return p.length < 8 ? Math.min(s, 1) : s; }
  function meter(inputId, hintId){
    var i = $(inputId), m = i.closest('.field').querySelector('.pw-meter'), h = $(hintId);
    i.addEventListener('input', function(){
      var s = score(i.value); m.setAttribute('data-score', i.value ? s : 0);
      h.className = 'hint'; h.textContent = !i.value ? 'Буквы и цифры, от 8 символов.' : s <= 1 ? 'Слабый: добавьте цифры и заглавные.' : s === 2 ? 'Средний: ещё бы символ или длиннее.' : s === 3 ? 'Хороший пароль.' : 'Отличный пароль.';
    });
  }
  meter('regPass', 'regPassHint'); meter('newPass', 'newPassHint');

  /* — ошибки полей — */
  function fieldErr(inputId, hintId, msg){
    var i = $(inputId), h = $(hintId);
    if (msg) { i.setAttribute('aria-invalid', 'true'); h.className = 'hint err'; h.textContent = msg; i.focus(); }
    else { i.removeAttribute('aria-invalid'); h.className = 'hint'; }
    return !msg;
  }
  function alertBox(id, msg){ var a = $(id); a.hidden = !msg; if (msg) $(id + 'Text').textContent = msg; }
  function busy(btn, on, text){ btn.classList.toggle('is-loading', on); btn.disabled = on; if (text && !on) btn.textContent = text; }


  /* — вход по паролю — */
  $('scrLogin').addEventListener('submit', function(e){
    e.preventDefault(); alertBox('loginErr', '');
    var id = parseLogin($('loginId').value);
    if (!fieldErr('loginId', 'loginIdHint', id.err)) return;
    $('loginIdHint').textContent = 'Можно войти по любому из них.';
    if (!fieldErr('loginPass', 'loginPassHint', !$('loginPass').value ? 'Введите пароль.' : '')) return;
    var btn = $('loginBtn'); busy(btn, true);
    srv().login(id, $('loginPass').value).then(function(r){
      busy(btn, false, 'Войти');
      target = id.pretty; flow = 'login';
      if (r && r.mfa) { show('scrMfa'); resetOtp('mfaBoxes'); } else done('Вы вошли', 'Сессия создана. Переходим в кабинет…', r && r.user);
    }, function(e){ busy(btn, false, 'Войти'); alertBox('loginErr', e.message); });
  });

  /* — вход по коду — */
  $('loginOtp').addEventListener('click', function(){
    alertBox('loginErr', '');
    var id = parseLogin($('loginId').value);
    if (!fieldErr('loginId', 'loginIdHint', id.err)) return;
    flow = 'login-otp'; target = id.pretty; requestCode({ purpose: 'login', id: id }, 'Код для входа', $('loginOtp'), 'loginErr');
  });

  /* — регистрация — */
  $('scrReg').addEventListener('submit', function(e){
    e.preventDefault(); alertBox('regErr', '');
    var un = String($('regLogin').value || '').trim().toLowerCase();
    if (!fieldErr('regLogin', 'regLoginHint', !ULOGIN.test(un) ? 'Логин: 3–32 символа — латиница, цифры, точка, дефис или _; начинается с буквы или цифры.' : loginTaken === un ? 'Этот логин занят — выберите другой.' : '')) return;
    var id = parseId($('regId').value);
    if (!fieldErr('regId', 'regIdHint', id.err)) return;
    $('regIdHint').textContent = 'Сюда придёт код подтверждения и реквизиты карт.';
    if (!fieldErr('regPass', 'regPassHint', score($('regPass').value) < 2 ? 'Пароль слишком простой: от 8 символов, буквы и цифры.' : '')) return;
    var agree = $('agreeOffer'); agree.closest('.check').classList.toggle('is-invalid', !agree.checked);
    if (!agree.checked) { alertBox('regErr', 'Без согласия с офертой создать аккаунт нельзя.'); return; }
    flow = 'register'; target = id.pretty;
    requestCode({ purpose: 'register', id: id, username: un, password: $('regPass').value, agree: true, news: $('agreeNews').checked }, 'Подтвердите почту', e.submitter || $('scrReg').querySelector('[type=submit]'), 'regErr');
  });

  /* — восстановление — */
  $('scrRecover').addEventListener('submit', function(e){
    e.preventDefault();
    var id = parseLogin($('recId').value);
    if (!fieldErr('recId', 'recIdHint', id.err)) return;
    alertBox('recErr', ''); $('recSent').hidden = true;
    var btn = $('recBtn'); busy(btn, true);
    srv().resetLink(id).then(function(r){
      busy(btn, false, 'Отправить ещё раз');
      $('recSent').hidden = false;
      $('recSentText').innerHTML = 'Если такой аккаунт есть, мы отправили ссылку для нового пароля на ' + (r.to ? '<b>' + r.to.replace(/[<>&"]/g, '') + '</b>' : 'его почту') + '. Ссылка действует 30 минут. Письма нет — проверьте «Спам».' +
        (r.dev_link ? '<br><a href="' + r.dev_link.replace(/"/g, '') + '">Стенд без почты: открыть ссылку</a>' : '');
    }, function(e){ busy(btn, false, 'Отправить ссылку'); alertBox('recErr', e.message); });
  });

  /* — логин при регистрации: проверка, свободен ли — */
  var loginTaken = null, lt = null;
  $('regLogin').addEventListener('input', function(){
    var v = this.value.trim().toLowerCase(); clearTimeout(lt); $('regLoginHint').className = 'hint';
    if (!v) { $('regLoginHint').textContent = 'Латиница, цифры, точка, дефис или _, от 3 символов. По нему можно входить.'; return; }
    if (!ULOGIN.test(v)) { $('regLoginHint').textContent = 'Только латиница, цифры, точка, дефис или _, от 3 до 32 символов.'; return; }
    if (!LIVE) return;
    lt = setTimeout(function(){ MC.api('GET', '/auth/username-check?u=' + encodeURIComponent(v)).then(function(r){
      if ($('regLogin').value.trim().toLowerCase() !== v) return;
      loginTaken = r.available ? null : v;
      $('regLoginHint').className = r.available ? 'hint ok' : 'hint err';
      $('regLoginHint').textContent = r.available ? 'Логин свободен.' : (r.reason || 'Этот логин занят — выберите другой.');
    }).catch(function(){}); }, 350);
  });

  /* — ссылка из письма: login.html#reset:<токен> — */
  function openReset(){
    var m = location.hash.match(/^#reset:([\w-]{20,})$/); if (!m) return;
    resetTicket = m[1]; history.length = 0;
    window.history.replaceState(null, '', location.pathname + location.search);
    srv().resetCheck(resetTicket).then(function(r){
      $('newPassText').textContent = 'Аккаунт ' + (r.username || '') + '. Придумайте новый пароль — старый перестанет работать, все сессии завершатся.';
      flow = 'recover'; target = r.username || ''; show('scrNewPass', false);
    }, function(e){ show('scrRecover', false); alertBox('recErr', e.message); });
  }
  $('scrNewPass').addEventListener('submit', function(e){
    e.preventDefault();
    if (!fieldErr('newPass', 'newPassHint', score($('newPass').value) < 2 ? 'Пароль слишком простой: от 8 символов, буквы и цифры.' : '')) return;
    var btn = $('scrNewPass').querySelector('[type=submit]'), label = btn.textContent; busy(btn, true);
    srv().resetComplete(resetTicket, $('newPass').value).then(function(r){
      busy(btn, false, label); done('Пароль обновлён', 'Все прежние сессии завершены. Вы вошли на этом устройстве.', r && r.user);
    }, function(e){
      busy(btn, false, label);
      if (e.code === 'ticket_invalid') { show('scrRecover'); alertBox('recErr', e.message); return; }
      fieldErr('newPass', 'newPassHint', e.message);
    });
  });

  /* — OTP: 6 полей, автопереход, вставка, таймер повтора — */
  function boxes(gid){ return Array.prototype.slice.call($(gid).querySelectorAll('input')); }
  function wireOtp(gid, btnId, onFull){
    var bs = boxes(gid), btn = $(btnId);
    function code(){ return bs.map(function(b){ return b.value; }).join(''); }
    function sync(){ bs.forEach(function(b){ b.classList.toggle('is-filled', !!b.value); }); btn.disabled = code().length !== 6; $(gid).classList.remove('is-err'); }
    bs.forEach(function(b, i){
      b.addEventListener('input', function(){
        var v = digits(b.value);
        if (v.length > 1) { v.split('').slice(0, 6 - i).forEach(function(ch, k){ bs[i + k].value = ch; }); var n = Math.min(5, i + v.length); bs[n].focus(); }
        else { b.value = v; if (v && i < 5) bs[i + 1].focus(); }
        sync(); if (code().length === 6) onFull(code());
      });
      b.addEventListener('keydown', function(e){
        if (e.key === 'Backspace' && !b.value && i > 0) { bs[i - 1].value = ''; bs[i - 1].focus(); sync(); }
        if (e.key === 'ArrowLeft' && i > 0) bs[i - 1].focus(); if (e.key === 'ArrowRight' && i < 5) bs[i + 1].focus();
      });
      b.addEventListener('focus', function(){ b.select(); });
    });
    return { code: code, sync: sync };
  }
  function resetOtp(gid){ boxes(gid).forEach(function(b){ b.value = ''; b.classList.remove('is-filled'); }); $(gid).classList.remove('is-err', 'is-ok'); }
  var timer = null, left = 0;
  function startTimer(sec){
    left = sec || 59; $('otpResend').disabled = true; tick();
    clearInterval(timer); timer = setInterval(function(){ left--; tick(); if (left <= 0) { clearInterval(timer); $('otpResend').disabled = false; $('otpTimer').textContent = ''; } }, 1000);
  }
  function stopTimer(){ clearInterval(timer); }
  function tick(){ $('otpTimer').textContent = left > 0 ? 'через 0:' + ('0' + left).slice(-2) : ''; }
  var resetTicket = null;
  // просим код у сервера; при успехе — экран ввода
  function requestCode(p, title, btn, errBox){
    if (errBox && $(errBox)) alertBox(errBox, '');
    var label = btn ? btn.textContent : ''; if (btn) busy(btn, true);
    srv().codeStart(p.purpose, p.id, p).then(function(r){
      if (btn) busy(btn, false, label);
      pending = p; startOtp(p.id, title, r || {}); if (r && r.to) $('otpTarget').textContent = r.to;
    }, function(e){
      if (btn) busy(btn, false, label);
      if (e.code === 'email_taken') { $('loginId').value = p.id.value; show('scrLogin'); alertBox('loginErr', e.message); $('loginPass').focus(); return; }
      if (e.code === 'username_taken' || e.code === 'bad_username' || e.code === 'username_reserved') { loginTaken = e.code === 'username_taken' ? p.username : null; fieldErr('regLogin', 'regLoginHint', e.message); return; }
      if (e.code === 'email_domain') { fieldErr('regId', 'regIdHint', e.message); return; }
      if (e.code === 'not_registered') { $('regId').value = p.id.value; alertBox(errBox, e.message); return; }
      if (errBox && $(errBox)) alertBox(errBox, e.message); else toast('Не получилось', e.message);
    });
  }
  function startOtp(id, title, r){
    $('otpTitle').textContent = title; $('otpTarget').textContent = maskId(id);
    $('otpText').firstChild.textContent = 'Отправили письмо с 6 цифрами на ';
    alertBox('otpErr', ''); resetOtp('otpBoxes'); show('scrOtp'); startTimer(r.resend_after);
    if (!LIVE) toast('Письмо отправлено', 'Прототип: код не приходит, введите любые 6 цифр.');
    else if (r.dev_code) toast('Код на стенде: ' + r.dev_code, 'Почта ещё не подключена — код показан здесь.');
    else toast('Письмо отправлено', 'Если его нет — проверьте «Спам».');
  }
  var otp = wireOtp('otpBoxes', 'otpBtn', function(){ $('scrOtp').requestSubmit(); });
  $('scrOtp').addEventListener('submit', function(e){
    e.preventDefault(); var c = otp.code(); if (c.length !== 6) return;
    var btn = $('otpBtn'); if (btn.classList.contains('is-loading') || !pending) return; busy(btn, true);
    srv().codeVerify(pending, c).then(function(r){
      busy(btn, false, 'Подтвердить');
      $('otpBoxes').classList.add('is-ok'); stopTimer();
      if (pending.purpose === 'reset') { resetTicket = r.ticket; show('scrNewPass'); }
      else if (pending.purpose === 'register') done('Аккаунт создан', 'Почта подтверждена, вы вошли. Реквизиты карт и статусы заказов будут приходить сюда и в кабинет.', r.user);
      else done('Вы вошли', 'Сессия создана. Переходим в кабинет…', r.user);
    }, function(e){
      busy(btn, false, 'Подтвердить');
      $('otpBoxes').classList.add('is-err'); alertBox('otpErr', e.message);
      if (e.code === 'code_attempts' || e.code === 'code_expired' || e.code === 'code_missing') { stopTimer(); $('otpResend').disabled = false; $('otpTimer').textContent = ''; }
      if (e.code === 'email_taken') { $('loginId').value = pending.id.value; show('scrLogin'); alertBox('loginErr', e.message); return; }
      resetOtp('otpBoxes'); $('otpBoxes').classList.add('is-err'); boxes('otpBoxes')[0].focus();
    });
  });
  $('otpResend').addEventListener('click', function(){
    if (!pending) return; var b = $('otpResend'); b.disabled = true;
    srv().codeStart(pending.purpose, pending.id, pending).then(function(r){
      resetOtp('otpBoxes'); alertBox('otpErr', ''); startTimer(r && r.resend_after);
      toast(r && r.dev_code ? 'Новый код на стенде: ' + r.dev_code : 'Код отправлен повторно', 'Предыдущий код больше не действует.'); boxes('otpBoxes')[0].focus();
    }, function(e){
      if (e.data && e.data.retry_after) startTimer(e.data.retry_after); else b.disabled = false;
      alertBox('otpErr', e.message);
    });
  });

  /* — 2FA — */
  var mfa = wireOtp('mfaBoxes', 'mfaBtn', function(){ $('scrMfa').requestSubmit(); });
  $('scrMfa').addEventListener('submit', function(e){
    e.preventDefault(); var c = mfa.code(); if (c.length !== 6) return;
    var btn = $('mfaBtn'); busy(btn, true);
    demo.mfa(c).then(function(){
      busy(btn, false, 'Подтвердить'); $('mfaBoxes').classList.add('is-ok'); done('Вы вошли', 'Вход подтверждён вторым фактором. Устройство запомнено на 30 дней.');
    }, function(e){ busy(btn, false, 'Подтвердить'); $('mfaBoxes').classList.add('is-err'); alertBox('mfaErr', e.message); });
  });
  $('mfaSms').addEventListener('click', function(){ var id = parseLogin($('loginId').value); flow = 'login-otp'; requestCode({ purpose: 'login', id: id }, 'Код для входа', null, 'mfaErr'); });
  $('mfaBackup').addEventListener('click', function(){ toast('Резервный код', 'Прототип: введите любые 6 цифр в поля выше.'); boxes('mfaBoxes')[0].focus(); });

  /* — успех — */
  function done(title, text, user){
    $('doneTitle').textContent = title; $('doneText').textContent = text;
    var ua = navigator.userAgent, dev = /iPhone|Android/i.test(ua) ? 'Телефон' : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : 'Браузер';
    $('doneDevice').textContent = dev + ' · ' + (/Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'браузер');
    $('doneTime').textContent = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' · ' + target;
    $('mfaOffer').hidden = LIVE || flow !== 'register';
    // демо-сессия для прототипа; на сервере сессия — httpOnly-кука
    if (!LIVE) { try { localStorage.setItem('mc-session', JSON.stringify({ id: target, at: Date.now() })); } catch (e) {} }
    if (LIVE && (flow !== 'register' || NEXT !== 'dashboard.html')) setTimeout(goNext, reduce ? 300 : 1400);
    if (LIVE && user) document.querySelectorAll('.head-login').forEach(function(h){ h.href = (window.MC_BASE || '') + 'dashboard.html'; h.lastChild.textContent = user.name || user.username || user.email.split('@')[0]; h.classList.add('is-auth'); });
    stopTimer(); show('scrDone');
  }
  $('mfaOn').addEventListener('change', function(){ toast(this.checked ? '2FA будет включена' : '2FA выключена', this.checked ? 'В кабинете покажем QR для приложения-аутентификатора.' : 'Вход только по паролю или коду.'); });

  function toast(title, body){
    var st = $('toasts'); var t = document.createElement('div'); t.className = 'toast toast-info';
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><div><b>' + title + '</b>' + body + '</div><button type="button" class="x" aria-label="Закрыть">×</button>';
    t.querySelector('.x').addEventListener('click', function(){ t.remove(); }); st.appendChild(t); setTimeout(function(){ t.remove(); }, 4500);
  }

  if (location.hash === '#register') show('scrReg', false);
  MC.isLive().then(function(){ openReset(); });   // после определения режима (сервер или демо)
  window.addEventListener('hashchange', openReset);
  MC.initReveal();
})();
