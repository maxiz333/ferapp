// =============================================================================
//  CLIENTI DROPDOWN — Solo carrelli con attività di oggi
// =============================================================================
var CT_ULTIMO_GIORNO_K = 'cp4_carrelli_giorno_corrente';

function ctOggiDateKey(){
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function ctCartActivityIso(cart){
  if(!cart) return '';
  if(cart.ultimaModificaISO){
    var d = new Date(cart.ultimaModificaISO);
    if(!isNaN(d.getTime())) return cart.ultimaModificaISO;
  }
  if(cart.creatoAtISO){
    var d2 = new Date(cart.creatoAtISO);
    if(!isNaN(d2.getTime())) return cart.creatoAtISO;
  }
  if(cart.dataCreazione != null){
    var d3 = new Date(cart.dataCreazione);
    if(!isNaN(d3.getTime())) return d3.toISOString();
  }
  return '';
}

function ctCartActivityDayKey(cart){
  var iso = ctCartActivityIso(cart);
  if(!iso) return '';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function ctCartIsGiornaliero(cart){
  return ctCartActivityDayKey(cart) === ctOggiDateKey();
}

function ctCartActivityMs(cart){
  var iso = ctCartActivityIso(cart);
  if(!iso) return 0;
  var t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

/** Al cambio giorno: carrelli non di oggi (tranne inviato/modifica) → cestino. */
function ctRotazioneGiornoCarrelli(){
  var oggi = ctOggiDateKey();
  var ultimo = '';
  try{ ultimo = localStorage.getItem(CT_ULTIMO_GIORNO_K) || ''; }catch(e){}
  if(ultimo === oggi) return 0;
  try{ localStorage.setItem(CT_ULTIMO_GIORNO_K, oggi); }catch(e){}

  var toMove = [];
  (carrelli || []).forEach(function(c){
    if(c.stato === 'inviato' || c.stato === 'modifica') return;
    if(ctCartIsGiornaliero(c)) return;
    toMove.push(c.id);
  });

  if(!toMove.length) return 0;
  var n = 0;
  toMove.forEach(function(id){
    if(typeof deleteCart !== 'function') return;
    var cart = carrelli.find(function(c){ return c.id === id; });
    if(!cart) return;
    deleteCart(id, null);
    n++;
  });
  if(n > 0 && typeof showToastGen === 'function'){
    showToastGen('green', n + ' carrelli di ieri spostati nel cestino');
  }
  return n;
}

function ctApriClienti(){
  var dd = document.getElementById('ct-clienti-dropdown');
  if(!dd) return;
  ctRotazioneGiornoCarrelli();
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

  var entries = [];
  (carrelli || []).forEach(function(cart, ci){
    if(!ctCartIsGiornaliero(cart)) return;
    entries.push({ cart: cart, ci: ci });
  });

  entries.sort(function(a, b){
    return ctCartActivityMs(b.cart) - ctCartActivityMs(a.cart);
  });

  if(!entries.length){
    list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Nessun cliente oggi.<br>Premi ＋ NUOVO per iniziare.</div>';
    return;
  }

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
    var iso = ctCartActivityIso(cart);
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

  function _renderRow(item){
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

    return '<button class="ct-clienti-btn ct-clienti-btn--rich' + (isActive ? ' active' : '') + '" ' +
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
  }

  var h = '';
  h += '<div class="cart-trash-day">';
  h += '<div class="cart-trash-day-title cassa-date-header">Oggi <span class="badge-count">' + entries.length + '</span></div>';
  entries.forEach(function(item){
    h += _renderRow(item);
  });
  h += '</div>';
  list.innerHTML = h;
}

function ctSelezionaCliente(ci){
  switchCart(ci);
  ctChiudiClienti();
}

ctRotazioneGiornoCarrelli();
