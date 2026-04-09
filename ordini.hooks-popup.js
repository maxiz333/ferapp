// ordini.hooks-popup.js - estratto da ordini.js

// ── Override avvisaUfficio: forza render tab ordini subito ────────────────
(function(){
  var _origAvvisa = (typeof avvisaUfficio === 'function') ? avvisaUfficio : null;
  if(!_origAvvisa) return;
  avvisaUfficio = function(cartId){
    _origAvvisa(cartId);
    // Forza aggiornamento tab ordini se aperta, e badge sempre
    _updateBozzaBadge();
    var toTab = document.getElementById('to');
    if(toTab && toTab.classList.contains('active')){
      renderOrdini();
    }
  };
})();

// ── Override inviaOrdine: promuove la bozza a 'nuovo' invece di ricrearla ──
(function(){
  var _origInvia = (typeof inviaOrdine === 'function') ? inviaOrdine : null;
  if(!_origInvia) return;
  inviaOrdine = function(cartId){
    var cart = carrelli.find(function(c){ return c.id === cartId; });
    // Se c'è una bozza collegata, promuovila invece di ricreare l'ordine
    if(cart && cart.bozzaOrdId){
      var bozza = ordini.find(function(o){ return o.id === cart.bozzaOrdId; });
      if(bozza && bozza.stato === 'bozza'){
        // Aggiorna la bozza con i dati finali del carrello
        var prevFrozen=(bozza.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
        bozza.stato     = 'nuovo';
        bozza.numero    = getNextOrdNum();
        bozza.items     = JSON.parse(JSON.stringify(cart.items||[])).concat(prevFrozen);
        bozza.nota      = cart.nota || '';
        bozza.totale    = ordTotaleSenzaCongelati(bozza).toFixed(2);
        bozza.scontoGlobale = cart.scontoGlobale || null;
        bozza.commesso  = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.key : (cart.commesso || '');
        bozza.promozione= new Date().toLocaleString('it-IT');
        delete cart.bozzaOrdId;
        // Sposta in cima
        ordini = ordini.filter(function(o){ return o.id !== bozza.id; });
        ordini.unshift(bozza);
        saveOrdini();
        // Segna carrello come inviato
        cart.stato  = 'inviato';
        cart.locked = true;
        cart.ordId  = bozza.id;
        saveCarrelli();
        feedbackSend();
        renderCartTabs();
        showToastGen('green', '✅ Ordine #' + bozza.numero + ' confermato!');
        return; // non chiamare _origInvia
      }
    }
    // Nessuna bozza: comportamento originale
    _origInvia(cartId);
  };
})();

// ── Pulizia bozze orfane all'avvio ───────────────────────────────────────────
// Converte in 'nuovo' le bozze che non hanno più un carrello attivo collegato
// (es. create durante test, o carrello già inviato)
(function _pulisciBozzeOrfane(){
  var changed = false;
  ordini.forEach(function(o){
    if(o.stato !== 'bozza') return;
    // Cerca se esiste un carrello con questa bozza collegata
    var cartCollegato = carrelli.find(function(c){ return c.bozzaOrdId === o.id; });
    if(!cartCollegato){
      // Nessun carrello la "possiede" — promuovi a nuovo
      o.stato = 'nuovo';
      if(!o.numero) o.numero = getNextOrdNum();
      changed = true;
    }
  });
  if(changed){
    saveOrdini();
    setTimeout(function(){
      _updateBozzaBadge();
      renderOrdini && renderOrdini();
    }, 500);
  }
})();

// ── Popup modifiche ordine ────────────────────────────────────────────────────
function ordMostraModifiche(ordId){
  var ord = ordini.find(function(o){ return o.id === ordId; });
  if(!ord) return;
  // Rimuovi popup esistente se già aperto (toggle)
  var existing = document.getElementById('modpop_' + ordId);
  if(existing){ existing.remove(); return; }
  var diff = (ord.modificheDiff && ord.modificheDiff.length) ? ord.modificheDiff : null;
  var msg;
  if(ord.storicoOperazioni && ord.storicoOperazioni.length){
    msg = ord.storicoOperazioni.slice().reverse().map(function(r){
      return (r.label||'') + ' — ' + (r.msg||'');
    }).join('\n');
  } else if(diff){
    msg = diff.join('\n');
  } else {
    msg = 'Modificato il ' + (ord.modificatoAt || '—');
  }
  // Trova la card e inserisce il popup subito dopo la banda stato
  var cards = document.querySelectorAll('.ord-card');
  var target = null;
  cards.forEach(function(c){
    if(c.innerHTML.indexOf(ordId) >= 0) target = c;
  });
  var pop = document.createElement('div');
  pop.id = 'modpop_' + ordId;
  pop.style.cssText = 'background:#1e1040;border:1px solid #6b46c1;border-radius:10px;padding:10px 14px;margin:0 12px 8px;font-size:12px;color:#d6bcfa;white-space:pre-wrap;word-break:break-word;line-height:1.6;';
  pop.innerHTML = '✏️ <b style="color:#e9d8fd;">Modifiche:</b>\n' + esc(msg) +
    '<div style="text-align:right;margin-top:6px;"><button onclick="document.getElementById(\'modpop_'+ordId+'\').remove()" style="background:transparent;border:none;color:#6b46c1;font-size:11px;cursor:pointer;">✕ chiudi</button></div>';
  // Inserisci dopo la banda stato dentro la card
  if(target){
    var stato = target.querySelector('.ord-card-stato');
    if(stato && stato.nextSibling) target.insertBefore(pop, stato.nextSibling);
    else if(stato) stato.after(pop);
    else target.prepend(pop);
  }
}
