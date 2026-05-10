// =============================================================================
//  CLIENTI DROPDOWN — Menu raggruppato per giorno
// =============================================================================
var _gg = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Sabato'];

function ctApriClienti(){
  var dd = document.getElementById('ct-clienti-dropdown');
  if(!dd) return;
  ctRenderClientiList();
  dd.classList.add('open');
}

function ctChiudiClienti(){
  var dd = document.getElementById('ct-clienti-dropdown');
  if(dd) dd.classList.remove('open');
}

function ctRenderClientiList(){
  var list = document.getElementById('ct-clienti-list');
  if(!list) return;

  // Filtra solo carrelli di oggi
  var oggiStr = new Date().toISOString().slice(0,10);
  var carrelliOggi = [];
  carrelli.forEach(function(cart, ci){
    var cData = '';
    if(cart.creatoAtISO) cData = cart.creatoAtISO.slice(0,10);
    else if(cart.dataCreazione) cData = new Date(cart.dataCreazione).toISOString().slice(0,10);
    if(cData === oggiStr || cart.stato === 'inviato' || cart.stato === 'modifica'){
      carrelliOggi.push({cart:cart, ci:ci});
    }
  });

  if(!carrelliOggi.length){
    list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Nessun cliente oggi.<br>Premi ＋ NUOVO per iniziare.</div>';
    return;
  }

  // Helper locali — definiti qui per non sporcare lo scope globale
  function _ctcCalcTot(items){
    var tot = 0;
    try {
      (items||[]).forEach(function(it){
        var pu = (typeof _prezzoEffettivo === 'function')
          ? _prezzoEffettivo(it)
          : (typeof parsePriceIT === 'function' ? parsePriceIT(it && it.prezzoUnit) : parseFloat(it && it.prezzoUnit || 0));
        tot += (pu || 0) * parseFloat(it && it.qty || 0);
      });
    } catch(e){ tot = 0; }
    return tot;
  }
  function _ctcFmtEur(n){
    var v = Number(n || 0);
    try { return v.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2}); }
    catch(e){ return v.toFixed(2); }
  }
  function _ctcOraHHMM(cart){
    var iso = cart && cart.creatoAtISO
      ? cart.creatoAtISO
      : (cart && cart.dataCreazione ? new Date(cart.dataCreazione).toISOString() : '');
    if(!iso) return '';
    try {
      var d = new Date(iso);
      if(isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
    } catch(e){ return ''; }
  }
  function _ctcAnteprima(items){
    var arr = (items||[]).slice(0,3).map(function(it){
      return ((it && it.desc) || '').trim();
    }).filter(function(s){ return !!s; });
    if(!arr.length) return '';
    var s = arr.join(', ');
    if((items||[]).length > arr.length) s += '…';
    return s;
  }

  var h = '';
  carrelliOggi.forEach(function(item){
    var cart      = item.cart;
    var ci        = item.ci;
    var items     = cart.items || [];
    var n         = items.length;
    var isActive  = cart.id === activeCartId;
    var statoIcon = cart.stato === 'inviato' ? '✅ ' : cart.stato === 'modifica' ? '✏️ ' : '';
    var isFatt    = !!(cart.fatturaRichiesta || cart.tipo === 'fattura');
    var tot       = _ctcCalcTot(items);
    var totStr    = _ctcFmtEur(tot);
    var ora       = _ctcOraHHMM(cart);
    var ante      = _ctcAnteprima(items);

    h += '<button class="ct-clienti-btn ct-clienti-btn--rich' + (isActive ? ' active' : '') + '" ' +
         'onclick="ctSelezionaCliente(' + ci + ')">' +
         '<div class="ct-cli-row">' +
           '<div class="ct-cli-info">' +
             '<div class="ct-cli-name-line">' +
               '<span class="ct-cli-name" onclick="ctEditClienteName(\''+cart.id+'\')" style="cursor:pointer">' + statoIcon + esc(cart.nome || '—') + '</span>' +
               (isFatt ? '<span class="ct-cli-fatt" title="Documento fattura">FATT</span>' : '') +
             '</div>' +
             (ante ? '<div class="ct-cli-items">' + esc(ante) + '</div>' : '') +
           '</div>' +
           '<div class="ct-cli-right">' +
             '<div class="ct-cli-tot">€ ' + totStr + '</div>' +
             '<div class="ct-cli-meta">' +
               (ora ? '<span class="ct-cli-time">' + esc(ora) + '</span>' : '') +
               (n ? (ora ? '<span class="ct-cli-meta-sep">·</span>' : '') + '<span class="ct-cli-narts">' + n + ' art</span>' : '') +
             '</div>' +
           '</div>' +
         '</div>' +
         '</button>';
  });
  list.innerHTML = h;
}

function ctSelezionaCliente(ci){
  switchCart(ci);
  ctChiudiClienti();
}
