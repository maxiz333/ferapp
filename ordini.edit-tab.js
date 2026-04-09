// ordini.edit-tab.js - estratto da ordini.js

// --- MODIFICA ORDINE DAL TAB ORDINI ---------------------------
var _editOrdIdx=null;
var _editOrdItems=null;

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
  var tot=items.reduce(function(s,it){return s+(ordItemLineUnitSelling(it)*parseFloat(it.qty||0));},0);
  var h='';
  h+='<div style="font-size:15px;font-weight:900;color:#b794f4;margin-bottom:4px;">-- Modifica ordine'+(ord.numero?' #'+ord.numero:'')+'</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">'+esc(ord.nomeCliente)+' - '+ord.data+' '+ord.ora+'</div>';
  items.forEach(function(it,idx){
    var p=ordItemLineUnitSelling(it);
    var q=parseFloat(it.qty||0);
    var sub=(p*q).toFixed(2);
    var isSc=it.scampolo||false;
    var isFR=it.fineRotolo||false;
    h+='<div style="padding:8px;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:6px;background:#1a1a1a;">';
    h+='<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">'+esc(it.desc)+'</div>';
    h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">';
    h+='<button onclick="_editOrdDelta('+idx+',-1)" style="width:28px;height:28px;border-radius:6px;border:none;background:#2a2a2a;color:var(--text);font-size:16px;font-weight:bold;cursor:pointer;">-</button>';
    h+='<span style="min-width:32px;text-align:center;font-size:14px;font-weight:900;color:var(--accent);">'+q+'</span>';
    h+='<button onclick="_editOrdDelta('+idx+',1)" style="width:28px;height:28px;border-radius:6px;border:none;background:#2a2a2a;color:var(--text);font-size:16px;font-weight:bold;cursor:pointer;">+</button>';
    h+='<span style="font-size:10px;color:#555;">-</span>';
    h+='<input type="text" value="'+esc(it.prezzoUnit)+'" style="width:60px;padding:4px 6px;border:1px solid #333;border-radius:5px;background:#111;color:var(--accent);font-size:12px;font-weight:700;text-align:right;" onchange="_editOrdPrezzo('+idx+',this.value)">';
    h+='<span style="font-size:13px;font-weight:900;color:var(--accent);margin-left:auto;">-'+sub+'</span>';
    h+='</div>';
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
    h+='</div></div>';
  });
  h+='<div style="display:flex;justify-content:space-between;margin-top:10px;padding:8px;background:#111;border-radius:8px;border:1px solid var(--accent)33;">';
  h+='<span style="font-size:14px;font-weight:700;color:var(--muted);">TOTALE</span>';
  h+='<span style="font-size:18px;font-weight:900;color:var(--accent);">- '+tot.toFixed(2)+'</span></div>';
  h+='<div style="display:flex;gap:8px;margin-top:12px;">';
  h+='<button onclick="salvaEditOrdine()" style="flex:1;padding:12px;border-radius:10px;border:none;background:#805ad5;color:#fff;font-size:14px;font-weight:900;cursor:pointer;">- AGGIORNA</button>';
  h+='<button onclick="chiudiEditOrdine()" style="padding:12px 16px;border-radius:10px;border:1px solid #444;background:transparent;color:#888;font-size:13px;cursor:pointer;">-</button></div>';
  document.getElementById('edit-ord-body').innerHTML=h;
}
function _editOrdDelta(idx,d){_editOrdItems[idx].qty=Math.max(0.5,Math.round((parseFloat(_editOrdItems[idx].qty||0)+d)*10)/10);renderEditOrdine();}
function _editOrdPrezzo(idx,val){_editOrdItems[idx].prezzoUnit=val;renderEditOrdine();}
function _editOrdRemove(idx){_editOrdItems.splice(idx,1);renderEditOrdine();}
function _editOrdCycleScampolo(idx){
  var it=_editOrdItems[idx];
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
  renderEditOrdine();
}
function _editOrdSconto(idx,val){
  var it=_editOrdItems[idx];
  it._scontoApplicato=parseFloat(val)||0;
  if(!ensurePrezzoOriginaleDaListino(it, true)){
    showToastGen('orange','Listino non disponibile');
    renderEditOrdine();
    return;
  }
  _applicaScontoScampolo(it);
  renderEditOrdine();
}
function salvaEditOrdine(){
  var ord=ordini[_editOrdIdx];
  if(!ord){ console.error('[LOCK] salvaEditOrdine — nessun ordine a indice:', _editOrdIdx); return; }
  ord.items=JSON.parse(JSON.stringify(_editOrdItems));
  var tot=_editOrdItems.reduce(function(s,it){return s+(ordItemLineUnitSelling(it)*parseFloat(it.qty||0));},0);
  ord.totale=tot.toFixed(2);
  ord.modificato=true;ord.modificatoAt=new Date().toLocaleString('it-IT');ord.modificatoAtISO=new Date().toISOString();
  saveOrdini();
  var linkedCart=carrelli.find(function(c){return c.ordId===ord.id;});
  if(!linkedCart && ord.stato==='bozza'){
    linkedCart=carrelli.find(function(c){return c.bozzaOrdId===ord.id;});
  }
  if(linkedCart){
    console.log('[LOCK] salvaEditOrdine — sync prezzi su carrello collegato:', linkedCart.id);
    linkedCart.items=JSON.parse(JSON.stringify(_editOrdItems));
    saveCarrelli();
  }
  console.log('[LOCK] salvaEditOrdine — rilascio lock su ordine:', ord.id);
  ordUnlock(ord.id);
  chiudiEditOrdine();feedbackSend();renderOrdini();
  showToastGen('purple','✅ Ordine #'+(ord.numero||'')+' aggiornato!');
}
function chiudiEditOrdine(){
  if(_editOrdIdx !== null && ordini[_editOrdIdx]){
    console.log('[LOCK] chiudiEditOrdine — rilascio lock su ordine:', ordini[_editOrdIdx].id);
    ordUnlock(ordini[_editOrdIdx].id);
  }
  document.getElementById('edit-ord-overlay').style.display='none';
  _editOrdIdx=null;
  _editOrdItems=null;
}
