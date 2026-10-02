(function(){
  var MC = window.MC, $ = MC.$, CAT = MC.CATALOG;
  var META = /*__CATALOG_META__*/;
  var dirs = $('catDirs');

  /* — разделы: общие плитки — */
  MC.dirTiles(dirs, META);

  /* — первый экран: чипы разделов и поиск — */
  var chips = $('catChips');
  if (chips) CAT.categories.forEach(function(c){
    var a = document.createElement('a'); a.className = 'hc-chip'; a.href = 'section/' + c.id + '/index.html';
    a.innerHTML = '<span class="ix-n">' + c.name + '</span><i></i><span class="ix-c">' + c.count + '</span>';
    chips.appendChild(a);
  });
  var hs = $('catHeroSearch');
  if (hs) hs.addEventListener('submit', function(e){
    e.preventDefault();
    var inp = $('svcSearch'), q = $('catHeroQ').value.trim(); if (!inp) return;
    inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
    $('all').scrollIntoView({ behavior: MC.reduce ? 'auto' : 'smooth', block: 'start' });
  });

  MC.initShowcase({ page: 24 });
  // поиск с главной: catalog.html?q=…
  var qp = (location.search.match(/[?&]q=([^&]*)/) || [])[1];
  if (qp) { var inp = $('svcSearch'); if (inp) { inp.value = decodeURIComponent(qp.replace(/\+/g, ' ')); inp.dispatchEvent(new Event('input', { bubbles: true })); var all = $('all'); if (all) setTimeout(function(){ all.scrollIntoView({ block: 'start' }); }, 50); } }
  MC.initReveal();
})();
