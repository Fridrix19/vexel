(function(){
  var MC = window.MC, $ = MC.$, CAT = MC.CATALOG, reduce = MC.reduce;
  var HOME = /*__HOME__*/;
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* — разделы: общие плитки — */
  MC.dirTiles($('homeCats'), HOME);

  /* — популярное: строки «процессов» — */
  var pop = $('homePopular'), pid = 1040;
  HOME.popular.forEach(function(p){
    var s = CAT.services.find(function(x){ return x.n === p.n; }); if (!s) return;
    var a = document.createElement('a'); a.className = 'ps-row pop-card'; a.href = s.h; a.setAttribute('role', 'row');
    a.innerHTML = '<span class="ps-pid">' + (pid++) + '</span><span class="ps-name"><img' + (s.d ? ' class="on-dark"' : '') + ' alt="" src="' + s.l + '"><b>' + s.n + '</b></span><span class="ps-what">' + p.text + '</span><span class="ps-price" data-price-slug="' + MC.slugOf(s.h) + '">' + p.price + '</span><span class="ps-go">[run]</span>';
    pop.appendChild(a);
  });

  /* — карта: наклон за курсором — */
  var stage = $('cardStage'), tilt = $('cardTilt');
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    stage.addEventListener('pointermove', function(e){
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tilt.style.setProperty('--ty', (x * 26).toFixed(1)); tilt.style.setProperty('--tx', (-8 - y * 22).toFixed(1));
    });
    stage.addEventListener('pointerleave', function(){ tilt.style.removeProperty('--ty'); tilt.style.removeProperty('--tx'); });
  }
  MC.initReveal();
})();
