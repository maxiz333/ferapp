// ── RIEPILOGO ORDINE (checklist operativa) ────────────────────────────────────
var _riepilogoChecks = {}; // id_carrello + idx -> bool

function openRiepilogoOrdine(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !(cart.items||[]).length){ showToastGen('yellow','Carrello vuoto'); return; }

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

  var h = '<div class="riepilogo-modal">';
  // Header
  h += '<div class="riepilogo-header">';
  h += '<div>';
  h += '<div class="riepilogo-title">📋 ' + esc(cart.nome) + '</div>';
  h += '<div class="riepilogo-meta">' + (cart.items||[]).length + ' articoli &nbsp;·&nbsp; <span style="color:var(--accent);font-weight:800;">€' + totFin.toFixed(2) + '</span>';
  if(cart.scontoGlobale) h += ' <span style="font-size:10px;color:var(--pos-muted);">(-' + cart.scontoGlobale + '%)</span>';
  h += '</div></div>';
  h += '<div style="display:flex;gap:6px;align-items:center;">';
  h += '<span class="riepilogo-counter" id="riepilogo-counter">' + checked + '/' + (cart.items||[]).length + '</span>';
  h += '<button onclick="closeRiepilogo()" class="riepilogo-close">✕</button>';
  h += '</div></div>';

  // Lista articoli
  h += '<div class="riepilogo-list">';
  (cart.items||[]).forEach(function(it, idx){
    var isChecked = !!checks[idx];
    var codM7 = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
    var sub = (_prezzoEffettivo(it) * (parseFloat(it.qty)||0)).toFixed(2);
    h += '<label class="riepilogo-row' + (isChecked ? ' riepilogo-row-done' : '') + '" onclick="toggleRiepilogoCheck(\'' + cartId + '\',' + idx + ')">';
    h += '<div class="riepilogo-check' + (isChecked ? ' riepilogo-check-on' : '') + '">';
    h += isChecked ? '✓' : '';
    h += '</div>';
    h += '<div class="riepilogo-item-info">';
    h += '<div class="riepilogo-item-name">' + esc(it.desc || '—') + '</div>';
    var meta = '';
    if(codM7) meta += '<span style="color:var(--accent);">' + esc(codM7) + '</span>';
    if(codM7 && it.codF) meta += ' · ';
    if(it.codF) meta += '<span style="color:#fc8181;">' + esc(it.codF) + '</span>';
    if(meta) h += '<div class="riepilogo-item-code">' + meta + '</div>';
    if(it.nota) h += '<div class="riepilogo-item-nota">📝 ' + esc(it.nota) + '</div>';
    h += '</div>';
    h += '<div class="riepilogo-item-right">';
    h += '<div class="riepilogo-item-qty">' + (parseFloat(it.qty)||0) + ' ' + (it.unit||'pz') + '</div>';
    h += '<div class="riepilogo-item-sub">€' + sub + '</div>';
    h += '</div>';
    h += '</label>';
  });
  h += '</div>'; // fine list

  // Footer modal
  h += '<div class="riepilogo-footer">';
  h += '<button onclick="resetRiepilogoChecks(\'' + cartId + '\')" class="riepilogo-btn-reset">↺ Reset</button>';
  h += '<button onclick="closeRiepilogo()" class="riepilogo-btn-close">Chiudi</button>';
  h += '</div>';
  h += '</div>'; // fine modal

  ov.innerHTML = h;
}

function toggleRiepilogoCheck(cartId, idx){
  if(!_riepilogoChecks[cartId]) _riepilogoChecks[cartId] = {};
  _riepilogoChecks[cartId][idx] = !_riepilogoChecks[cartId][idx];
  // Aggiorna visivamente senza re-render completo
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  var total = cart ? (cart.items||[]).length : 0;
  var checked = Object.keys(_riepilogoChecks[cartId]).filter(function(k){ return _riepilogoChecks[cartId][k]; }).length;
  var counter = document.getElementById('riepilogo-counter');
  if(counter) counter.textContent = checked + '/' + total;
  // Toggle classi sulla riga
  openRiepilogoOrdine(cartId);
}

function resetRiepilogoChecks(cartId){
  _riepilogoChecks[cartId] = {};
  openRiepilogoOrdine(cartId);
}

function closeRiepilogo(){
  var ov = document.getElementById('riepilogo-overlay');
  if(ov){ ov.className = 'overlay'; }
}
