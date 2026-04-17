// ── RIEPILOGO ORDINE (checklist operativa) ────────────────────────────────────
var _riepilogoChecks = {}; // id_carrello + idx -> bool

function openRiepilogoOrdine(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !(cart.items||[]).length){ showToastGen('yellow','Carrello vuoto'); return; }

  var _vistoId = cart.bozzaOrdId || (cart.stato === 'modifica' ? cart.ordId : null);
  if(_vistoId && typeof ordineSegnaVistoSeUfficio === 'function') ordineSegnaVistoSeUfficio(_vistoId);

  // Inizializza checks se non esistono
  var key = cartId;
  if(!_riepilogoChecks[key]) _riepilogoChecks[key] = {};

  var ov = document.getElementById('riepilogo-overlay');
  if(!ov){ ov = document.createElement('div'); ov.id = 'riepilogo-overlay'; document.body.appendChild(ov); }
  ov.className = 'overlay open';

  var tot = (cart.items||[]).reduce(function(s,it){ return s + _prezzoEffettivo(it) * parseFloat(it.qty||0); }, 0);
  var totFin = cart.scontoGlobale ? tot * (1 - cart.scontoGlobale/100) : tot;
  var checks = _riepilogoChecks[key];
  var checked = Object.keys(checks).filter(function(k){ return checks[k]; }).length;
  var nItems = (cart.items||[]).length;
  var denseCls = nItems >= 14 ? ' riepilogo-modal--dense' : '';

  var h = '<div class="riepilogo-modal' + denseCls + '">';
  // Header fisso: cliente + totale sempre in evidenza
  h += '<div class="riepilogo-header">';
  h += '<div class="riepilogo-header-main">';
  h += '<div class="riepilogo-title">' + esc(cart.nome) + '</div>';
  h += '<div class="riepilogo-total-row"><span class="riepilogo-total-label">Totale ordine</span>';
  h += '<span class="riepilogo-total-val">€' + totFin.toFixed(2) + '</span></div>';
  h += '<div class="riepilogo-meta">' + nItems + ' articoli';
  if(cart.scontoGlobale) h += ' &nbsp;·&nbsp; <span class="riepilogo-meta-sconto">−' + cart.scontoGlobale + '%</span>';
  h += '</div></div>';
  h += '<div class="riepilogo-header-tools">';
  h += '<span class="riepilogo-counter" id="riepilogo-counter">' + checked + '/' + nItems + '</span>';
  h += '<button type="button" onclick="closeRiepilogo()" class="riepilogo-close" aria-label="Chiudi">✕</button>';
  h += '</div></div>';

  // Lista articoli (scroll)
  h += '<div class="riepilogo-list">';
  (cart.items||[]).forEach(function(it, idx){
    var isChecked = !!checks[idx];
    var codM7 = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
    var sub = (_prezzoEffettivo(it) * (parseFloat(it.qty)||0)).toFixed(2);
    h += '<label class="riepilogo-row' + (isChecked ? ' riepilogo-row-done' : '') + '" data-riepilogo-idx="' + idx + '" onclick="toggleRiepilogoCheck(\'' + cartId + '\',' + idx + ');return false;">';
    h += '<div class="riepilogo-check' + (isChecked ? ' riepilogo-check-on' : '') + '" role="presentation">';
    h += isChecked ? '✓' : '';
    h += '</div>';
    h += '<div class="riepilogo-item-info">';
    h += '<div class="riepilogo-item-name">' + esc(it.desc || '—') + '</div>';
    var meta = '';
    if(codM7) meta += '<span class="riepilogo-code-m">' + esc(codM7) + '</span>';
    if(codM7 && it.codF) meta += '<span class="riepilogo-code-sep"> · </span>';
    if(it.codF) meta += '<span class="riepilogo-code-f">' + esc(it.codF) + '</span>';
    if(meta) h += '<div class="riepilogo-item-code">' + meta + '</div>';
    if(it.nota) h += '<div class="riepilogo-item-nota">📝 ' + esc(it.nota) + '</div>';
    var pbRp = itemRigaNotaPrezzoBasePlain(it);
    if(pbRp) h += '<div class="riepilogo-item-nota" style="color:#a0a0a8;">' + esc(pbRp) + '</div>';
    h += '</div>';
    h += '<div class="riepilogo-item-right">';
    h += '<div class="riepilogo-item-qty">' + (parseFloat(it.qty)||0) + ' ' + (it.unit||'pz') + '</div>';
    h += '<div class="riepilogo-item-sub">€' + sub + '</div>';
    h += '</div>';
    h += '</label>';
  });
  h += '</div>'; // fine list

  // Footer fisso
  h += '<div class="riepilogo-footer">';
  h += '<button type="button" onclick="resetRiepilogoChecks(\'' + cartId + '\')" class="riepilogo-btn-reset">↺ Reset spunte</button>';
  h += '<button type="button" onclick="closeRiepilogo()" class="riepilogo-btn-close">Chiudi</button>';
  h += '</div>';
  h += '</div>'; // fine modal

  ov.innerHTML = h;
}

function toggleRiepilogoCheck(cartId, idx){
  if(!_riepilogoChecks[cartId]) _riepilogoChecks[cartId] = {};
  _riepilogoChecks[cartId][idx] = !_riepilogoChecks[cartId][idx];
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  var total = cart ? (cart.items||[]).length : 0;
  var checked = Object.keys(_riepilogoChecks[cartId]).filter(function(k){ return _riepilogoChecks[cartId][k]; }).length;
  var counter = document.getElementById('riepilogo-counter');
  if(counter) counter.textContent = checked + '/' + total;

  var list = document.querySelector('#riepilogo-overlay .riepilogo-list');
  var row = list ? list.querySelector('.riepilogo-row[data-riepilogo-idx="' + idx + '"]') : null;
  var isOn = !!_riepilogoChecks[cartId][idx];
  if(row){
    row.classList.toggle('riepilogo-row-done', isOn);
    var chk = row.querySelector('.riepilogo-check');
    if(chk){
      chk.classList.toggle('riepilogo-check-on', isOn);
      chk.textContent = isOn ? '✓' : '';
    }
  } else {
    openRiepilogoOrdine(cartId);
  }
}

function resetRiepilogoChecks(cartId){
  _riepilogoChecks[cartId] = {};
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  var total = cart ? (cart.items||[]).length : 0;
  var counter = document.getElementById('riepilogo-counter');
  if(counter) counter.textContent = '0/' + total;
  var list = document.querySelector('#riepilogo-overlay .riepilogo-list');
  if(list){
    var rows = list.querySelectorAll('.riepilogo-row[data-riepilogo-idx]');
    for(var i = 0; i < rows.length; i++){
      var row = rows[i];
      row.classList.remove('riepilogo-row-done');
      var chk = row.querySelector('.riepilogo-check');
      if(chk){
        chk.classList.remove('riepilogo-check-on');
        chk.textContent = '';
      }
    }
  } else {
    openRiepilogoOrdine(cartId);
  }
}

function closeRiepilogo(){
  var ov = document.getElementById('riepilogo-overlay');
  if(ov){ ov.className = 'overlay'; }
}
