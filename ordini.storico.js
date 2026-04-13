// ordini.storico.js — storico ordini archiviati (leggero: paginazione, filtri, ricerca, dettaglio)

var _storicoOpen=false;
var _storicoSearch='';
var _storicoFornHex=null;
var _storicoShown=20;
var STORICO_PAGE=20;

function toggleStoricoOrdini(){
  _storicoOpen=!_storicoOpen;
  var btn=document.getElementById('ord-f-storico');
  if(btn){
    btn.style.background=_storicoOpen?'#805ad533':'transparent';
    btn.style.borderColor=_storicoOpen?'#805ad5':'#333';
  }
  var listEl=document.getElementById('ord-list');
  if(_storicoOpen){
    _storicoShown=STORICO_PAGE;
    renderStoricoOrdini();
    if(listEl)listEl.style.display='none';
  } else {
    var sv=document.getElementById('ord-storico-view');
    if(sv)sv.style.display='none';
    if(listEl)listEl.style.display='';
    storicoChiudiDettaglio();
  }
}

function storicoOnSearch(val){
  _storicoSearch=(val||'').trim().toLowerCase();
  _storicoShown=STORICO_PAGE;
  renderStoricoOrdini();
}

function storicoSetFornitore(hex){
  _storicoFornHex = (_storicoFornHex === hex) ? null : hex;
  _storicoShown=STORICO_PAGE;
  renderStoricoOrdini();
}

/** Reset solo filtro fornitore (la ricerca testuale resta). */
function storicoResetFornitore(){
  _storicoFornHex=null;
  _storicoShown=STORICO_PAGE;
  renderStoricoOrdini();
}

function storicoCaricaAltri(){
  _storicoShown+=STORICO_PAGE;
  renderStoricoOrdini();
}

function _storicoSortNewestFirst(arr){
  return arr.slice().sort(function(a,b){
    var ta=(a.completatoAtISO||a.createdAt||a.dataISO||'')+'';
    var tb=(b.completatoAtISO||b.createdAt||b.dataISO||'')+'';
    return tb.localeCompare(ta);
  });
}

function _storicoMatchSearch(ord,q){
  if(!q)return true;
  var hay=((ord.nomeCliente||'')+' '+(ord.numero!=null?String(ord.numero):'')).toLowerCase();
  (ord.items||[]).forEach(function(it){
    hay+=' '+(it.desc||'')+' '+(it.codM||'')+' '+(it.codF||'')+' '+(it.nota||'');
  });
  return hay.toLowerCase().indexOf(q)>=0;
}

function _storicoMatchFornitore(ord,hex){
  if(!hex)return true;
  var nomeSlot=typeof ctEtichettaFornitore==='function'?ctEtichettaFornitore(hex):'';
  var hit=false;
  (ord.items||[]).forEach(function(it){
    if(it._ordColore===hex)hit=true;
    if(nomeSlot&&it._ordFornitoreNome&&String(it._ordFornitoreNome).trim()===String(nomeSlot).trim())hit=true;
  });
  return hit;
}

function storicoGetFiltered(){
  var arch=typeof getOrdiniArchivio==='function'?getOrdiniArchivio():(lsGet(ORDK_ARCH)||[]);
  if(!arch||!arch.length)return[];
  var q=_storicoSearch;
  var hex=_storicoFornHex;
  return _storicoSortNewestFirst(arch.filter(function(ord){
    return _storicoMatchSearch(ord,q)&&_storicoMatchFornitore(ord,hex);
  }));
}

function renderStoricoOrdini(){
  var sv=document.getElementById('ord-storico-view');
  if(!sv){
    sv=document.createElement('div');
    sv.id='ord-storico-view';
    var listEl=document.getElementById('ord-list');
    if(listEl)listEl.parentNode.insertBefore(sv,listEl.nextSibling);
    else return;
  }
  sv.style.display='block';
  sv.className='ord-storico-view';

  var arch=typeof getOrdiniArchivio==='function'?getOrdiniArchivio():(lsGet(ORDK_ARCH)||[]);
  var filtered=storicoGetFiltered();
  var total=filtered.length;
  var slice=filtered.slice(0,_storicoShown);
  var hasMore=total>_storicoShown;

  var h='';
  h+='<div class="ord-storico-toolbar">';
  h+='<input type="search" id="ord-storico-search" class="ord-storico-search" placeholder="Cerca cliente o prodotto…" value="'+esc(_storicoSearch)+'" ';
  h+='oninput="storicoOnSearch(this.value)" autocomplete="off">';
  h+='<div class="ord-storico-forn-filt">';
  h+='<button type="button" class="ord-storico-f-tutti'+(!_storicoFornHex?' ord-storico-f--on':'')+'" onclick="storicoResetFornitore()">Tutti i fornitori</button>';
  if(typeof CT_FORN_CANON_HEX!=='undefined'&&typeof ctEtichettaFornitore==='function'){
    CT_FORN_CANON_HEX.forEach(function(col){
      var nm=ctEtichettaFornitore(col);
      var on=_storicoFornHex===col;
      h+='<button type="button" class="ord-storico-f-slot'+(on?' ord-storico-f--on':'')+'" style="'+(on?'border-color:'+col+';color:'+col+';background:'+col+'18':'')+'" onclick="storicoSetFornitore(\''+col+'\')">';
      h+='<span class="ord-storico-f-dot" style="background:'+col+'"></span>'+esc(nm);
      h+='</button>';
    });
  }
  h+='</div></div>';

  h+='<div class="ord-storico-head">📂 Storico — '+total+' ordini'+(total!==arch.length?' (filtrati su '+arch.length+')':'')+'</div>';

  if(!arch.length){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine archiviato.<br><small>Gli ordini completati da 7+ giorni vengono archiviati automaticamente.</small></div>';
    return;
  }
  if(!total){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine corrisponde ai filtri.</div>';
    return;
  }

  slice.forEach(function(ord){
    var oid=ord.id!=null?String(ord.id):'';
    var sid=oid.replace(/"/g,'&quot;');
    var nArt=(ord.items||[]).length;
    var tot=0;
    (ord.items||[]).forEach(function(it){
      if(!ordItemCongelato(it)) tot+=parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);
    });
    h+='<div class="ord-storico-card" role="button" tabindex="0" data-storico-id="'+sid+'" onclick="storicoApriDettaglioFromEl(this)">';
    h+='<div class="ord-storico-card-hd">';
    h+='<span class="ord-storico-card-cliente">'+esc(ord.nomeCliente||'—')+'</span>';
    h+='<span class="ord-storico-card-when">'+esc(ord.data||'')+' '+esc(ord.ora||'')+'</span>';
    h+='</div>';
    h+='<div class="ord-storico-card-sum">';
    h+='<span class="ord-storico-card-n">'+nArt+' art.</span>';
    h+='<span class="ord-storico-card-tot">€'+tot.toFixed(2)+'</span>';
    h+='</div>';
    h+='<div class="ord-storico-card-hint">Tap per riepilogo completo</div>';
    h+='</div>';
  });

  if(hasMore){
    h+='<div class="ord-storico-more-wrap">';
    h+='<button type="button" class="ord-storico-more" onclick="storicoCaricaAltri()">Carica altri ('+(total-_storicoShown)+' rimanenti)</button>';
    h+='</div>';
  }

  h+='<div class="ord-storico-clear-wrap">';
  h+='<button type="button" class="ord-storico-clear" onclick="clearStorico()">🗑️ Svuota storico</button>';
  h+='</div>';

  sv.innerHTML=h;
}

function storicoFindById(id){
  var arch=typeof getOrdiniArchivio==='function'?getOrdiniArchivio():(lsGet(ORDK_ARCH)||[]);
  for(var i=0;i<arch.length;i++){
    if(arch[i]&&String(arch[i].id)===String(id))return arch[i];
  }
  return null;
}

function storicoApriDettaglioFromEl(el){
  var id=el&&el.getAttribute&&el.getAttribute('data-storico-id');
  if(id!=null)storicoApriDettaglio(id);
}

function storicoChiudiDettaglio(){
  var m=document.getElementById('ord-storico-modal');
  if(m)m.remove();
}

function storicoApriDettaglio(ordId){
  var ord=storicoFindById(ordId);
  if(!ord)return;
  storicoChiudiDettaglio();
  var wrap=document.createElement('div');
  wrap.id='ord-storico-modal';
  wrap.className='ord-storico-modal';
  wrap.innerHTML='<div class="ord-storico-modal-bd" onclick="storicoChiudiDettaglio()"></div>'+
    '<div class="ord-storico-modal-panel" onclick="event.stopPropagation()">'+
    '<div class="ord-storico-modal-top">'+
    '<span class="ord-storico-modal-title">'+esc(ord.nomeCliente||'—')+'</span>'+
    '<button type="button" class="ord-storico-modal-x" onclick="storicoChiudiDettaglio()">✕</button></div>'+
    '<div class="ord-storico-modal-meta">'+esc(ord.data||'')+' '+esc(ord.ora||'')+
    (ord.numero!=null?' · #'+esc(String(ord.numero)):'')+'</div>'+
    storicoHtmlDettaglioGriglia(ord)+
    '</div>';
  document.body.appendChild(wrap);
}

/** Riepilogo righe con prezzi (stile simile alla tab ordini: totali grandi / verde). */
function storicoHtmlDettaglioGriglia(ord){
  var indici=(function(){
    if(typeof ordineIndiciOrdineDisplay==='function'){
      var all=ordineIndiciOrdineDisplay(ord);
      var attivi=all.filter(function(ii){ return !ordItemCongelato((ord.items||[])[ii]); }).reverse();
      var cong=all.filter(function(ii){ return ordItemCongelato((ord.items||[])[ii]); });
      return attivi.concat(cong);
    }
    var out=[];
    for(var j=0;j<(ord.items||[]).length;j++)out.push(j);
    return out;
  })();

  var h='<div class="ord-items-wrap ord-storico-detail-grid">';
  h+='<div class="ord-grid ord-grid-head">';
  h+='<div class="ord-gh">Prodotto</div><div class="ord-gh ord-gh-c">Qtà</div>';
  h+='<div class="ord-gh ord-gh-c">Prezzo</div><div class="ord-gh ord-gh-c">Tot</div></div>';

  indici.forEach(function(ii,stripe){
    var it=ord.items[ii];
    var isFz=ordItemCongelato(it);
    var pu=parsePriceIT(it.prezzoUnit);
    var q=parseFloat(it.qty||0);
    var sub=isFz?0:(pu*q);

    var prezOrigNum=0;
    var prezFinNum=pu;
    var hasSconto=false;
    var scOn=it.scampolo||it.fineRotolo||it._scaglionato||false;
    var scagAtt=it._scaglioneAttivo||null;
    if(scagAtt&&it._prezzoBase){
      prezOrigNum=parsePriceIT(it._prezzoBase);
      hasSconto=prezOrigNum>prezFinNum+0.005;
    } else if((scOn||(it._scontoApplicato&&it._scontoApplicato>0))&&it._prezzoOriginale){
      prezOrigNum=parsePriceIT(it._prezzoOriginale);
      hasSconto=prezOrigNum>prezFinNum+0.005;
    }

    h+='<div class="ord-grid ord-grid-row'+(stripe%2===0?' ord-grid-even':' ord-grid-odd')+(isFz?' ord-grid-row--congelato':'')+'">';
    h+='<div class="ord-gc-desc">';
    h+='<div class="ord-item-name">'+esc(it.desc||'—')+'</div>';
    if(isFz)h+='<div class="ord-congelato-badge">Rimosso dal banco</div>';
    h+='<div class="ord-item-codes-line">';
    if(it.codM)h+='<span class="ord-code-mag">'+esc(it.codM)+'</span>';
    h+='<span class="ord-code-forn"><span class="ord-code-forn-lbl">f.</span> '+esc(it.codF||'—')+'</span>';
    h+='</div>';
    if(it.nota)h+='<div class="ord-item-nota">📝 '+esc(it.nota)+'</div>';
    if(it.daOrdinare)h+='<div class="ord-item-daord">🚚 DA ORDINARE</div>';
    h+='</div>';
    h+='<div class="ord-gc-qty">'+q+' <span class="ord-unit">'+esc(it.unit||'pz')+'</span></div>';
    h+='<div class="ord-gc-price">';
    if(isFz){
      h+='<span style="color:#888;">€'+formatPrezzoUnitDisplay(pu)+'</span>';
    } else if(hasSconto&&typeof htmlPrezzoUnitScontoRiga==='function'){
      h+=htmlPrezzoUnitScontoRiga(prezOrigNum,pu);
    } else {
      h+='<span class="ct-prz-single">€'+formatPrezzoUnitDisplay(pu)+'</span>';
    }
    h+='</div>';
    h+='<div class="ord-gc-sub">';
    if(isFz){
      h+='<span style="font-size:12px;color:#666;font-weight:700;">—</span>';
    } else if(hasSconto&&typeof htmlTotaleScontoRiga==='function'){
      h+=htmlTotaleScontoRiga(prezOrigNum*q,sub);
    } else {
      h+='€'+sub.toFixed(2);
    }
    h+='</div></div>';
  });

  var totOrd=typeof ordTotaleSenzaCongelati==='function'?ordTotaleSenzaCongelati(ord):0;
  h+='<div class="ord-storico-detail-footer">';
  h+='<span>Totale ordine</span><span class="ord-storico-detail-tot">€'+totOrd.toFixed(2)+'</span>';
  h+='</div></div>';
  return h;
}

function clearStorico(){
  showConfirm('Eliminare tutto lo storico archiviato?',function(){
    ordiniArchivio=[];
    lsSet(ORDK_ARCH,[]);
    _storicoShown=STORICO_PAGE;
    renderStoricoOrdini();
    showToastGen('purple','Storico svuotato');
  });
}
