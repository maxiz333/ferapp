// --- CARRELLO - OPERAZIONI ARTICOLI ---------------------------
function _cartLabelModalita(it){
  if(!it) return 'listino';
  if(it.scampolo) return 'SCA';
  if(it.fineRotolo||it._tuttoRotolo) return 'ROT';
  if(it._scaglionato) return 'Scaglioni';
  return 'listino';
}
function _cartSyncLinkedOrdine(cart){
  if(!cart) return;
  if(typeof _aggiornaBozzaOrdine==='function' && cart.bozzaOrdId){
    _aggiornaBozzaOrdine(cart);
  }
  if(typeof _aggiornaOrdineDaCarrelloModifica==='function' && cart.stato==='modifica' && cart.ordId){
    _aggiornaOrdineDaCarrelloModifica(cart);
  }
  // Refresh esplicito tab Ordini: evita che la UI resti con testi vecchi.
  if(typeof renderOrdini==='function'){
    renderOrdini();
  }
  if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
    window.dispatchEvent(new CustomEvent('sync-orders',{detail:{source:'carrello'}}));
  }
}
function cartAddItem(rowIdx){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});if(!cart)return;
  var r=rows[rowIdx]||{};
  var m=magazzino[rowIdx]||{};
  var hasScag=!!(m.scaglioni&&m.scaglioni.length);
  var newItem={rowIdx:rowIdx,desc:r.desc||'',codF:r.codF||'',codM:r.codM||'',specs:m.specs||'',
    posizione:m.posizione||'',prezzoUnit:r.prezzo||'0',qty:1,unit:m.unit||'pz',
    scampolo:false,hasScaglioni:hasScag,scaglioni:hasScag?JSON.parse(JSON.stringify(m.scaglioni)):[],
    nota:'',_scaglioniAperti:false,daOrdinare:false};
  (cart.items=cart.items||[]).push(newItem);
  // Sync immediata su bozza/ordine collegato per evitare lag o race di salvataggio.
  _cartSyncLinkedOrdine(cart);
  _lastAddedItem={rowIdx:rowIdx,item:JSON.parse(JSON.stringify(newItem))};
  var oSt=ordinePerCarrelloStorico(cart);
  if(oSt){
    ordineAppendStorico(oSt,'Aggiunto: '+(newItem.desc||'articolo'));
    if(typeof saveOrdini==='function') saveOrdini();
  }
  saveCarrelli();
  feedbackAdd();
  // Avviso stock basso
  var stock=m.qty!==undefined&&m.qty!==''?Number(m.qty):-1;
  var soglia=m.soglia!==undefined&&m.soglia!==''?Number(m.soglia):1;
  if(stock>=0&&stock<=soglia){
    if(stock===0){
      showToastGen('red','-- ESAURITO - '+r.desc+' (stock: 0)');
    } else {
      showToastGen('orange','-- Stock basso - '+r.desc+' (rimaste: '+stock+' '+esc(m.unit||'pz')+')');
    }
  }
  var s=document.getElementById('cart-search');if(s)s.value='';
  var rs=document.getElementById('cart-search-results');if(rs)rs.innerHTML='';
  renderCartTabs();
  // Flash sull'ultimo articolo aggiunto (in cima alla lista)
  setTimeout(function(){
    var lastIdx = (cart.items||[]).length - 1;
    var el = lastIdx >= 0 ? document.getElementById('cart-row-' + lastIdx) : null;
    if(el){ el.classList.add('cart-item-flash'); el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  },50);
}
function cartDelta(cartId,idx,delta){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var oldQ=Math.round(parseFloat(cart.items[idx].qty)||0);
  // Fix: incremento sempre intero (1, 2, 3...) — minimo assoluto 1
  var newQty = oldQ + Math.round(delta);
  cart.items[idx].qty = Math.max(1, newQty);
  _cartRicalcolaPrezzoVendita(cart.items[idx]);
  var o=ordinePerCarrelloStorico(cart);
  if(o&&oldQ!==cart.items[idx].qty){
    var it=cart.items[idx];
    ordineAppendStorico(o,'Quantità '+((it&&it.desc)||'?')+': '+oldQ+' → '+it.qty+' '+(it.unit||'pz'));
    if(typeof saveOrdini==='function') saveOrdini();
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
function cartSetQty(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var oldQ=Math.round(parseFloat(cart.items[idx].qty)||0);
  // Fix: solo interi, minimo 1
  cart.items[idx].qty = Math.max(1, Math.round(parseFloat(val)||1));
  _cartRicalcolaPrezzoVendita(cart.items[idx]);
  var o=ordinePerCarrelloStorico(cart);
  if(o&&oldQ!==cart.items[idx].qty){
    var it=cart.items[idx];
    ordineAppendStorico(o,'Quantità '+((it&&it.desc)||'?')+': '+oldQ+' → '+it.qty+' '+(it.unit||'pz'));
    if(typeof saveOrdini==='function') saveOrdini();
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
/** Rimuove la nota automatica "ROTOLO INTERO" se l'articolo non è più in modalità rotolo intero. */
function cartStripStaleRotoloInteroNota(it){
  if(!it) return;
  if(String(it.nota || '').trim() !== 'ROTOLO INTERO') return;
  if(!it._tuttoRotolo) it.nota = '';
}

function cartSetPrezzo(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  var oldP=String(it.prezzoUnit||'');
  if(String(val||'')===oldP) return;
  it.prezzoUnit=val;
  cartStripStaleRotoloInteroNota(it);
  if(itemUsesPrezzoPerBaseUm(it.unit)) itemSyncPrezzoUnitaBaseDaPrezzoRiga(it);
  var o=ordinePerCarrelloStorico(cart);
  if(o&&oldP!==String(val)){
    ordineAppendStorico(o,'Prezzo '+((it.desc)||'?')+': €'+oldP+' → €'+val);
    if(typeof saveOrdini==='function') saveOrdini();
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
function cartSetUnit(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  it.unit=val;
  cartStripStaleRotoloInteroNota(it);
  if(!itemUsesPrezzoPerBaseUm(val)){
    delete it._prezzoUnitaBase;
  } else if(it._prezzoUnitaBase && parsePriceIT(it._prezzoUnitaBase) > 0){
    itemApplyPrezzoUnitaBase(it);
  } else if(parsePriceIT(it.prezzoUnit) > 0){
    itemSyncPrezzoUnitaBaseDaPrezzoRiga(it);
  }
  if(it.scampolo || it.fineRotolo || it._scaglionato || (it.hasScaglioni && it.scaglioni && it.scaglioni.length)){
    ensurePrezzoOriginaleDaListino(it, true);
    _cartRicalcolaPrezzoVendita(it);
    if(parsePriceIT(it.prezzoUnit) <= 0 && _cartSeedPrezzoOriginaleFromRiga(it)){
      _cartRicalcolaPrezzoVendita(it);
    }
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}

// Helper: calcola prezzo effettivo (con sconto scampolo/rotolo se attivo) — base = listino
function _prezzoEffettivo(it){
  return ordItemLineUnitSelling(it);
}

/** Imposta _prezzoOriginale (listino) se manca, da magazzino/base o dall'ultimo prezzo riga. */
function _cartSeedPrezzoOriginaleFromRiga(it){
  if(!it) return false;
  if(it._prezzoOriginale != null && String(it._prezzoOriginale).trim() !== '' && parsePriceIT(it._prezzoOriginale) > 0){
    return true;
  }
  var str = listinoPrezzoString(it);
  if(str && parsePriceIT(str) > 0){
    it._prezzoOriginale = str;
    return true;
  }
  var pu = parsePriceIT(it.prezzoUnit);
  if(pu > 0){
    it._prezzoOriginale = itemFormatPrezzoLineStr(pu);
    return true;
  }
  return false;
}

/**
 * Ricalcola prezzoUnit dopo forbici / qtà / UM: allinea listino, sconto scampolo-rotolo e soglia scaglione.
 * Deve essere chiamata dopo cartCycleScampolo, cartDelta, cambio %, ecc.
 */
function _cartRicalcolaPrezzoVendita(it){
  if(!it) return;
  if(it.hasScaglioni && it.scaglioni && it.scaglioni.length){
    if(!it._prezzoBase && parsePriceIT(it.prezzoUnit) > 0) it._prezzoBase = it.prezzoUnit;
    _cartApplicaScaglione(it);
    return;
  }
  if(it._scaglionato){
    if(itemUsesPrezzoPerBaseUm(it.unit) && parsePriceIT(it._prezzoUnitaBase) > 0){
      _cartSeedPrezzoOriginaleFromRiga(it);
      itemApplyPrezzoUnitaBase(it);
    } else {
      if(!_cartSeedPrezzoOriginaleFromRiga(it)) return;
      var baseSc = parsePriceIT(it._prezzoOriginale);
      if(baseSc <= 0) return;
      var scSc = it._scontoApplicato || 0;
      var qSc = parseFloat(it.qty || 0);
      var sogliaSc = it._scaglioneQta || 10;
      if(scSc > 0 && qSc >= sogliaSc){
        it.prezzoUnit = itemFormatPrezzoLineStr(baseSc * (1 - scSc / 100));
      } else {
        it.prezzoUnit = String(it._prezzoOriginale);
      }
    }
    return;
  }
  if(it.scampolo || it.fineRotolo){
    if(itemUsesPrezzoPerBaseUm(it.unit) && parsePriceIT(it._prezzoUnitaBase) > 0){
      _cartSeedPrezzoOriginaleFromRiga(it);
      itemApplyPrezzoUnitaBase(it);
    } else {
      _applicaScontoScampolo(it);
    }
  }
}

function cartCycleScampolo(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  var prevLab=_cartLabelModalita(it);
  if(!it.scampolo && !it.fineRotolo && !it._tuttoRotolo && !it._scaglionato){
    ensurePrezzoOriginaleDaListino(it, true);
    it.scampolo=true; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=false;
    it._scontoTipo='scampolo';
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAMPOLO_DEFAULT_PCT;
  } else if(it.scampolo){
    ensurePrezzoOriginaleDaListino(it, true);
    it.scampolo=false; it.fineRotolo=true; it._tuttoRotolo=true; it._scaglionato=false;
    it._scontoTipo='rotolo';
    it._scontoApplicato = SCONTO_ROTOLO_DEFAULT_PCT;
    it.nota='ROTOLO INTERO';
  } else if(it.fineRotolo || it._tuttoRotolo){
    ensurePrezzoOriginaleDaListino(it, true);
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=true;
    it._scontoTipo='scaglionato';
    if(it.nota==='ROTOLO INTERO') it.nota='';
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAGLIONI_DEFAULT_PCT;
    if(!it._scaglioneQta) it._scaglioneQta=10;
  } else {
    var restoreC = it._prezzoOriginale || listinoPrezzoString(it);
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=false;
    delete it._scontoTipo; delete it._scontoApplicato; delete it._scaglioneQta;
    delete it._prezzoOriginale;
    if(restoreC && parsePriceIT(restoreC) > 0) it.prezzoUnit = restoreC;
  }
  cartStripStaleRotoloInteroNota(it);
  if((it.hasScaglioni && it.scaglioni && it.scaglioni.length) || it.scampolo || it.fineRotolo || it._scaglionato){
    _cartRicalcolaPrezzoVendita(it);
  }
  var o=ordinePerCarrelloStorico(cart);
  if(o){
    var nl=_cartLabelModalita(it);
    if(prevLab!==nl){
      var desc=(it.desc||'?');
      if(nl==='SCA') ordineAppendStorico(o,'Modalità Scampolo (SCA): '+desc);
      else if(nl==='ROT') ordineAppendStorico(o,'Modalità Rotolo (ROT): '+desc);
      else if(nl==='Scaglioni') ordineAppendStorico(o,'Modalità scaglioni: '+desc);
      else ordineAppendStorico(o,'Prezzo listino: '+desc);
      if(typeof saveOrdini==='function') saveOrdini();
    }
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
function cartSetScontoScampolo(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  var oldSc=it._scontoApplicato;
  it._scontoApplicato=parseFloat(val)||0;
  cartStripStaleRotoloInteroNota(it);
  if(it.scampolo||it.fineRotolo||it._scaglionato||(it.hasScaglioni&&it.scaglioni&&it.scaglioni.length)){
    _cartRicalcolaPrezzoVendita(it);
  }
  var o=ordinePerCarrelloStorico(cart);
  if(o&&(it.scampolo||it.fineRotolo||it._scaglionato)&&(oldSc!==it._scontoApplicato)){
    ordineAppendStorico(o,'Sconto '+((it.desc)||'?')+': '+(oldSc!=null?oldSc+'%':'—')+' → '+it._scontoApplicato+'% ('+_cartLabelModalita(it)+')');
    if(typeof saveOrdini==='function') saveOrdini();
  }
  _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
function _applicaScontoScampolo(it){
  if(!ensurePrezzoOriginaleDaListino(it, true)){
    if(!_cartSeedPrezzoOriginaleFromRiga(it)) return;
    ensurePrezzoOriginaleDaListino(it, true);
  }
  var base = parsePriceIT(it._prezzoOriginale);
  if(base <= 0) return;
  var sc = it._scontoApplicato || 0;
  if((it.scampolo || it.fineRotolo) && sc > 0){
    it.prezzoUnit = itemFormatPrezzoLineStr(base * (1 - sc / 100));
  } else if(it.scampolo || it.fineRotolo){
    it.prezzoUnit = String(it._prezzoOriginale);
  }
}

function itemFormatPrezzoLineStr(lineNum){
  if(lineNum >= 0.01){
    return lineNum.toFixed(2).replace('.', ',');
  }
  var s = lineNum.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

function itemSyncPrezzoUnitaBaseDaPrezzoRiga(it){
  if(!it || !itemUsesPrezzoPerBaseUm(it.unit)) return;
  var pu = parsePriceIT(it.prezzoUnit);
  if(pu <= 0) return;
  var f = itemUmToBasePriceFactor(it.unit);
  if(f <= 0) return;
  it._prezzoUnitaBase = itemFormatPrezzoLineStr(pu / f);
}

function itemApplyPrezzoUnitaBase(it){
  if(!it || !itemUsesPrezzoPerBaseUm(it.unit)) return;
  var b = parsePriceIT(it._prezzoUnitaBase);
  if(b <= 0) return;
  var f = itemUmToBasePriceFactor(it.unit);
  var lineListino = b * f;
  var lineStr = itemFormatPrezzoLineStr(lineListino);

  if(it.scampolo || it.fineRotolo || it._scaglionato){
    it._prezzoOriginale = lineStr;
    if(it.hasScaglioni && it.scaglioni && it.scaglioni.length){
      it._prezzoBase = lineStr;
    }
    if(it._scaglionato){
      var sc = it._scontoApplicato || 0;
      var qSc = parseFloat(it.qty || 0);
      var soglia = it._scaglioneQta || 10;
      if(sc > 0 && qSc >= soglia){
        it.prezzoUnit = (lineListino * (1 - sc / 100)).toFixed(2).replace('.', ',');
      } else {
        it.prezzoUnit = lineStr;
      }
    } else {
      _applicaScontoScampolo(it);
    }
  } else {
    delete it._prezzoOriginale;
    it.prezzoUnit = lineStr;
  }
  _cartApplicaScaglione(it);
}

var _cartBaseUmTimers = {};

function cartInputPrezzoUnitaBase(cartId, idx, el){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];
  it._prezzoUnitaBase = el.value;
  if(parsePriceIT(el.value) > 0){
    itemApplyPrezzoUnitaBase(it);
  }
  cartRefreshLineAndTotals(cartId, idx);
  var key = cartId + '_' + idx;
  clearTimeout(_cartBaseUmTimers[key]);
  _cartBaseUmTimers[key] = setTimeout(function(){
    saveCarrelli();
    var o = ordinePerCarrelloStorico(cart);
    if(o && typeof saveOrdini === 'function') saveOrdini();
  }, 450);
}

function cartRefreshLineAndTotals(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];
  var q = parseFloat(it.qty) || 0;
  var p0 = listinoPrezzoNum(it);
  var pEff = _prezzoEffettivo(it);
  var hasSconto = p0 > pEff + 0.005;
  var sub = (pEff * q).toFixed(2);
  var przStrip = document.getElementById('cart-prz-strip-' + idx);
  if(przStrip){
    if(hasSconto){
      przStrip.style.display = '';
      przStrip.innerHTML = htmlPrezzoUnitScontoRiga(p0, pEff);
    } else {
      przStrip.innerHTML = '';
      przStrip.style.display = 'none';
    }
  }
  var przCell = document.getElementById('prz-' + idx);
  if(przCell){
    var puInp = przCell.querySelector('input.ct-punit');
    if(puInp && document.activeElement !== puInp){
      puInp.value = String(it.prezzoUnit != null && it.prezzoUnit !== '' ? it.prezzoUnit : '0');
    }
  }
  var pbDisc = document.getElementById('cart-pb-disc-' + idx);
  if(pbDisc && itemUsesPrezzoPerBaseUm(it.unit)){
    var bd = itemBaseUmScontoDisplay(it);
    if(bd && bd.hasSc){
      pbDisc.innerHTML = '<span class="ct-pb-struck">€' + formatPrezzoUnitDisplay(bd.b0) + '</span>' +
        '<span class="ct-pb-final">€' + formatPrezzoUnitDisplay(bd.b1) + '</span>' +
        '<span class="ct-pb-sav">-€' + formatPrezzoUnitDisplay(bd.savPerBase) + '</span>';
    } else {
      pbDisc.innerHTML = '';
    }
  }
  var subEl = document.getElementById('cart-sub-' + idx);
  if(subEl){
    if(hasSconto){
      subEl.innerHTML = htmlTotaleScontoRiga(p0 * q, parseFloat(sub));
    } else {
      var subColor = it._tuttoRotolo ? '#fc8181' : (it.fineRotolo ? '#f6ad55' : 'var(--accent)');
      subEl.innerHTML = '<div class="ord-gc-sub-val" style="color:' + subColor + '">€' + sub + '</div>';
    }
  }
  var tot = (cart.items || []).reduce(function(s, row){
    return s + _prezzoEffettivo(row) * parseFloat(row.qty || 0);
  }, 0);
  var totFin = cart.scontoGlobale ? tot * (1 - cart.scontoGlobale / 100) : tot;
  var foot = document.querySelector('.ct-footer-tot');
  if(foot){
    foot.innerHTML = '<span class="ct-footer-sym">€</span>' + totFin.toFixed(2);
  }
}

function cartSetNota(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx].nota=val;saveCarrelli();
}
function cartToggleNotaInline(cartId,idx){
  var el=document.getElementById('cart-nota-'+idx);
  if(!el)return;
  var isVisible=el.style.display!=='none';
  el.style.display=isVisible?'none':'block';
  if(!isVisible){
    var inp=el.querySelector('input');
    if(inp){inp.focus();inp.select();}
  }
}
function cartHideNota(idx){
  // Piccolo ritardo per permettere all'oninput di salvare prima di nascondere
  setTimeout(function(){
    var el=document.getElementById('cart-nota-'+idx);
    if(el) el.style.display='none';
  },150);
}
function cartToggleDaOrdinare(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  it.daOrdinare=!it.daOrdinare;
  if(it.daOrdinare){
    if(!it._ordColore || it._ordColore==='#888888') it._ordColore='#e53e3e';
    var map=typeof ctGetForniColore==='function'?ctGetForniColore():{};
    if(map[it._ordColore]) it._ordFornitoreNome=map[it._ordColore];
 } else {
    delete it._ordColore;
    delete it._ordFornitoreNome;
  }
  if(typeof _cartSyncLinkedOrdine==='function') _cartSyncLinkedOrdine(cart);
  saveCarrelli();renderCartTabs();
}
function cartSetNotaOrdine(cartId,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(cart){cart.nota=val;saveCarrelli();}
}
function cartRemoveItem(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});if(!cart)return;
  if(!(cart.items||[])[idx])return;
  _takeSnapshot();
  _fbSyncing=true; // blocca Firebase durante operazione
  var removed=(cart.items||[]).splice(idx,1)[0];
  if(cart.bozzaOrdId){
    var bozza=typeof ordini!=='undefined'?ordini.find(function(o){return o.id===cart.bozzaOrdId;}):null;
    if(bozza&&bozza.stato==='bozza'){
      var oldFrozen=(bozza.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
      var fz=JSON.parse(JSON.stringify(removed));
      fz.congelato=true;
      bozza.items=JSON.parse(JSON.stringify(cart.items||[])).concat(oldFrozen).concat([fz]);
      ordineAppendStorico(bozza,'Rimosso (congelato): '+(removed.desc||'?'));
      if(typeof saveOrdini==='function') saveOrdini();
    }
  }
  // Ordine confermato sbloccato in modifica: stesso schema bozza — riga in fondo come congelata
  if(cart.stato==='modifica' && cart.ordId){
    var ordMod=typeof ordini!=='undefined'?ordini.find(function(o){return o.id===cart.ordId;}):null;
    if(ordMod){
      var oldFrOrd=(ordMod.items||[]).filter(function(it){ return ordItemCongelato(it); }).map(function(it){ return JSON.parse(JSON.stringify(it)); });
      var fzOrd=JSON.parse(JSON.stringify(removed));
      fzOrd.congelato=true;
      ordMod.items=JSON.parse(JSON.stringify(cart.items||[])).concat(oldFrOrd).concat([fzOrd]);
      ordMod.totale=ordTotaleSenzaCongelati(ordMod).toFixed(2);
      ordineAppendStorico(ordMod,'Rimosso (congelato): '+(removed.desc||'?'));
      if(typeof saveOrdini==='function') saveOrdini();
    }
  }
  // Sync immediata ordine/bozza collegata dopo rimozione riga.
  _cartSyncLinkedOrdine(cart);
  if(typeof saveCarrelli==='function') saveCarrelli();
  else{ lsSet(CARTK,carrelli);updateCartBadge();_fbPush('carrelli',carrelli); }
  setTimeout(function(){_fbSyncing=false;},1000);
  renderCartTabs();
  // Undo toast
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#222;border:1px solid #444;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:9000;box-shadow:0 4px 20px rgba(0,0,0,.5);';
  t.innerHTML='<span style="font-size:13px;color:#e0e0e0;">-- Rimosso</span>';
  var btn=document.createElement('button');
  btn.textContent='Annulla';
  btn.style.cssText='padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;';
  btn.onclick=function(){
    delete removed.congelato;
    (cart.items||[]).splice(idx,0,removed);
    if(cart.bozzaOrdId){
      var bz=typeof ordini!=='undefined'?ordini.find(function(o){return o.id===cart.bozzaOrdId;}):null;
      if(bz&&bz.stato==='bozza'){
        var fr=(bz.items||[]).filter(function(it){ return ordItemCongelato(it); });
        var found=false;
        fr=fr.filter(function(it){
          if(!found&&ordineItemMatchPerUndo(it,removed)){ found=true; return false; }
          return true;
        });
        bz.items=JSON.parse(JSON.stringify(cart.items||[])).concat(fr);
        if(typeof saveOrdini==='function') saveOrdini();
      }
    }
    if(cart.stato==='modifica' && cart.ordId){
      var oUndo=typeof ordini!=='undefined'?ordini.find(function(x){return x.id===cart.ordId;}):null;
      if(oUndo){
        var frO=(oUndo.items||[]).filter(function(it){ return ordItemCongelato(it); });
        var fo=false;
        frO=frO.filter(function(it){
          if(!fo&&ordineItemMatchPerUndo(it,removed)){ fo=true; return false; }
          return true;
        });
        oUndo.items=JSON.parse(JSON.stringify(cart.items||[])).concat(frO);
        oUndo.totale=ordTotaleSenzaCongelati(oUndo).toFixed(2);
        if(typeof saveOrdini==='function') saveOrdini();
      }
    }
    _cartSyncLinkedOrdine(cart);
    saveCarrelli();renderCartTabs();t.remove();
  };
  t.appendChild(btn);document.body.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},5000);
}

function cartDuplicaItem(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var orig=cart.items[idx];
  var copy=JSON.parse(JSON.stringify(orig));
  copy.nota=copy.nota?(copy.nota+' (copia)'):'(copia)';
  copy.qty=1;
  copy._checked=false;
  copy._correlatiAperti=false;
  (cart.items||[]).splice(idx+1,0,copy);
  feedbackAdd();
  saveCarrelli();renderCartTabs();
  showToastGen('green','- Articolo duplicato - modifica la nota per distinguerlo');
}

// --- SPUNTE CARRELLO (verifica pezzi presi) -------------------
function cartToggleCheck(cartId,idx,checked){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx]._checked=checked;
  // Aggiorna visuale senza re-render completo
  var row=document.getElementById('cart-row-'+idx);
  if(row){
    row.style.opacity=checked?'0.5':'1';
    row.style.background=checked?'rgba(56,161,105,.06)':'';
    var desc=row.querySelector('div[style*="font-weight:700"]');
    if(desc){
      desc.style.textDecoration=checked?'line-through':'none';
      desc.style.opacity=checked?'0.6':'1';
    }
  }
  saveCarrelli();
  // Aggiorna counter nello sticky (leggero, senza re-render)
  var checkedN=(cart.items||[]).filter(function(x){return x._checked;}).length;
  var allDone=checkedN===(cart.items||[]).length;
  // Re-render sticky solo se cambia lo stato "tutto spuntato"
  renderCartTabs();
}

// --- CORRELATI NEL CARRELLO -----------------------------------
function cartToggleCorrelati(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx]._correlatiAperti=!cart.items[idx]._correlatiAperti;
  saveCarrelli();renderCartTabs();
}

function _trovaCorrelati(rowIdx){
  var r=rows[rowIdx];if(!r)return[];
  var m=magazzino[rowIdx]||{};
  var results=[];
  var seen={};
  seen[rowIdx]=true;

  // 1. Correlati espliciti dal magazzino
  if(m.correlati&&m.correlati.length){
    m.correlati.forEach(function(ri){
      if(seen[ri]||!rows[ri]||removed.has(String(ri)))return;
      seen[ri]=true;
      results.push({i:ri,r:rows[ri],m:magazzino[ri]||{},reason:'correlato'});
    });
  }

  // 2. Stessa sottocategoria (es. tutte le viti M6, M8, M10...)
  if(m.subcat&&m.cat){
    rows.forEach(function(r2,i2){
      if(seen[i2]||removed.has(String(i2)))return;
      var m2=magazzino[i2]||{};
      if(m2.cat===m.cat&&m2.subcat===m.subcat){
        seen[i2]=true;
        results.push({i:i2,r:r2,m:m2,reason:m.subcat});
      }
    });
  }

  // 3. Stessa categoria (pi- ampio)
  if(m.cat&&results.length<8){
    rows.forEach(function(r2,i2){
      if(seen[i2]||removed.has(String(i2)))return;
      var m2=magazzino[i2]||{};
      if(m2.cat===m.cat){
        seen[i2]=true;
        results.push({i:i2,r:r2,m:m2,reason:'stessa cat.'});
      }
    });
  }

  // 4. Parole chiave in comune nella descrizione (es. "dado" - trova tutti i dadi)
  if(results.length<6){
    var words=(r.desc||'').toLowerCase().split(/\s+/).filter(function(w){return w.length>=4;}).slice(0,3);
    if(words.length){
      rows.forEach(function(r2,i2){
        if(seen[i2]||removed.has(String(i2))||results.length>=12)return;
        var d2=(r2&&r2.desc||'').toLowerCase();
        for(var wi=0;wi<words.length;wi++){
          if(d2.indexOf(words[wi])>=0){
            seen[i2]=true;
            results.push({i:i2,r:r2,m:magazzino[i2]||{},reason:'simile'});
            break;
          }
        }
      });
    }
  }

  return results;
}

// Numpad per quantit-
function openQtyNumpad(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  openNumpad(it.desc,it.qty,it.unit||'pz',function(val){
    it.qty=val;_cartRicalcolaPrezzoVendita(it);saveCarrelli();renderCartTabs();
  });
}

// --- SCAGLIONI CARRELLO ---------------------------------------
function _cartApplicaScaglione(it){
  if(!it.hasScaglioni||!it.scaglioni||!it.scaglioni.length){
    if(it._prezzoBase){it.prezzoUnit=it._prezzoBase;delete it._prezzoBase;delete it._scaglioneAttivo;}
    return;
  }
  var qty=parseFloat(it.qty)||1;
  if(!it._prezzoBase)it._prezzoBase=it.prezzoUnit;
  // Filtra solo scaglioni completi (con qtaMin > 0 e sconto > 0)
  var validi=it.scaglioni.filter(function(sg){
    return sg.qtaMin&&parseFloat(sg.qtaMin)>0&&sg.sconto&&parseFloat(sg.sconto)>0;
  });
  // Calcola prezzo per ogni scaglione valido
  var base=parsePriceIT(it._prezzoBase)||0;
  validi.forEach(function(sg){
    if(base>0)sg.prezzo=(base*(1-parseFloat(sg.sconto)/100)).toFixed(2);
  });
  var sorted=validi.sort(function(a,b){return(parseFloat(b.qtaMin)||0)-(parseFloat(a.qtaMin)||0);});
  for(var i=0;i<sorted.length;i++){
    var sg=sorted[i];
    if(qty>=parseFloat(sg.qtaMin)){
      it.prezzoUnit=String(sg.prezzo);
      it._scaglioneAttivo={qtaMin:sg.qtaMin,sconto:sg.sconto,prezzo:sg.prezzo};
      return;
    }
  }
  it.prezzoUnit=it._prezzoBase;
  delete it._scaglioneAttivo;
}

function cartToggleScaglioni(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  it._scaglioniAperti=!it._scaglioniAperti;
  if(!it.hasScaglioni)it.hasScaglioni=true;
  if(!it.scaglioni)it.scaglioni=[];
  // Se apro e non ci sono righe, aggiungi una riga vuota pronta
  if(it._scaglioniAperti&&it.scaglioni.length===0){
    it.scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  }
  saveCarrelli();renderCartTabs();
}

function cartUpdScag(cartId,itemIdx,sgIdx,field,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  var it=cart.items[itemIdx];
  if(!it.scaglioni||!it.scaglioni[sgIdx])return;
  var sg=it.scaglioni[sgIdx];
  var base= parsePriceIT(it._prezzoBase||it.prezzoUnit);
  if(field==='qtaMin')sg.qtaMin=parseFloat(val)||0;
  else if(field==='sconto'){
    sg.sconto=parseFloat(val)||0;
  }
  // Calcola prezzo automaticamente dallo sconto
  if(base>0&&sg.sconto>0){
    sg.prezzo=(base*(1-sg.sconto/100)).toFixed(2);
  }
  _cartApplicaScaglione(it);
  saveCarrelli();renderCartTabs();
}

function cartAddScag(cartId,itemIdx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  if(!cart.items[itemIdx].scaglioni)cart.items[itemIdx].scaglioni=[];
  cart.items[itemIdx].scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  saveCarrelli();renderCartTabs();
}

function cartRmvScag(cartId,itemIdx,sgIdx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  var it=cart.items[itemIdx];
  it.scaglioni.splice(sgIdx,1);
  // Assicurati che ci sia sempre almeno una riga vuota se il pannello - aperto
  if(it._scaglioniAperti&&it.scaglioni.length===0){
    it.scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  }
  _cartApplicaScaglione(it);
  saveCarrelli();renderCartTabs();
}
