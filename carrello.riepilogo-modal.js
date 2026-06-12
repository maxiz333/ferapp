// ── RIEPILOGO ORDINE (checklist operativa) ────────────────────────────────────
var _riepilogoInvioTimer = null;

function riepilogoCountActive(cart){
  if(!cart) return 0;
  return (cart.items || []).filter(function(it){
    return !(typeof ordItemCongelato === 'function' && ordItemCongelato(it));
  }).length;
}

function riepilogoItemsSig(cart){
  var active = [];
  (cart && cart.items || []).forEach(function(it, idx){
    if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return;
    active.push({
      _insertNum: it._insertNum != null ? it._insertNum : idx,
      desc: String(it.desc || ''),
      codM: String(it.codM || ''),
      qty: Number(parseFloat(it.qty || 0).toFixed(4)),
      unit: String(it.unit || '')
    });
  });
  active.sort(function(a, b){ return (a._insertNum || 0) - (b._insertNum || 0); });
  return JSON.stringify(active.map(function(x){
    return { desc: x.desc, codM: x.codM, qty: x.qty, unit: x.unit };
  }));
}

function riepilogoCartMaybeReset(cart){
  if(!cart) return;
  var sig = riepilogoItemsSig(cart);
  if(!cart._riepilogoItemsSig){
    cart._riepilogoItemsSig = sig;
    if(!cart.riepilogoChecks) cart.riepilogoChecks = {};
    return;
  }
  if(cart._riepilogoItemsSig === sig) return;
  cart._riepilogoItemsSig = sig;
  cart.riepilogoChecks = {};
  cart.riepilogoCompleto = false;
}

function riepilogoSyncCompleto(cart){
  if(!cart) return;
  riepilogoCartMaybeReset(cart);
  if(!cart.riepilogoChecks) cart.riepilogoChecks = {};
  var n = riepilogoCountActive(cart);
  if(n <= 1){
    cart.riepilogoCompleto = true;
    return;
  }
  var checks = cart.riepilogoChecks;
  var allOk = true;
  (cart.items || []).forEach(function(it, idx){
    if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return;
    if(!checks[idx]) allOk = false;
  });
  cart.riepilogoCompleto = allOk;
}

function riepilogoBloccaInvioSeIncompleto(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return false;
  riepilogoCartMaybeReset(cart);
  riepilogoSyncCompleto(cart);
  if(riepilogoCountActive(cart) <= 1) return false;
  if(cart.riepilogoCompleto) return false;
  showRiepilogoInvioPopup(cartId);
  return true;
}

function showRiepilogoInvioPopup(cartId){
  closeRiepilogoInvioPopup();
  var ov = document.getElementById('riepilogo-invio-popup');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'riepilogo-invio-popup';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div class="riepilogo-invio-inner">' +
    '<span>Completa il </span>' +
    '<button type="button" class="riepilogo-invio-link" onclick="closeRiepilogoInvioPopup();openRiepilogoOrdine(\'' + cartId + '\')">Riepilogo</button>' +
    '<span> prima di inviare</span>' +
    '<button type="button" class="riepilogo-invio-dismiss" onclick="closeRiepilogoInvioPopup()" aria-label="Chiudi">✕</button>' +
    '</div>';
  ov.className = 'riepilogo-invio-popup open';
  if(_riepilogoInvioTimer) clearTimeout(_riepilogoInvioTimer);
  _riepilogoInvioTimer = setTimeout(closeRiepilogoInvioPopup, 4500);
}

function closeRiepilogoInvioPopup(){
  if(_riepilogoInvioTimer){ clearTimeout(_riepilogoInvioTimer); _riepilogoInvioTimer = null; }
  var ov = document.getElementById('riepilogo-invio-popup');
  if(ov) ov.className = 'riepilogo-invio-popup';
}

function openRiepilogoOrdine(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !(cart.items||[]).length){ showToastGen('yellow','Carrello vuoto'); return; }

  riepilogoCartMaybeReset(cart);
  if(!cart.riepilogoChecks) cart.riepilogoChecks = {};

  var ov = document.getElementById('riepilogo-overlay');
  if(!ov){ ov = document.createElement('div'); ov.id = 'riepilogo-overlay'; document.body.appendChild(ov); }
  ov.className = 'overlay open';

  var tot = (cart.items||[]).reduce(function(s,it){ return s + _prezzoEffettivo(it) * parseFloat(it.qty||0); }, 0);
  var totFin = cart.scontoGlobale ? tot * (1 - cart.scontoGlobale/100) : tot;
  var checks = cart.riepilogoChecks;
  var nItems = riepilogoCountActive(cart);
  var checked = 0;
  (cart.items||[]).forEach(function(it, idx){
    if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return;
    if(checks[idx]) checked++;
  });
  var denseCls = nItems >= 14 ? ' riepilogo-modal--dense' : '';

  var h = '<div class="riepilogo-modal' + denseCls + '">';
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

  h += '<div class="riepilogo-list">';
  (cart.items||[]).forEach(function(it, idx){
    if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return;
    var isChecked = !!checks[idx];
    var codM7 = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
    var qRiep = parseFloat(it.qty) || 0;
    var uRiep = it.unit || 'pz';
    var puRiep = _prezzoEffettivo(it);
    var sub = (puRiep * qRiep).toFixed(2);
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
    h += '<div class="riepilogo-item-qty">' + qRiep + ' ' + uRiep + '</div>';
    h += '<div class="riepilogo-item-sub">€' + puRiep.toFixed(2) + ' × ' + qRiep + ' ' + uRiep + ' = €' + sub + '</div>';
    h += '</div>';
    h += '</label>';
  });
  h += '</div>';

  h += '<div class="riepilogo-footer">';
  h += '<button type="button" onclick="resetRiepilogoChecks(\'' + cartId + '\')" class="riepilogo-btn-reset">↺ Reset spunte</button>';
  h += '<button type="button" onclick="closeRiepilogo()" class="riepilogo-btn-close">Chiudi</button>';
  h += '</div>';
  h += '</div>';

  ov.innerHTML = h;
}

function toggleRiepilogoCheck(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  riepilogoCartMaybeReset(cart);
  if(!cart.riepilogoChecks) cart.riepilogoChecks = {};
  cart.riepilogoChecks[idx] = !cart.riepilogoChecks[idx];
  riepilogoSyncCompleto(cart);
  saveCarrelli();

  var total = riepilogoCountActive(cart);
  var checked = 0;
  (cart.items || []).forEach(function(it, i){
    if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return;
    if(cart.riepilogoChecks[i]) checked++;
  });
  var counter = document.getElementById('riepilogo-counter');
  if(counter) counter.textContent = checked + '/' + total;

  var list = document.querySelector('#riepilogo-overlay .riepilogo-list');
  var row = list ? list.querySelector('.riepilogo-row[data-riepilogo-idx="' + idx + '"]') : null;
  var isOn = !!cart.riepilogoChecks[idx];
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
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  cart.riepilogoChecks = {};
  cart.riepilogoCompleto = false;
  saveCarrelli();

  var total = riepilogoCountActive(cart);
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

function riepilogoCopyToOrdine(cart, ord){
  if(!cart || !ord) return;
  var n = riepilogoCountActive(cart);
  ord.riepilogoCompleto = n <= 1 ? true : !!cart.riepilogoCompleto;
  if(cart.riepilogoChecks && Object.keys(cart.riepilogoChecks).length){
    ord.riepilogoChecks = JSON.parse(JSON.stringify(cart.riepilogoChecks));
  }
}
