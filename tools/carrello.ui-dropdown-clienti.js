// =============================================================================
//  CLIENTI DROPDOWN — Menu raggruppato per giorno (stile Cestino)
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

  var entries = [];
  (carrelli || []).forEach(function(cart, ci){
    entries.push({ cart: cart, ci: ci });
  });

  if(!entries.length){
    list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Nessun carrello attivo.<br>Premi ＋ NUOVO per iniziare.</div>';
    return;
  }

  function _ctClientiActivityIso(cart){
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
  function _ctClientiDayKey(cart){
    var iso = _ctClientiActivityIso(cart);
    if(iso){
      var dIso = new Date(iso);
      if(!isNaN(dIso.getTime())) return dIso.toISOString().slice(0, 10);
    }
    return 'senza-data';
  }
  function _ctClientiDayLabel(key){
    if(key === 'senza-data') return 'Senza data';
    var today = new Date().toISOString().slice(0, 10);
    var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if(key === today) return 'Oggi';
    if(key === y) return 'Ieri';
    var p = key.split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : key;
  }
  function _ctClientiActivityMs(cart){
    var iso = _ctClientiActivityIso(cart);
    if(!iso) return 0;
    var t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
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
    var iso = cart && (cart.ultimaModificaISO || cart.creatoAtISO)
      ? (cart.ultimaModificaISO || cart.creatoAtISO)
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

  var groups = {};
  entries.forEach(function(entry){
    var key = _ctClientiDayKey(entry.cart);
    if(!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });
  var keys = Object.keys(groups).sort(function(a, b){
    if(a === 'senza-data') return 1;
    if(b === 'senza-data') return -1;
    return a < b ? 1 : (a > b ? -1 : 0);
  });
  keys.forEach(function(key){
    groups[key].sort(function(a, b){
      return _ctClientiActivityMs(b.cart) - _ctClientiActivityMs(a.cart);
    });
  });

  var h = '';
  keys.forEach(function(key){
    h += '<div class="cart-trash-day">';
    h += '<div class="cart-trash-day-title cassa-date-header">' + esc(_ctClientiDayLabel(key)) +
         ' <span class="badge-count">' + groups[key].length + '</span></div>';
    groups[key].forEach(function(item){
      h += _renderRow(item);
    });
    h += '</div>';
  });
  list.innerHTML = h;
}

function ctSelezionaCliente(ci){
  switchCart(ci);
  ctChiudiClienti();
}
