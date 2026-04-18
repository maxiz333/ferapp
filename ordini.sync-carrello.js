// ordini.sync-carrello.js - estratto da ordini.js

// ══ ORDINI ════════════════════════════════════════════════════════
function aggiornaOrdine(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.ordId)return;
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);
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
  ord.fatturaRichiesta=!!cart.fatturaRichiesta;
  ord.fatturaCliente=cart.fatturaCliente?JSON.parse(JSON.stringify(cart.fatturaCliente)):null;
  ord.salvaFatturaInRubrica=!!cart.salvaFatturaInRubrica;
  if(ord.fatturaRichiesta && ord.salvaFatturaInRubrica && ord.fatturaCliente && typeof upsertClienteAnagrafica==='function'){
    upsertClienteAnagrafica(ord.fatturaCliente);
  }
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
      cart.fatturaRichiesta=!!ord.fatturaRichiesta;
      cart.fatturaCliente=ord.fatturaCliente?JSON.parse(JSON.stringify(ord.fatturaCliente)):null;
      cart.salvaFatturaInRubrica=!!ord.salvaFatturaInRubrica;
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

/** Reso merce dalla lista ordini: storno negativo + nota (stesso documento). */
function ordApplicaResoDaTab(gi, ii){
  var ord = ordini[gi];
  if(!ord) return;
  if(ord.stato === 'bozza'){
    if(typeof showToastGen === 'function') showToastGen('orange', 'Il reso si registra sugli ordini inviati, non sulle bozze');
    return;
  }
  var it = ord.items[ii];
  if(!it || ordItemCongelato(it) || ordItemStornoReso(it)) return;
  var nome = ordineItemNomePerReso(it);
  var pu = ordItemLineUnitSelling(it);
  var q = parseFloat(it.qty || 0);
  if(!isFinite(q) || q <= 0){
    if(typeof showToastGen === 'function') showToastGen('orange', 'Quantità non valida');
    return;
  }
  if(!isFinite(pu) || pu <= 0){
    if(typeof showToastGen === 'function') showToastGen('orange', 'Prezzo non valido');
    return;
  }
  var msg = 'Registrare reso (storno) per "' + nome + '" — qtà ' + q + ', importo stimato €' + (-Math.abs(pu) * q).toFixed(2) + '?';
  var run = function(){
    var ord2 = ordini[gi];
    if(!ord2) return;
    var src = ord2.items[ii];
    if(!src || ordItemCongelato(src) || ordItemStornoReso(src)) return;
    var nome2 = ordineItemNomePerReso(src);
    var pu2 = ordItemLineUnitSelling(src);
    var q2 = parseFloat(src.qty || 0);
    if(!isFinite(q2) || q2 <= 0 || !isFinite(pu2) || pu2 <= 0) return;
    var negStr = ordineFormatPrezzoUnitNegativoDaVendita(pu2);
    var um = (typeof normalizeUmValue === 'function') ? normalizeUmValue(src.unit || 'pz') : (src.unit || 'pz');
    var storno = {
      desc: 'STORNO RESO: ' + nome2,
      rowIdx: src.rowIdx,
      codF: src.codF || '',
      codM: src.codM || '',
      qty: q2,
      unit: um,
      prezzoUnit: negStr,
      nota: '',
      _stornoReso: true
    };
    ord2.items.splice(ii + 1, 0, storno);
    ordineAppendCommentoReso(ord2, nome2);
    ord2.totale = ordTotaleSenzaCongelati(ord2).toFixed(2);
    ord2.modificato = true;
    ord2.modificatoAt = new Date().toLocaleString('it-IT');
    ord2.modificatoAtISO = new Date().toISOString();
    var linked = typeof carrelli !== 'undefined' ? carrelli.find(function(c){ return c.ordId === ord2.id && c.stato === 'modifica'; }) : null;
    if(linked){
      linked.items = ordItemsSoloAttiviDeep(ord2.items);
      linked.nota = ord2.nota || '';
    }
    if(typeof saveOrdini === 'function') saveOrdini();
    if(typeof saveCarrelli === 'function') saveCarrelli();
    if(typeof renderOrdini === 'function') renderOrdini();
    if(typeof renderCartTabs === 'function') renderCartTabs();
    if(typeof showToastGen === 'function') showToastGen('green', 'Storno reso registrato');
  };
  if(typeof showConfirm === 'function') showConfirm(msg, run);
  else if(window.confirm(msg)) run();
}
