// --- RIPETI ORDINE DALLO STORICO -------------------------------
function ripetiOrdine(ordIdx,cartId){
  var ord=ordini[ordIdx];
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!ord||!cart)return;
  (ord.items||[]).forEach(function(it){
    var copy=JSON.parse(JSON.stringify(it));
    delete copy._checked;delete copy._scaglioniAperti;
    delete copy._insertNum;
    copy._insertNum = cartAllocInsertNum(cart);
    (cart.items=cart.items||[]).push(copy);
  });
  saveCarrelli();renderCartTabs();
  feedbackAdd();
  showToastGen('green','- '+(ord.items||[]).length+' articoli aggiunti dallo storico');
}

// --- INVIA ORDINE -------------------------------------------
// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB "ORDINARE" — pannello scorrevole dal basso con articoli da ordinare
// Si apre con doppio tap sull'icona carrello nel menu in basso (DOM = Document Object Model).
// Raggruppa gli articoli contrassegnati "daOrdinare" per fornitore (codF).
// ══════════════════════════════════════════════════════════════════════════════

// Variabile per gestire il doppio tap sull'icona del carrello nella bottom bar
var _cartDoubleTapTimer = null;

// Intercetta tap sull'icona carrello: singolo tap = vai alla tab, doppio tap = apri sub-tab ordinare
function handleCartTap(){
  if(_cartDoubleTapTimer){
    // Secondo tap rilevato entro 350ms: apre la Sub-Tab Ordinare
    clearTimeout(_cartDoubleTapTimer);
    _cartDoubleTapTimer = null;
    apriSubTabOrdinare();
  } else {
    // Primo tap: aspetta 350ms per vedere se arriva il secondo
    _cartDoubleTapTimer = setTimeout(function(){
      _cartDoubleTapTimer = null;
      goTab('tc'); // tap singolo: vai normalmente al carrello (tab tc)
    }, 350);
  }
}

// Reindirizza alla sub-tab unificata #t-ordfor (Opzione A — pannello legacy disattivato).
function apriSubTabOrdinare(){
  var panel = document.getElementById('ord-forn-panel');
  if(panel){
    panel.classList.remove('ord-forn-panel--open');
    panel.innerHTML = '';
  }
  if(typeof goTab === 'function') goTab('t-ordfor');
  if(typeof renderOrdFor === 'function') renderOrdFor();
}

// Chiude la Sub-Tab Ordinare rimuovendo la classe "open"
function chiudiSubTabOrdinare(){
  var panel = document.getElementById('ord-forn-panel');
  if(panel) panel.classList.remove('ord-forn-panel--open');
}

// Conferma e invia l'ordine a tutti i fornitori con articoli "daOrdinare"
// Per ora mostra un riepilogo testuale e notifica — espandibile con invio email/WhatsApp
function confermaOrdineAFornitori(){
  var daOrd = [];
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      if(it.daOrdinare) daOrd.push(it);
    });
  });
  if(!daOrd.length){ showToastGen('yellow','Nessun articolo da ordinare'); return; }
  showToastGen('green','✅ Ordine confermato a ' + daOrd.length + ' articoli');
  chiudiSubTabOrdinare();
}

// ── AVVISA UFFICIO — crea bozza ordine visibile in tab ordini ──────
function avvisaUfficio(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||(!(cart.items||[]).length)){showToastGen('red','Aggiungi almeno un articolo prima');return;}
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);

  // Totale provvisorio (stesso calcolo usato da inviaOrdine) per il toast
  var _totBozza = 0;
  try{
    _totBozza = (cart.items||[]).reduce(function(s,it){
      return s + ((typeof _prezzoEffettivo==='function'?_prezzoEffettivo(it):parsePriceIT(it&&it.prezzoUnit)) * parseFloat(it&&it.qty||0));
    }, 0);
  }catch(e){ _totBozza = 0; }
  var _nomeBozza = cart.nome || '—';

  if(cart.bozzaOrdId){
    // Bozza già attiva: aggiorna
    _aggiornaBozzaOrdine(cart);
    if(typeof feedbackSend==='function') feedbackSend();
    showToastGen('blue','📢 Bozza aggiornata! — '+_nomeBozza+' — €'+_totBozza.toFixed(2));
    return;
  }

  var bozzaId='bozza_'+Date.now();
  var bozza={
    id:bozzaId,
    numero:null,
    nomeCliente:cart.nome||'—',
    ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    data:new Date().toLocaleDateString('it-IT'),
    dataISO:new Date().toISOString().slice(0,10),
    createdAt:new Date().toISOString(),
    items:JSON.parse(JSON.stringify(cart.items||[])),
    nota:cart.nota||'',
    totale:'0',
    stato:'bozza',
    commesso:cart.commesso||'',
    visto:false,
    // Propaga subito lo stato fattura: il badge "FATTURA" deve essere visibile
    // anche prima del salvataggio definitivo dell'ordine.
    fatturaRichiesta:!!cart.fatturaRichiesta,
    fatturaCliente:cart.fatturaCliente?JSON.parse(JSON.stringify(cart.fatturaCliente)):null,
    salvaFatturaInRubrica:!!cart.salvaFatturaInRubrica,
    tipo:cart.tipo||(cart.fatturaRichiesta?'fattura':''),
    numeroFattura:cart.numeroFattura||''
  };
  ordini.unshift(bozza);
  if(typeof window.ordNotificaMarkBozzaKnown === 'function') window.ordNotificaMarkBozzaKnown(bozza);
  saveOrdini();
  cart.bozzaOrdId=bozzaId;
  saveCarrelli();
  renderCartTabs();
  if(typeof feedbackSend==='function') feedbackSend();
  showToastGen('blue','📢 Bozza inviata! — '+_nomeBozza+' — €'+_totBozza.toFixed(2));
}

function _ordItemMatchKey(it){
  var codM = String(it && it.codM || '').trim();
  if(codM) return 'M:' + codM;
  return 'D:' + String(it && it.desc || '').trim().toLowerCase();
}

function _ordHasPricedLine(it){
  if(!it) return false;
  if(typeof ordItemCongelato === 'function' && ordItemCongelato(it)) return false;
  var p = (typeof parsePriceIT === 'function') ? parsePriceIT(it.prezzoUnit) : parseFloat(it.prezzoUnit || 0);
  return isFinite(p) && p > 0;
}

/** Non far regredire prezzi già messi in ufficio sull'ordine quando il carrello è stale */
function _ordMergeCartItemsPreserveOfficePrices(cartItems, ordActiveItems){
  var byKey = {};
  (ordActiveItems || []).forEach(function(it){
    byKey[_ordItemMatchKey(it)] = it;
  });
  return (cartItems || []).map(function(cit){
    var out = JSON.parse(JSON.stringify(cit));
    var ordIt = byKey[_ordItemMatchKey(out)];
    if(!ordIt) return out;
    var ordPrice = (typeof parsePriceIT === 'function') ? parsePriceIT(ordIt.prezzoUnit) : parseFloat(ordIt.prezzoUnit || 0);
    var cartPrice = (typeof parsePriceIT === 'function') ? parsePriceIT(out.prezzoUnit) : parseFloat(out.prezzoUnit || 0);
    if(ordPrice > 0 && !(cartPrice > 0)){
      out.prezzoUnit = ordIt.prezzoUnit;
      if(ordIt.scaglioni) out.scaglioni = JSON.parse(JSON.stringify(ordIt.scaglioni));
      if(ordIt._prezzoUnitaBase) out._prezzoUnitaBase = ordIt._prezzoUnitaBase;
    }
    return out;
  });
}

// Aggiorna la bozza con gli articoli correnti del carrello (i congelati restano in coda)
function _aggiornaBozzaOrdine(cart){
  if(!cart||!cart.bozzaOrdId)return;
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);
  var bozza=ordini.find(function(o){return o.id===cart.bozzaOrdId;});
  if(!bozza||bozza.stato!=='bozza')return;
  function _canonItems(arr){
    return JSON.stringify((arr||[]).map(function(it){
      return {
        desc:String(it&&it.desc||''),
        codM:String(it&&it.codM||''),
        codF:String(it&&it.codF||''),
        qty:Number(parseFloat(it&&it.qty||0).toFixed(4)),
        unit:String(it&&it.unit||''),
        prezzoUnit:String(it&&it.prezzoUnit||''),
        nota:String(it&&it.nota||''),
        scampolo:!!(it&&it.scampolo),
        fineRotolo:!!(it&&it.fineRotolo),
        sconto:Number(parseFloat(it&&it._scontoApplicato||0).toFixed(4)),
        h_superficie:String(it&&it.h_superficie!=null?it.h_superficie:''),
        l_superficie:String(it&&it.l_superficie!=null?it.l_superficie:''),
        daOrdinare:!!(it&&it.daOrdinare),
        _ordColore:String(it&&it._ordColore||''),
        _ordFornitoreNome:String(it&&it._ordFornitoreNome||''),
        _stornoReso:!!(it&&it._stornoReso)
      };
    }));
  }
  var prevFrozen=(bozza.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
  var bozzaActive=(bozza.items||[]).filter(function(it){
    return !(typeof ordItemCongelato === 'function' && ordItemCongelato(it));
  });
  var mergedCartBozza=_ordMergeCartItemsPreserveOfficePrices(cart.items||[], bozzaActive);
  var nextItems=JSON.parse(JSON.stringify(mergedCartBozza)).concat(prevFrozen);
  var nextNome=cart.nome||'—';
  var nextNota=cart.nota||'';
  var prevItemsCanon=_canonItems(bozza.items||[]);
  var nextItemsCanon=_canonItems(nextItems);
  var prevNome=String(bozza.nomeCliente||'—');
  var prevNota=String(bozza.nota||'');
  // Anche un semplice flip del flag fattura (senza cambi articoli) deve
  // forzare il refresh: badge & numeroFattura devono apparire subito in tab Ordini.
  var prevFatt = !!bozza.fatturaRichiesta + '|' + (bozza.tipo||'') + '|' + (bozza.numeroFattura||'') + '|' + JSON.stringify(bozza.fatturaCliente||null);
  var nextFatt = !!cart.fatturaRichiesta  + '|' + (cart.tipo||'')  + '|' + (cart.numeroFattura||'')  + '|' + JSON.stringify(cart.fatturaCliente||null);
  if(prevItemsCanon===nextItemsCanon && prevNome===String(nextNome) && prevNota===String(nextNota) && prevFatt===nextFatt){
    return;
  }
  bozza.items=nextItems;
  bozza.nomeCliente=nextNome;
  bozza.nota=nextNota;
  bozza.fatturaRichiesta=!!cart.fatturaRichiesta;
  bozza.fatturaCliente=cart.fatturaCliente?JSON.parse(JSON.stringify(cart.fatturaCliente)):null;
  bozza.salvaFatturaInRubrica=!!cart.salvaFatturaInRubrica;
  bozza.tipo=cart.tipo||(cart.fatturaRichiesta?'fattura':'');
  bozza.numeroFattura=cart.numeroFattura||'';
  bozza.totale=ordTotaleSenzaCongelati(bozza).toFixed(2);
  bozza.modificato=true;
  bozza.modificatoAt=new Date().toLocaleString('it-IT');
  bozza.modificatoAtISO=new Date().toISOString();
  // Come ordine già inviato: il sync carrello→bozza non azzera "visto" (l'ufficio resta "visto" finché non serve altro flusso)
  saveOrdini();
}

/** Sync tab Ordini mentre il carrello è in modifica (stesso schema bozza + righe congelate). Mantiene cart.ordId ↔ ord.id. */
function _aggiornaOrdineDaCarrelloModifica(cart){
  if(!cart||!cart.ordId||cart.stato!=='modifica') return;
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);
  var ord=ordini.find(function(o){ return o.id===cart.ordId; });
  if(!ord) return;
  if(ord.stato === 'completato' && !ord.unlocked) return;

  var ordActive = (ord.items || []).filter(function(it){
    return !(typeof ordItemCongelato === 'function' && ordItemCongelato(it));
  });
  var cartActive = (cart.items || []).filter(function(it){
    return !(typeof ordItemStornoReso === 'function' && ordItemStornoReso(it));
  });
  var ordPriced = ordActive.filter(_ordHasPricedLine).length;
  var cartPriced = cartActive.filter(_ordHasPricedLine).length;
  if(ordPriced > 0 && cartPriced < ordPriced){
    console.warn('[CART→ORD] carrello senza prezzi vs ordine prezzato — merge conservativo');
  }
  function _canonItems(arr){
    return JSON.stringify((arr||[]).map(function(it){
      return {
        desc:String(it&&it.desc||''),
        codM:String(it&&it.codM||''),
        codF:String(it&&it.codF||''),
        qty:Number(parseFloat(it&&it.qty||0).toFixed(4)),
        unit:String(it&&it.unit||''),
        prezzoUnit:String(it&&it.prezzoUnit||''),
        nota:String(it&&it.nota||''),
        scampolo:!!(it&&it.scampolo),
        fineRotolo:!!(it&&it.fineRotolo),
        sconto:Number(parseFloat(it&&it._scontoApplicato||0).toFixed(4)),
        h_superficie:String(it&&it.h_superficie!=null?it.h_superficie:''),
        l_superficie:String(it&&it.l_superficie!=null?it.l_superficie:''),
        daOrdinare:!!(it&&it.daOrdinare),
        _ordColore:String(it&&it._ordColore||''),
        _ordFornitoreNome:String(it&&it._ordFornitoreNome||''),
        _stornoReso:!!(it&&it._stornoReso)
      };
    }));
  }
  var prevFrozen=(ord.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
  var mergedCart = _ordMergeCartItemsPreserveOfficePrices(cart.items || [], ordActive);
  var nextItems=JSON.parse(JSON.stringify(mergedCart)).concat(prevFrozen);
  var nextNome=cart.nome||ord.nomeCliente||'—';
  var nextNota=cart.nota||'';
  var prevItemsCanon=_canonItems(ord.items||[]);
  var nextItemsCanon=_canonItems(nextItems);
  // Tracking stato fattura per forzare resync anche se gli articoli non cambiano.
  var prevFatt = !!ord.fatturaRichiesta + '|' + (ord.tipo||'') + '|' + (ord.numeroFattura||'') + '|' + JSON.stringify(ord.fatturaCliente||null);
  var nextFatt = !!cart.fatturaRichiesta + '|' + (cart.tipo||'') + '|' + (cart.numeroFattura||'') + '|' + JSON.stringify(cart.fatturaCliente||null);
  if(prevItemsCanon===nextItemsCanon &&
    String(ord.nomeCliente||'—')===String(nextNome) &&
    String(ord.nota||'')===String(nextNota) &&
    String(ord.scontoGlobale||'')===String(cart.scontoGlobale||'') &&
    prevFatt===nextFatt){
    return;
  }
  ord.items=nextItems;
  ord.nomeCliente=nextNome;
  ord.nota=nextNota;
  ord.fatturaRichiesta=!!cart.fatturaRichiesta;
  ord.fatturaCliente=cart.fatturaCliente?JSON.parse(JSON.stringify(cart.fatturaCliente)):null;
  ord.salvaFatturaInRubrica=!!cart.salvaFatturaInRubrica;
  ord.tipo=cart.tipo||(cart.fatturaRichiesta?'fattura':'');
  ord.numeroFattura=cart.numeroFattura||'';
  ord.scontoGlobale=cart.scontoGlobale||null;
  ord.totale=ordTotaleSenzaCongelati(ord).toFixed(2);
  if(typeof ordineResetVistoSeNegozio === 'function') ordineResetVistoSeNegozio(ord);
  saveOrdini();
}

// Elimina la bozza collegata (chiamata quando si invia l'ordine vero)
function _rimuoviBozzaOrdine(cart){
  if(!cart||!cart.bozzaOrdId)return;
  // Rilascia il lock sulla bozza prima di eliminarla
  ordUnlock(cart.bozzaOrdId);
  ordini=ordini.filter(function(o){return o.id!==cart.bozzaOrdId;});
  delete cart.bozzaOrdId;
}

function inviaOrdine(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!(cart.items||[]).length){showToastGen('red','-- Carrello vuoto!');return;}
  if(typeof inviaOrdineBloccaSeDuplicato==='function'){
    var _dupMsg=inviaOrdineBloccaSeDuplicato(cart);
    if(_dupMsg){ showToastGen('orange', _dupMsg); return; }
  }
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);
  // Rimuovi bozza se presente
  _rimuoviBozzaOrdine(cart);
  var tot=(cart.items||[]).reduce(function(s,it){return s+(_prezzoEffettivo(it)*parseFloat(it.qty||0));},0);
  var numOrd=getNextOrdNum();
  var ord={
    id:'ord_'+Date.now(),
    numero:numOrd,
    nomeCliente:cart.nome,
    ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    data:new Date().toLocaleDateString('it-IT'),
    dataISO:new Date().toISOString().slice(0,10),
    createdAt:new Date().toISOString(),
    visto:false,
    items:(function(){
      var cpy=JSON.parse(JSON.stringify(cart.items));
      cpy.forEach(function(it){
        if(typeof normalizeUmValue === 'function') it.unit = normalizeUmValue(it.unit || 'pz');
        ensurePrezzoOriginaleDaListino(it, true);
        var sc=it._scontoApplicato||0;
        var base=parsePriceIT(it._prezzoOriginale);
        if(base<=0) return;
        var scOn=it.scampolo||it.fineRotolo;
        if(scOn&&sc>0){
          it.prezzoUnit=(base*(1-sc/100)).toFixed(2);
        }
        if(it._scaglionato&&sc>0){
          var q=parseFloat(it.qty||0);
          if(q>=(it._scaglioneQta||10)){
            it.prezzoUnit=(base*(1-sc/100)).toFixed(2);
          } else {
            it.prezzoUnit=it._prezzoOriginale;
          }
        }
      });
      return cpy;
    })(),
    nota:cart.nota||'',
    totale:tot.toFixed(2),
    stato:'nuovo',
    scontoGlobale:cart.scontoGlobale||null,
    commesso:cart.commesso||'',
    fatturaRichiesta:!!cart.fatturaRichiesta,
    fatturaCliente:cart.fatturaCliente?JSON.parse(JSON.stringify(cart.fatturaCliente)):null,
    salvaFatturaInRubrica:!!cart.salvaFatturaInRubrica,
    tipo:cart.tipo||(cart.fatturaRichiesta?'fattura':''),
    numeroFattura:cart.numeroFattura||''
  };
  if(typeof riepilogoCopyToOrdine === 'function') riepilogoCopyToOrdine(cart, ord);
  // Difesa esplicita: invio da carrello non deve mai partire come "visto"
  ord.visto = false;
  if(ord.fatturaRichiesta && ord.salvaFatturaInRubrica && ord.fatturaCliente && typeof upsertClienteAnagrafica==='function'){
    upsertClienteAnagrafica(ord.fatturaCliente);
  }
  ordini.unshift(ord);
  if(typeof window.ordNotificaMarkOrdineIdsKnown === 'function') window.ordNotificaMarkOrdineIdsKnown(ord.id);
  saveOrdini();

  // -- Scarico automatico magazzino --
  var sottoScortaList=[];
  (cart.items||[]).forEach(function(it){
    if(it.rowIdx===undefined||it.rowIdx===null)return;
    var m=magazzino[it.rowIdx];
    if(!m)return;
    var prevQty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    if(prevQty===null)return; // se non ha qty impostata, non scaricare
    var venduto=parseFloat(it.qty||0);
    var nuovaQty=Math.max(0, prevQty - venduto);
    m.qty=nuovaQty;
    lsSet(MAGK, magazzino);
    // Controlla soglia
    var soglia=getSoglia(it.rowIdx);
    if(nuovaQty<=soglia){
      var desc=(rows[it.rowIdx]&&rows[it.rowIdx].desc)||it.desc||'Articolo';
      sottoScortaList.push({desc:desc,qty:nuovaQty,soglia:soglia});
    }
  });
  // Notifica sotto scorta
  if(sottoScortaList.length){
    var msg='- SOTTO SCORTA:\n';
    sottoScortaList.forEach(function(s){
      msg+=s.desc+' - rimasti '+s.qty+' (min: '+s.soglia+')\n';
    });
    setTimeout(function(){
      showToastGen('red',msg.trim());
    },1500);
  }

  // Segna il carrello come "inviato": resta condiviso su Firebase in tempo reale
  cart.stato='inviato';
  cart.ordId=ord.id;
  cart.locked=true;
  if(typeof _ctInvEsauritiOpen !== 'undefined') _ctInvEsauritiOpen[cart.id] = true;
  saveCarrelli();
  _lastAddedItem=null;
  feedbackSend();
  renderCartTabs();
  showToastGen('green','✅ Ordine #'+numOrd+' inviato! — '+ord.nomeCliente+' — €'+tot.toFixed(2));
}


// ── Modifica nome cliente dal carrello ───────────────────────────
function ctEditClienteName(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  var nome = prompt('Nome cliente:', cart.nome || '');
  if(nome === null) return;
  cart.nome = nome.trim();
  saveCarrelli();
  // Aggiorna anche l'ordine collegato
  if(cart.ordId && cart.stato !== 'modifica'){
    var ord = ordini.find(function(o){ return o.id === cart.ordId; });
    if(ord){ ord.nomeCliente = nome.trim(); saveOrdini(); }
  }
  renderCartTabs();
  showToastGen('green', '✏️ Cliente aggiornato');
}

// ── Imposta quantità minima scaglione (carrello) ─────────────────
function cartSetScaglioneQta(cartId, idx, val){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  if(cart.items[idx]._stornoReso) return;
  cart.items[idx]._scaglioneQta = parseInt(val) || 10;
  saveCarrelli(); renderCartTabs();
}

// ── Override saveCarrelli: aggiorna automaticamente le bozze attive ──
// (core.js definisce saveCarrelli; qui la estendiamo senza toccare database.js)
/** Dopo merge Firebase carrelli: propaga qty al ordine/bozza se il carrello remoto è cambiato. */
function cartSyncOrdiniDopoMergeRemote(localBefore){
  if(!localBefore || !carrelli) return;
  var beforeById = {};
  localBefore.forEach(function(c){ if(c && c.id) beforeById[c.id] = c; });
  var needOrdListRefresh = false;
  (carrelli || []).forEach(function(cart){
    if(!cart || !cart.id) return;
    var prev = beforeById[cart.id];
    if(prev && JSON.stringify(prev) === JSON.stringify(cart)) return;
    if(cart.bozzaOrdId){
      _aggiornaBozzaOrdine(cart);
      needOrdListRefresh = true;
    }
    if(cart.stato === 'modifica' && cart.ordId){
      _aggiornaOrdineDaCarrelloModifica(cart);
      needOrdListRefresh = true;
    }
  });
  if(needOrdListRefresh && typeof renderOrdini === 'function'){
    var to = document.getElementById('to');
    if(to && to.classList.contains('active')) renderOrdini();
  }
}

(function(){
  var _origSaveCarrelli = saveCarrelli;
  saveCarrelli = function(){
    try{
      if(typeof carrelli!=='undefined'&&carrelli&&typeof riepilogoCartMaybeReset==='function'){
        carrelli.forEach(function(c){
          riepilogoCartMaybeReset(c);
          if(typeof riepilogoSyncCompleto==='function') riepilogoSyncCompleto(c);
        });
      }
    }catch(_eR){}
    try{
      if(typeof carrelli!=='undefined'&&carrelli&&typeof activeCartId==='string'&&activeCartId){
        var _touch = carrelli.find(function(c){ return c && c.id === activeCartId; });
        if(_touch && (typeof ctCartShouldTouchUltimaModifica !== 'function' || ctCartShouldTouchUltimaModifica(_touch))){
          _touch.ultimaModificaISO = new Date().toISOString();
        }
      }
    }catch(_e){}
    _origSaveCarrelli();
    if(typeof _fbSyncingCart !== 'undefined' && _fbSyncingCart) return;
    if(typeof _fbSyncing !== 'undefined' && _fbSyncing) return;
    var needOrdListRefresh=false;
    (carrelli||[]).forEach(function(cart){
      if(cart.bozzaOrdId){
        _aggiornaBozzaOrdine(cart);
        needOrdListRefresh=true;
      }
      if(cart.stato==='modifica' && cart.ordId){
        _aggiornaOrdineDaCarrelloModifica(cart);
        needOrdListRefresh=true;
      }
    });
    if(needOrdListRefresh && typeof renderOrdini==='function'){
      var to=document.getElementById('to');
      if(to&&to.classList.contains('active')) renderOrdini();
    }
  };
})();
