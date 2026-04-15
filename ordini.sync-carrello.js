// ordini.sync-carrello.js - estratto da ordini.js

// ══ ORDINI ════════════════════════════════════════════════════════
function aggiornaOrdine(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.ordId)return;
  var ord=ordini.find(function(o){return o.id===cart.ordId;});
  if(!ord){
    // Ordine eliminato: scollega il carrello
    cart.stato='';
    cart.locked=false;
    delete cart.ordId;
    saveCarrelli(); renderCartTabs();
    showToastGen('orange','Ordine eliminato — carrello scollegato');
    return;
  }
  // ── Confronta vecchio vs nuovo per nota automatica ──
  var vecchiItems = ord.items || [];
  var nuoviItems  = cart.items || [];
  var ora = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  var diff = [];

  // Articoli modificati o rimossi (ignora righe congelate sul vecchio ordine)
  vecchiItems.forEach(function(old_it){
    if(ordItemCongelato(old_it)) return;
    var new_it = nuoviItems.find(function(x){ return x.desc === old_it.desc; });
    if(!new_it){
      diff.push('rimosso: ' + (old_it.desc||'?'));
    } else {
      var qOld = parseFloat(old_it.qty||0), qNew = parseFloat(new_it.qty||0);
      if(qOld !== qNew) diff.push((new_it.desc||'?') + ': ' + qOld + '→' + qNew + ' ' + (new_it.unit||'pz'));
    }
  });
  // Articoli aggiunti
  nuoviItems.forEach(function(new_it){
    var esiste = vecchiItems.find(function(x){ return x.desc === new_it.desc; });
    if(!esiste) diff.push('aggiunto: ' + (new_it.desc||'?') + ' ×' + (new_it.qty||1));
  });

  // Aggiorna ordine con i dati modificati del carrello (mantieni righe congelate in coda)
  var prevFr=(ord.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
  ord.items=JSON.parse(JSON.stringify(cart.items||[])).concat(prevFr);
  var notaBase = cart.nota || '';
  if(diff.length){
    diff.forEach(function(part){
      ordineAppendStorico(ord,'Aggiorna ordine (carrello): '+part);
    });
    var rigaDiff = '✏️ ' + ora + ' — ' + diff.join(' · ');
    // Salva diff separatamente per il popup modificato
    if(!ord.modificheDiff) ord.modificheDiff = [];
    ord.modificheDiff.unshift(rigaDiff);
    if(ord.modificheDiff.length > 5) ord.modificheDiff.length = 5; // max 5 storici
    // NON toccare ord.nota con la diff — la nota resta quella del cliente
    ord.nota = notaBase;
    ord.modificato=true;
    ord.modificatoAt=new Date().toLocaleString('it-IT');
    ord.modificatoAtISO=new Date().toISOString();
    // Salva chi ha modificato
    if(typeof _currentUser !== 'undefined' && _currentUser){
      if(!ord.commesso) ord.commesso = _currentUser.key;
      ord.modificatoDa = _currentUser.key;
    }
  } else {
    ord.nota = notaBase;
  }
  ord.totale=ordTotaleSenzaCongelati(ord).toFixed(2);
  ord.scontoGlobale=cart.scontoGlobale||null;
  saveOrdini();
  // Rimetti il carrello come inviato
  cart.stato='inviato';
  cart.locked=true;
  saveCarrelli();
  feedbackSend();
  renderCartTabs();
  showToastGen('purple','- Ordine #'+(ord.numero||'')+' aggiornato!');
}

function annullaModifica(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart)return;
  if(cart.ordId){
    if(typeof ordUnlock === 'function') ordUnlock(cart.ordId);
    var ord=ordini.find(function(o){return o.id===cart.ordId;});
    if(ord){
      cart.items=JSON.parse(JSON.stringify(ord.items));
      cart.nota=ord.nota||'';
      cart.stato='inviato';
      cart.locked=true;
    } else {
      // Ordine eliminato: scollega
      cart.stato='';
      cart.locked=false;
      delete cart.ordId;
      showToastGen('orange','Ordine eliminato — carrello scollegato');
    }
  } else {
    cart.stato='inviato';
    cart.locked=true;
  }
  saveCarrelli();
  renderCartTabs();
  showToastGen('green','- Modifiche annullate');
}
