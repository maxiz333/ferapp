// ordini.edit-tab.js - estratto da ordini.js

// --- MODIFICA ORDINE DAL TAB ORDINI ---------------------------
var _editOrdIdx=null;
var _editOrdItems=null;
var _editOrdSyncTimer=null;
var _EDIT_ORD_SYNC_MS=140;

function _linkedCartForOrdine(ord){
  if(!ord) return null;
  var c=carrelli.find(function(x){ return x.ordId===ord.id; });
  if(c) return c;
  if(ord.stato==='bozza') return carrelli.find(function(x){ return x.bozzaOrdId===ord.id; });
  return null;
}

/** Salva righe modifica su ordine + carrello collegato (bozza o ordine in modifica). */
function _flushEditOrdineToStorage(opts){
  opts=opts||{};
  if(_editOrdIdx===null||_editOrdIdx<0) return;
  var ord=ordini[_editOrdIdx];
  if(!ord||!_editOrdItems) return;
  ord.items=JSON.parse(JSON.stringify(_editOrdItems));
  var tot=_editOrdItems.reduce(function(s,it){
    if(ordItemCongelato(it)) return s;
    return s+(ordItemLineUnitSelling(it)*parseFloat(it.qty||0));
  },0);
  ord.totale=tot.toFixed(2);
  ord.modificato=true;
  ord.modificatoAt=new Date().toLocaleString('it-IT');
  ord.modificatoAtISO=new Date().toISOString();
  saveOrdini();
  var linkedCart=_linkedCartForOrdine(ord);
  if(linkedCart){
    linkedCart.items=ordItemsSoloAttiviDeep(_editOrdItems);
    saveCarrelli();
  }
  if(opts.refreshOrdList && typeof renderOrdini==='function') renderOrdini();
  if(typeof renderCartTabs==='function') renderCartTabs();
}

function _scheduleEditOrdineSync(){
  clearTimeout(_editOrdSyncTimer);
  _editOrdSyncTimer=setTimeout(function(){
    _editOrdSyncTimer=null;
    _flushEditOrdineToStorage({ refreshOrdList:false });
  }, _EDIT_ORD_SYNC_MS);
}

function modificaOrdineDaTab(gi){
  var ord=ordini[gi];
  if(!ord){ console.error('[LOCK] modificaOrdineDaTab — ordine non trovato a indice:', gi); return; }
  var oid = ord.id;
  // L'acquisizione lock deve avvenire sempre all'apertura ordine:
  // usiamo solo la transaction di ordAcquireOrderLock (first-come), senza pre-check separato.
  ordAcquireOrderLock(oid, { force: false }, function(ok){
    if(!ok){
      showToastGen('orange','🔒 Ordine appena preso da un altro utente — riprova tra poco');
      return;
    }
    var gi2 = ordini.findIndex(function(o){ return o && o.id === oid; });
    if(gi2 < 0){
      ordUnlock(oid);
      return;
    }
    _editOrdIdx = gi2;
    _editOrdItems = JSON.parse(JSON.stringify(ordini[gi2].items || []));
    renderEditOrdine();
    document.getElementById('edit-ord-overlay').style.display='flex';
    if(typeof ordRefreshLockUI === 'function') ordRefreshLockUI();
  });
}

function renderEditOrdine(){
  var ord=ordini[_editOrdIdx];
  if(!ord)return;
  var items=_editOrdItems;
  var tot=items.reduce(function(s,it){
    if(ordItemCongelato(it)) return s;
    return s+(ordItemLineUnitSelling(it)*parseFloat(it.qty||0));
  },0);
  var h='';
  h+='<div style="font-size:15px;font-weight:900;color:#b794f4;margin-bottom:4px;">-- Modifica ordine'+(ord.numero?' #'+ord.numero:'')+'</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">'+esc(ord.nomeCliente)+' - '+ord.data+' '+ord.ora+'</div>';
  var st=(ord.storicoOperazioni&&ord.storicoOperazioni.length)?ord.storicoOperazioni.slice().reverse():[];
  h+='<div style="margin-bottom:12px;border:1px solid #333;border-radius:10px;background:#0f0f12;overflow:hidden;">';
  h+='<div style="padding:8px 10px;font-size:10px;font-weight:800;color:#888;letter-spacing:.4px;border-bottom:1px solid #2a2a2a;">Cronologia operazioni</div>';
  h+='<div style="max-height:min(200px,28vh);overflow-y:auto;padding:8px 10px;">';
  if(!st.length){
    h+='<div style="font-size:10px;color:#555;">Nessuna operazione registrata finora.</div>';
  } else {
    st.forEach(function(row){
      h+='<div style="font-size:10px;line-height:1.45;color:#c4c4c8;margin-bottom:6px;border-left:2px solid #3182ce55;padding-left:8px;">';
      h+='<span style="color:#63b3ed;font-weight:700;">'+esc(row.label||'')+'</span> — '+esc(row.msg||'');
      h+='</div>';
    });
  }
  h+='</div></div>';
  ordineIndiciItemsDisplay(items).forEach(function(idx){
    var it=items[idx];
    var isFz=ordItemCongelato(it);
    var p=ordItemLineUnitSelling(it);
    var q=parseFloat(it.qty||0);
    var sub=isFz?'0.00':(p*q).toFixed(2);
    var isSc=it.scampolo||false;
    var isFR=it.fineRotolo||false;
    h+='<div style="padding:8px;border:1px solid '+(isFz?'#3d3d48':'#2a2a2a')+';border-radius:8px;margin-bottom:6px;background:'+(isFz?'#1a1a20':'#1a1a1a')+';opacity:'+(isFz?'0.92':'1')+';">';
    if(isFz) h+='<div style="font-size:9px;font-weight:800;color:#9ca3af;margin-bottom:6px;letter-spacing:.3px;">Rimosso dal banco</div>';
    h+='<div style="font-size:12px;font-weight:700;color:'+(isFz?'#a8a8b0':'var(--text)')+';margin-bottom:4px;">'+esc(it.desc)+'</div>';
    h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">';
    if(!isFz){
      h+='<button onclick="_editOrdDelta('+idx+',-1)" style="width:28px;height:28px;border-radius:6px;border:none;background:#2a2a2a;color:var(--text);font-size:16px;font-weight:bold;cursor:pointer;">-</button>';
      h+='<span style="min-width:32px;text-align:center;font-size:14px;font-weight:900;color:var(--accent);">'+q+'</span>';
      h+='<button onclick="_editOrdDelta('+idx+',1)" style="width:28px;height:28px;border-radius:6px;border:none;background:#2a2a2a;color:var(--text);font-size:16px;font-weight:bold;cursor:pointer;">+</button>';
    } else {
      h+='<span style="min-width:32px;text-align:center;font-size:13px;color:#888;">'+q+' '+esc(it.unit||'pz')+'</span>';
    }
    h+='<span style="font-size:10px;color:#555;">-</span>';
    h+='<input type="text" value="'+esc(it.prezzoUnit)+'" style="width:60px;padding:4px 6px;border:1px solid #333;border-radius:5px;background:#111;color:var(--accent);font-size:12px;font-weight:700;text-align:right;" onchange="_editOrdPrezzo('+idx+',this.value)">';
    h+='<span id="edit-ord-sub-'+idx+'" style="font-size:13px;font-weight:900;color:'+(isFz?'#666':'var(--accent)')+';margin-left:auto;">'+(isFz?'—':'-'+sub)+'</span>';
    h+='</div>';
    if(!isFz && itemUsesPrezzoPerBaseUm(it.unit)){
      var bdEd=itemBaseUmScontoDisplay(it);
      h+='<div class="ct-pb-inline" style="margin:6px 0 4px;">';
      h+='<span class="ct-pb-tag">Base</span>';
      h+='<input type="text" class="ct-pb-inp" inputmode="decimal" value="'+esc(it._prezzoUnitaBase||'')+'" placeholder="—" ';
      h+='oninput="_editOrdPrezzoUnitaBase('+idx+',this.value)" onclick="event.stopPropagation();this.select()" />';
      if(bdEd && bdEd.hasSc){
        h+='<span class="ct-pb-disc">';
        h+='<span class="ct-pb-struck">€'+formatPrezzoUnitDisplay(bdEd.b0)+'</span>';
        h+='<span class="ct-pb-final">€'+formatPrezzoUnitDisplay(bdEd.b1)+'</span>';
        h+='<span class="ct-pb-sav">-€'+formatPrezzoUnitDisplay(bdEd.savPerBase)+'</span>';
        h+='</span>';
      }
      h+='</div>';
    }
    if(!isFz){
      var scLabel=isSc?'--':isFR?'-':'--';
      var scBrd=isSc?'var(--accent)':isFR?'#f6ad55':'#2a2a2a';
      var scBg=isSc?'var(--accent)':isFR?'rgba(246,173,85,.15)':'transparent';
      var scClr=isSc?'#111':isFR?'#f6ad55':'#555';
      h+='<div style="display:flex;gap:5px;align-items:center;">';
      h+='<button onclick="_editOrdCycleScampolo('+idx+')" style="padding:3px 8px;border-radius:5px;border:1px solid '+scBrd+';background:'+scBg+';color:'+scClr+';font-size:10px;cursor:pointer;">'+scLabel+'</button>';
      if(isSc||isFR){
        h+='<input type="number" min="0" max="100" value="'+(it._scontoApplicato||'')+'" placeholder="%" style="width:40px;padding:3px 4px;border:1px solid #333;border-radius:5px;background:#111;color:#68d391;font-size:11px;font-weight:700;text-align:center;" onchange="_editOrdSconto('+idx+',this.value)">%';
        if(it._prezzoOriginale)h+='<span style="font-size:9px;color:#555;text-decoration:line-through;">-'+esc(it._prezzoOriginale)+'</span>';
      }
      h+='<button onclick="_editOrdRemove('+idx+')" style="margin-left:auto;padding:3px 6px;border-radius:5px;border:none;background:transparent;color:#e53e3e;font-size:12px;cursor:pointer;">-</button>';
      h+='</div>';
    }
    h+='</div>';
  });
  h+='<div style="display:flex;justify-content:space-between;margin-top:10px;padding:8px;background:#111;border-radius:8px;border:1px solid var(--accent)33;">';
  h+='<span style="font-size:14px;font-weight:700;color:var(--muted);">TOTALE</span>';
  h+='<span id="edit-ord-totale" style="font-size:18px;font-weight:900;color:var(--accent);">- '+tot.toFixed(2)+'</span></div>';
  h+='<div style="display:flex;gap:8px;margin-top:12px;">';
  h+='<button onclick="chiudiEditOrdine()" style="flex:1;padding:12px;border-radius:10px;border:none;background:#805ad5;color:#fff;font-size:14px;font-weight:900;cursor:pointer;">Chiudi</button></div>';
  h+='<div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:center;">Le modifiche si salvano in automatico sul carrello.</div>';
  document.getElementById('edit-ord-body').innerHTML=h;
}
function _editOrdDelta(idx,d){
  if(ordItemCongelato(_editOrdItems[idx])) return;
  var ord=ordini[_editOrdIdx];
  var it=_editOrdItems[idx];
  var oldQ=parseFloat(it.qty||0);
  _editOrdItems[idx].qty=Math.max(0.5,Math.round((parseFloat(_editOrdItems[idx].qty||0)+d)*10)/10);
  if(ord&&Math.abs(oldQ-_editOrdItems[idx].qty)>0.001){
    ordineAppendStorico(ord,'Quantità '+((it.desc)||'?')+': '+oldQ+' → '+_editOrdItems[idx].qty+' '+(it.unit||'pz'));
  }
  renderEditOrdine();_scheduleEditOrdineSync();
}
function _editOrdPrezzo(idx,val){
  var ord=ordini[_editOrdIdx];
  var it=_editOrdItems[idx];
  var oldP=String(it.prezzoUnit||'');
  _editOrdItems[idx].prezzoUnit=val;
  if(itemUsesPrezzoPerBaseUm(_editOrdItems[idx].unit)) itemSyncPrezzoUnitaBaseDaPrezzoRiga(_editOrdItems[idx]);
  if(ord&&oldP!==String(val)){
    ordineAppendStorico(ord,'Prezzo '+((it.desc)||'?')+': €'+oldP+' → €'+val);
  }
  renderEditOrdine();_scheduleEditOrdineSync();
}

function _editOrdRefreshTotaleOnly(){
  if(_editOrdIdx===null||_editOrdIdx<0||!_editOrdItems) return;
  var totEl=document.getElementById('edit-ord-totale');
  if(!totEl) return;
  var tot=_editOrdItems.reduce(function(s,it){
    if(ordItemCongelato(it)) return s;
    return s+(ordItemLineUnitSelling(it)*parseFloat(it.qty||0));
  },0);
  totEl.textContent='- '+tot.toFixed(2);
}

function _editOrdPrezzoUnitaBase(idx,val){
  if(_editOrdIdx===null||_editOrdIdx<0) return;
  var it=_editOrdItems[idx];
  if(!it||ordItemCongelato(it)) return;
  it._prezzoUnitaBase=val;
  if(parsePriceIT(val)>0){
    itemApplyPrezzoUnitaBase(it);
  }
  var subEl=document.getElementById('edit-ord-sub-'+idx);
  if(subEl&&!ordItemCongelato(it)){
    var p=ordItemLineUnitSelling(it);
    var q=parseFloat(it.qty||0);
    subEl.textContent='-'+(p*q).toFixed(2);
  }
  _editOrdRefreshTotaleOnly();
  _scheduleEditOrdineSync();
}
function _editOrdRemove(idx){
  var ord=ordini[_editOrdIdx];
  var ddesc=(_editOrdItems[idx]&&_editOrdItems[idx].desc)||'?';
  _editOrdItems.splice(idx,1);
  if(ord) ordineAppendStorico(ord,'Rimosso dalla modifica: '+ddesc);
  renderEditOrdine();_scheduleEditOrdineSync();
}
function _editOrdCycleScampolo(idx){
  var it=_editOrdItems[idx];
  if(ordItemCongelato(it)) return;
  var ord=ordini[_editOrdIdx];
  var prevLab=typeof _cartLabelModalita==='function'?_cartLabelModalita(it):'listino';
  if(!it.scampolo&&!it.fineRotolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)){
      showToastGen('orange','Listino non disponibile per questo articolo');
      return;
    }
    it.scampolo=true;it.fineRotolo=false;it._scontoTipo='scampolo';
    if(!it._scontoApplicato)it._scontoApplicato=SCONTO_SCAMPOLO_DEFAULT_PCT;
    _applicaScontoScampolo(it);
  } else if(it.scampolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)) return;
    it.scampolo=false;it.fineRotolo=true;it._scontoTipo='rotolo';
    it._scontoApplicato = SCONTO_ROTOLO_DEFAULT_PCT;
    _applicaScontoScampolo(it);
  } else {
    it.scampolo=false;it.fineRotolo=false;
    if(it._prezzoOriginale){it.prezzoUnit=it._prezzoOriginale;delete it._prezzoOriginale;}
    delete it._scontoTipo;delete it._scontoApplicato;
  }
  if(ord){
    var nl=typeof _cartLabelModalita==='function'?_cartLabelModalita(it):'listino';
    if(prevLab!==nl){
      var desc=(it.desc||'?');
      if(nl==='SCA') ordineAppendStorico(ord,'Modalità Scampolo (SCA): '+desc);
      else if(nl==='ROT') ordineAppendStorico(ord,'Modalità Rotolo (ROT): '+desc);
      else if(nl==='Scaglioni') ordineAppendStorico(ord,'Modalità scaglioni: '+desc);
      else ordineAppendStorico(ord,'Prezzo listino: '+desc);
    }
  }
  renderEditOrdine();
  _scheduleEditOrdineSync();
}
function _editOrdSconto(idx,val){
  var it=_editOrdItems[idx];
  if(ordItemCongelato(it)) return;
  var ord=ordini[_editOrdIdx];
  var oldSc=it._scontoApplicato;
  it._scontoApplicato=parseFloat(val)||0;
  if(!ensurePrezzoOriginaleDaListino(it, true)){
    showToastGen('orange','Listino non disponibile');
    renderEditOrdine();
    return;
  }
  _applicaScontoScampolo(it);
  if(ord&&(it.scampolo||it.fineRotolo||it._scaglionato)&&(oldSc!==it._scontoApplicato)){
    var lab=typeof _cartLabelModalita==='function'?_cartLabelModalita(it):'';
    ordineAppendStorico(ord,'Sconto '+((it.desc)||'?')+': '+(oldSc!=null?oldSc+'%':'—')+' → '+it._scontoApplicato+'% ('+lab+')');
  }
  renderEditOrdine();
  _scheduleEditOrdineSync();
}
function chiudiEditOrdine(){
  clearTimeout(_editOrdSyncTimer);
  _editOrdSyncTimer=null;
  if(_editOrdIdx !== null && ordini[_editOrdIdx]){
    _flushEditOrdineToStorage({ refreshOrdList:true });
    console.log('[LOCK] chiudiEditOrdine — rilascio lock su ordine:', ordini[_editOrdIdx].id);
    ordUnlock(ordini[_editOrdIdx].id);
  }
  document.getElementById('edit-ord-overlay').style.display='none';
  _editOrdIdx=null;
  _editOrdItems=null;
  if(typeof feedbackSend==='function') feedbackSend();
}
