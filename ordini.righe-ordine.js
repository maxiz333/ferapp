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
  ord.items[ii].unit=val;
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

// ══ SCHEDA RAPIDA PRODOTTO — popup con foto, desc, posizione ════════════════
// Si apre cliccando sul nome articolo sia dalla tab ordini che inventario
