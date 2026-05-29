// ordini.storico.js — storico ordini archiviati (leggero: paginazione, filtri, ricerca, dettaglio)

var _storicoOpen=false;
var _storicoSearch='';
var _storicoShown=20;
var STORICO_PAGE=20;

// Riepilogo incassi per giorno nello storico (solo proprietari): tap sull'etichetta giorno
// → mostra/nasconde "(Tot. € …)". Stato in memoria, sopravvive a re-render.
var _storicoDaySumExpanded = {};
function _storicoOwnerCanSeeTotali(){
  return typeof _currentUser !== 'undefined' && !!_currentUser && _currentUser.ruolo === 'proprietario';
}
function _storicoFormatEurIT(n){
  var v = Number(n||0);
  try { return v.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  catch(e){ return v.toFixed(2); }
}
function storicoToggleDaySum(el, dayKey, ev){
  if(ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if(!_storicoOwnerCanSeeTotali()) return;
  if(!el || !el.parentNode) return;
  var sum = el.parentNode.querySelector('.ord-storico-day-sum');
  if(!sum) return;
  var willShow = !sum.classList.contains('show');
  if(willShow) sum.classList.add('show'); else sum.classList.remove('show');
  if(dayKey) _storicoDaySumExpanded[dayKey] = willShow;
}

function storicoSetMainSearchVisible(visible){
  var wrap=document.getElementById('ord-main-search-wrap');
  if(!wrap){
    var s=document.getElementById('ord-search');
    wrap=s&&s.parentNode?s.parentNode:null;
  }
  if(wrap)wrap.style.display=visible?'':'none';
}

function toggleStoricoOrdini(){
  _storicoOpen=!_storicoOpen;
  var btn=document.getElementById('ord-f-storico');
  if(btn){
    btn.style.background=_storicoOpen?'#805ad533':'transparent';
    btn.style.borderColor=_storicoOpen?'#805ad5':'#333';
  }
  var listEl=document.getElementById('ord-list');
  if(_storicoOpen){
    if(typeof _daOrdView!=='undefined'&&_daOrdView){
      _daOrdView=false;
      var dbtn=document.getElementById('ord-f-daordinare');
      if(dbtn){dbtn.style.background='transparent';dbtn.style.color='#fc8181';}
      var daoEl=document.getElementById('ord-daordinare-view');
      if(daoEl)daoEl.style.display='none';
    }
    if(typeof _cestinoOrdOpen!=='undefined'&&_cestinoOrdOpen){
      _cestinoOrdOpen=false;
      var cb=document.getElementById('ord-f-cestino');
      if(cb){cb.style.background='transparent';cb.style.borderColor='#222';cb.style.color='#444';}
      var cv=document.getElementById('ord-cestino-view');
      if(cv)cv.style.display='none';
    }
    _storicoShown=STORICO_PAGE;
    storicoSetMainSearchVisible(false);
    renderStoricoOrdini();
    if(listEl)listEl.style.display='none';
  } else {
    var sv=document.getElementById('ord-storico-view');
    if(sv)sv.style.display='none';
    if(listEl)listEl.style.display='';
    storicoSetMainSearchVisible(true);
    storicoChiudiDettaglio();
  }
}

function storicoOnSearch(val){
  _storicoSearch=(val||'').trim().toLowerCase();
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

function _storicoDateObj(ord){
  var raw=ord&&(ord.completatoAtISO||ord.createdAt||ord.dataISO||'');
  if(raw){
    var d=new Date(raw);
    if(!isNaN(d.getTime()))return d;
  }
  var data=String(ord&&ord.data||'').trim();
  var m=data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){
    var year=m[3].length===2?('20'+m[3]):m[3];
    var d2=new Date(Number(year),Number(m[2])-1,Number(m[1]));
    if(!isNaN(d2.getTime()))return d2;
  }
  return null;
}

function _storicoDayKey(ord){
  var d=_storicoDateObj(ord);
  return d?d.toISOString().slice(0,10):'senza-data';
}

function _storicoDayLabel(key){
  if(key==='senza-data')return 'Senza data';
  var d=new Date(key+'T00:00:00');
  if(isNaN(d.getTime()))return key;
  var oggi=new Date();oggi.setHours(0,0,0,0);
  var ieri=new Date(oggi);ieri.setDate(ieri.getDate()-1);
  if(d.getTime()===oggi.getTime())return 'Oggi';
  if(d.getTime()===ieri.getTime())return 'Ieri';
  return d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function _storicoMatchSearch(ord,q){
  if(!q)return true;
  var doc=!!(ord&&(ord.tipo==='fattura'||ord.fatturaRichiesta))?'fattura':'ordine';
  var hay=((ord.nomeCliente||'')+' '+(ord.numero!=null?String(ord.numero):'')+' '+doc).toLowerCase();
  (ord.items||[]).forEach(function(it){
    hay+=' '+(it.desc||'')+' '+(it.codM||'')+' '+(it.codF||'')+' '+(it.nota||'');
  });
  return hay.toLowerCase().indexOf(q)>=0;
}

function storicoGetFiltered(){
  var arch=typeof getOrdiniArchivio==='function'?getOrdiniArchivio():(lsGet(ORDK_ARCH)||[]);
  if(!arch||!arch.length)return[];
  var q=_storicoSearch;
  return _storicoSortNewestFirst(arch.filter(function(ord){
    return _storicoMatchSearch(ord,q);
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
  h+='</div>';

  h+='<div class="ord-storico-head">📂 Storico — '+total+' ordini'+(total!==arch.length?' (filtrati su '+arch.length+')':'')+'</div>';

  if(!arch.length){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine archiviato.<br><small>Gli ordini completati da 7+ giorni vengono archiviati automaticamente.</small></div>';
    return;
  }
  if(!total){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine corrisponde ai filtri.</div>';
    return;
  }

  var lastDay=null;
  var _stCanSeeTot = _storicoOwnerCanSeeTotali();
  slice.forEach(function(ord){
    var dayKey=_storicoDayKey(ord);
    if(dayKey!==lastDay){
      var groupCount=filtered.filter(function(x){return _storicoDayKey(x)===dayKey;}).length;
      if(_stCanSeeTot){
        // Somma totale del giorno sull'intero filtered (non solo lo slice paginato),
        // così il riepilogo è completo anche prima di "Carica altri".
        var _dayTot = filtered.reduce(function(s,x){
          if(_storicoDayKey(x)!==dayKey) return s;
          return s + (typeof ordTotaleSenzaCongelati==='function' ? ordTotaleSenzaCongelati(x) : (parseFloat(x&&x.totale||0)||0));
        }, 0);
        var _dkAttr = String(dayKey).replace(/'/g,"\\'");
        var _exp = !!_storicoDaySumExpanded[dayKey];
        h+='<div class="ord-storico-day-sep">';
        h+='<span class="ord-storico-day-label ord-storico-day-label--toggle" onclick="storicoToggleDaySum(this,\''+_dkAttr+'\',event)" title="Tap per mostrare/nascondere riepilogo incassi">'+esc(_storicoDayLabel(dayKey))+'</span>';
        h+='<span class="ord-storico-day-sum'+(_exp?' show':'')+'" data-day="'+esc(dayKey)+'">(Tot. €&nbsp;'+_storicoFormatEurIT(_dayTot)+')</span>';
        h+='<b>'+groupCount+'</b>';
        h+='</div>';
      } else {
        h+='<div class="ord-storico-day-sep"><span>'+esc(_storicoDayLabel(dayKey))+'</span><b>'+groupCount+'</b></div>';
      }
      lastDay=dayKey;
    }
    var oid=ord.id!=null?String(ord.id):'';
    var sid=oid.replace(/"/g,'&quot;');
    var nArt=(ord.items||[]).length;
    var tot=0;
    (ord.items||[]).forEach(function(it){
      if(!ordItemCongelato(it)) tot+=parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);
    });
    var isFattura=!!(ord.tipo==='fattura'||ord.fatturaRichiesta);
    var previewItems=(ord.items||[]).filter(function(it){return !ordItemCongelato(it);}).slice().reverse().slice(0,4);
    h+='<div class="ord-storico-card" role="button" tabindex="0" data-storico-id="'+sid+'" onclick="storicoApriDettaglioFromEl(this)">';
    h+='<div class="ord-storico-card-hd">';
    h+='<div class="ord-storico-card-left">';
    h+='<span class="ord-storico-card-cliente">'+esc(ord.nomeCliente||'—')+'</span>';
    h+='<span class="ord-storico-doc-badge '+(isFattura?'ord-storico-doc-badge--fat':'ord-storico-doc-badge--ord')+'">'+(isFattura?'FATTURA':'ORDINE')+'</span>';
    h+='</div>';
    h+='<div class="ord-storico-card-right">';
    h+='<span class="ord-storico-card-when">'+esc(ord.data||'')+' '+esc(ord.ora||'')+'</span>';
    h+='<span class="ord-storico-card-tot">€'+tot.toFixed(2)+'</span>';
    h+='</div>';
    h+='</div>';
    h+='<div class="ord-storico-card-items">';
    if(previewItems.length){
      previewItems.forEach(function(it){
        var q=parseFloat(it.qty||0);
        h+='<div class="ord-storico-item-line">';
        h+='<span class="ord-storico-item-name">'+esc(it.desc||'—')+'</span>';
        h+='<span class="ord-storico-item-qty">'+esc((typeof itemFormatQtyDisplay==='function'?itemFormatQtyDisplay(q,it.unit):String(q)))+' '+esc(it.unit||'pz')+'</span>';
        h+='</div>';
      });
      if(nArt>previewItems.length) h+='<div class="ord-storico-more-items">+'+(nArt-previewItems.length)+' altri articoli</div>';
    } else {
      h+='<div class="ord-storico-more-items">Nessun articolo attivo</div>';
    }
    h+='</div>';
    h+='<div class="ord-storico-card-foot"><span>'+nArt+' art.</span><span>Tap per riepilogo</span></div>';
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
  var indici = (typeof ordineIndiciOrdineDisplayCronologico === 'function')
    ? ordineIndiciOrdineDisplayCronologico(ord)
    : (function(){
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
    h+='<div class="ord-item-name"><span class="ct-card-num" aria-hidden="true">'+cartItemInsertNum(it, ii)+'.</span> '+esc(it.desc||'—')+'</div>';
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
