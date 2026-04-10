// ordini.righe-ordine.js - estratto da ordini.js

function ordToggleScampolo(gi, ii){
  var ord=ordini[gi]; if(!ord||!ord.items[ii]) return;
  if(ordItemCongelato(ord.items[ii])) return;
  var it=ord.items[ii];
  if(!it.scampolo && !it.fineRotolo && !it._scaglionato){
    if(!ensurePrezzoOriginaleDaListino(it, true)){
      showToastGen('orange','Listino non disponibile: collega l\'articolo al magazzino o imposta il prezzo');
      return;
    }
    it.scampolo=true; it.fineRotolo=false; it._scaglionato=false;
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAMPOLO_DEFAULT_PCT;
    it.prezzoUnit=(parsePriceIT(it._prezzoOriginale)*(1-it._scontoApplicato/100)).toFixed(2);
  } else if(it.scampolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)) return;
    it.scampolo=false; it.fineRotolo=true; it._scaglionato=false;
    it._tuttoRotolo=true;
    it._scontoApplicato=SCONTO_ROTOLO_DEFAULT_PCT;
    it.prezzoUnit=(parsePriceIT(it._prezzoOriginale)*(1-it._scontoApplicato/100)).toFixed(2);
  } else if(it.fineRotolo || it._tuttoRotolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)) return;
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false;
    it._scaglionato=true;
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAGLIONI_DEFAULT_PCT;
    if(!it._scaglioneQta) it._scaglioneQta=10;
    var q=parseFloat(it.qty||0);
    if(q >= it._scaglioneQta){
      it.prezzoUnit=(parsePriceIT(it._prezzoOriginale)*(1-it._scontoApplicato/100)).toFixed(2);
    } else {
      it.prezzoUnit=it._prezzoOriginale;
    }
  } else {
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=false;
    if(it._prezzoOriginale) it.prezzoUnit=it._prezzoOriginale;
    delete it._prezzoOriginale;
    delete it._scontoApplicato;
    delete it._scaglioneQta;
  }
  _ordRecalcSave(gi);
}

function ordSetSconto(gi, ii, val){
  var ord=ordini[gi]; if(!ord||!ord.items[ii]) return;
  if(ordItemCongelato(ord.items[ii])) return;
  var it=ord.items[ii];
  var sc=parseFloat(val)||0;
  if(!ensurePrezzoOriginaleDaListino(it, true)){
    showToastGen('orange','Listino non disponibile');
    return;
  }
  it._scontoApplicato=sc;
  if(it._scaglionato){
    var q=parseFloat(it.qty||0);
    var soglia=it._scaglioneQta||10;
    if(sc>0 && q>=soglia){
      it.prezzoUnit=(parsePriceIT(it._prezzoOriginale)*(1-sc/100)).toFixed(2);
    } else {
      it.prezzoUnit=it._prezzoOriginale;
    }
  } else if(sc>0){
    it.prezzoUnit=(parsePriceIT(it._prezzoOriginale)*(1-sc/100)).toFixed(2);
  } else {
    it.prezzoUnit=it._prezzoOriginale;
  }
  _ordRecalcSave(gi);
}

function ordEditNota(gi, ii){
  var ord=ordini[gi]; if(!ord||!ord.items[ii]) return;
  var nota=prompt('Nota articolo:', ord.items[ii].nota||'');
  if(nota===null) return;
  ord.items[ii].nota=nota;
  saveOrdini();
  if(ord.stato === 'bozza'){
    var cB = carrelli.find(function(x){ return x.bozzaOrdId === ord.id; });
    if(cB){ cB.items = ordItemsSoloAttiviDeep(ord.items); saveCarrelli(); }
  }
  renderOrdini();
  if(ord.stato === 'bozza' && typeof renderCartTabs === 'function') renderCartTabs();
}

function ordSetNotaOrdine(gi, val){
  var ord=ordini[gi]; if(!ord) return;
  ord.nota=val;
  saveOrdini();
  if(ord.stato === 'bozza'){
    var cB = carrelli.find(function(x){ return x.bozzaOrdId === ord.id; });
    if(cB){ cB.nota = val; saveCarrelli(); }
  }
  if(typeof renderCartTabs === 'function') renderCartTabs();
}

function _ordRecalcSave(gi){
  var ord=ordini[gi]; if(!ord) return;
  var tot=ordTotaleSenzaCongelati(ord);
  ord.totale=tot.toFixed(2);
  ord.modificato=true;
  ord.modificatoAt=new Date().toLocaleString('it-IT');
  saveOrdini();
  if(ord.stato === 'bozza'){
    var cB = carrelli.find(function(x){ return x.bozzaOrdId === ord.id; });
    if(cB){ cB.items = ordItemsSoloAttiviDeep(ord.items); saveCarrelli(); }
  }
  renderOrdini();
  if(ord.stato === 'bozza' && typeof renderCartTabs === 'function') renderCartTabs();
}

// ── SBLOCCA/RIBLOCCA ordine completato per modifiche ─────────────
// Usa ordSblocca/ordBlocca definiti sopra

// ── Cambia unità di misura ordine ────────────────────────────────
function ordSetUnit(gi, ii, val){
  var ord=ordini[gi]; if(!ord||!ord.items[ii]) return;
  if(ordItemCongelato(ord.items[ii])) return;
  var it = ord.items[ii];
  it.unit=val;
  if(!itemUsesPrezzoPerBaseUm(val)){
    delete it._prezzoUnitaBase;
  } else if(it._prezzoUnitaBase && parsePriceIT(it._prezzoUnitaBase) > 0){
    itemApplyPrezzoUnitaBase(it);
  } else if(parsePriceIT(it.prezzoUnit) > 0){
    itemSyncPrezzoUnitaBaseDaPrezzoRiga(it);
  }
  ord.modificato=true;
  ord.modificatoAt=new Date().toLocaleString('it-IT');
  saveOrdini();
  if(ord.stato === 'bozza'){
    var cB = carrelli.find(function(x){ return x.bozzaOrdId === ord.id; });
    if(cB){ cB.items = ordItemsSoloAttiviDeep(ord.items); saveCarrelli(); }
  }
  renderOrdini();
  if(ord.stato === 'bozza' && typeof renderCartTabs === 'function') renderCartTabs();
}

var _ordBaseUmTimers = {};

function ordRefreshPrezzoBaseUmVisuals(gi, ii){
  var ord = ordini[gi];
  if(!ord || !ord.items[ii]) return;
  var it = ord.items[ii];
  var isFz = ordItemCongelato(it);
  var pu = parsePriceIT(it.prezzoUnit);
  var q = parseFloat(it.qty || 0);
  var sub = isFz ? '0.00' : (pu * q).toFixed(2);
  var oid = ord.id;

  var prezOrigNum = 0;
  var hasSconto = false;
  var scOn = it.scampolo || it.fineRotolo || it._scaglionato || false;
  var scagAtt = it._scaglioneAttivo || null;
  if(scagAtt && it._prezzoBase){
    prezOrigNum = parsePriceIT(it._prezzoBase);
    hasSconto = prezOrigNum > pu + 0.005;
  } else if((scOn || (it._scontoApplicato && it._scontoApplicato > 0)) && it._prezzoOriginale){
    prezOrigNum = parsePriceIT(it._prezzoOriginale);
    hasSconto = prezOrigNum > pu + 0.005;
  }

  var przStrip = document.getElementById('ord-prz-strip-' + oid + '-' + ii);
  if(przStrip && !isFz){
    if(hasSconto){
      przStrip.innerHTML = htmlPrezzoUnitScontoRiga(prezOrigNum, pu);
    } else {
      przStrip.innerHTML = '<span class="ct-prz-single">€' + formatPrezzoUnitDisplay(pu) + '</span>';
    }
  }

  var pbDisc = document.getElementById('ord-pb-disc-' + oid + '-' + ii);
  if(pbDisc && itemUsesPrezzoPerBaseUm(it.unit)){
    var bdOrd = itemBaseUmScontoDisplay(it);
    if(bdOrd && bdOrd.hasSc){
      pbDisc.innerHTML = '<span class="ct-pb-struck">€' + formatPrezzoUnitDisplay(bdOrd.b0) + '</span>' +
        '<span class="ct-pb-final">€' + formatPrezzoUnitDisplay(bdOrd.b1) + '</span>' +
        '<span class="ct-pb-sav">-€' + formatPrezzoUnitDisplay(bdOrd.savPerBase) + '</span>';
    } else {
      pbDisc.innerHTML = '';
    }
  }

  var subEl = document.getElementById('ord-sub-' + oid + '-' + ii);
  if(subEl && !isFz){
    if(hasSconto){
      subEl.innerHTML = htmlTotaleScontoRiga(prezOrigNum * q, parseFloat(sub));
    } else {
      subEl.innerHTML = '€' + sub;
    }
  }

  var tot = ordTotaleSenzaCongelati(ord);
  var totEl = document.getElementById('ord-total-' + oid);
  if(totEl) totEl.textContent = '€ ' + tot.toFixed(2);
}

function ordInputPrezzoUnitaBase(gi, ii, el){
  var ord = ordini[gi];
  if(!ord || !ord.items[ii]) return;
  var it = ord.items[ii];
  if(ordItemCongelato(it)) return;
  it._prezzoUnitaBase = el.value;
  if(parsePriceIT(el.value) > 0){
    itemApplyPrezzoUnitaBase(it);
  }
  ord.totale = ordTotaleSenzaCongelati(ord).toFixed(2);
  ordRefreshPrezzoBaseUmVisuals(gi, ii);
  var key = ord.id + '_' + ii;
  clearTimeout(_ordBaseUmTimers[key]);
  _ordBaseUmTimers[key] = setTimeout(function(){
    ord.modificato = true;
    ord.modificatoAt = new Date().toLocaleString('it-IT');
    ord.modificatoAtISO = new Date().toISOString();
    saveOrdini();
    var linkedCart = carrelli.find(function(c){ return c.ordId === ord.id; });
    if(!linkedCart && ord.stato === 'bozza'){
      linkedCart = carrelli.find(function(c){ return c.bozzaOrdId === ord.id; });
    }
    if(linkedCart){
      linkedCart.items = ordItemsSoloAttiviDeep(ord.items);
      saveCarrelli();
    }
    if(ord.stato === 'bozza' && typeof renderCartTabs === 'function') renderCartTabs();
  }, 450);
}

// ══ SCHEDA RAPIDA PRODOTTO — popup con foto, desc, posizione ════════════════
// Si apre cliccando sul nome articolo sia dalla tab ordini che inventario
