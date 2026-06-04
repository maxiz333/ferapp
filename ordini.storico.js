// ordini.storico.js — storico ordini archiviati (filtro settimanale, ricerca, dettaglio)

var _storicoOpen=false;
var _storicoSearch='';
var _storicoWeekdayFilter=null;
var _storicoWeeksAgo=0;
var _storicoWeekdayDropdown=null;
var _storicoBeyond6=false;
var _STORICO_WDAY_LABELS=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
var _storicoWdayDocClickBound=false;

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
  if(typeof ordSetStandardHeaderVisible==='function'){
    ordSetStandardHeaderVisible(!!visible);
    return;
  }
  var wrap=document.getElementById('ord-main-search-wrap');
  if(!wrap){
    var s=document.getElementById('ord-search');
    wrap=s&&s.parentNode?s.parentNode:null;
  }
  if(wrap)wrap.style.display=visible?'':'none';
}

function toggleStoricoOrdini(){
  var btn=document.getElementById('ord-f-storico');
  var listEl=document.getElementById('ord-list');
  if(_storicoOpen){
    _storicoOpen=false;
    if(btn){
      btn.style.background='transparent';
      btn.style.borderColor='#333';
    }
    var sv=document.getElementById('ord-storico-view');
    if(sv)sv.style.display='none';
    ordCloseSpecialViews();
  } else {
    ordCloseSpecialViews('storico');
    _storicoOpen=true;
    if(btn){
      btn.style.background='#805ad533';
      btn.style.borderColor='#805ad5';
    }
    _storicoBeyond6=false;
    _storicoInitWeekdayOnOpen();
    _storicoBindWdayDocClickOnce();
    renderStoricoOrdini();
    if(listEl)listEl.style.display='none';
  }
}

function storicoOnSearch(val){
  _storicoSearch=(val||'').trim().toLowerCase();
  renderStoricoOrdini();
}

function _storicoTodayWeekdayIdx(){
  var jsDay=new Date().getDay();
  return jsDay===0?null:jsDay;
}

function _storicoWeekdayTargetISO(weekdayIdx,weeksAgo){
  var today=new Date();
  today.setHours(0,0,0,0);
  var jsDay=today.getDay();
  var currentWeekday=jsDay===0?7:jsDay;
  var diff=weekdayIdx-currentWeekday-(7*(weeksAgo||0));
  var target=new Date(today);
  target.setDate(target.getDate()+diff);
  return target.getFullYear()+'-'+
    String(target.getMonth()+1).padStart(2,'0')+'-'+
    String(target.getDate()).padStart(2,'0');
}

function _storicoOlderCutoffISO(){
  var d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-42);
  return d.getFullYear()+'-'+
    String(d.getMonth()+1).padStart(2,'0')+'-'+
    String(d.getDate()).padStart(2,'0');
}

function _storicoGetFilterDateISO(ord){
  if(!ord)return '';
  if(ord.completatoAtISO){
    var s=String(ord.completatoAtISO).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  }
  if(ord.dataISO)return String(ord.dataISO).slice(0,10);
  if(ord.createdAt)return String(ord.createdAt).slice(0,10);
  var data=String(ord.data||'').trim();
  var m=data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){
    var year=m[3].length===2?('20'+m[3]):m[3];
    return year+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0');
  }
  return '';
}

function _storicoOrderWeekdayIdx(ord){
  var iso=_storicoGetFilterDateISO(ord);
  if(!iso)return null;
  var p=iso.split('-');
  if(p.length<3)return null;
  var d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  if(isNaN(d.getTime()))return null;
  var jsDay=d.getDay();
  return jsDay===0?null:jsDay;
}

function _storicoMatchWeekday(ord){
  if(_storicoBeyond6){
    if(_storicoWeekdayFilter==null)return false;
    var iso=_storicoGetFilterDateISO(ord);
    if(!iso)return false;
    if(_storicoOrderWeekdayIdx(ord)!==_storicoWeekdayFilter)return false;
    return iso<_storicoOlderCutoffISO();
  }
  if(_storicoWeekdayFilter==null)return true;
  var ordIso=_storicoGetFilterDateISO(ord);
  if(!ordIso)return false;
  return ordIso===_storicoWeekdayTargetISO(_storicoWeekdayFilter,_storicoWeeksAgo);
}

function storicoCloseWeekdayDropdown(){
  _storicoWeekdayDropdown=null;
  var dd=document.getElementById('ord-storico-wday-dropdown');
  if(!dd)return;
  dd.style.display='none';
  dd.classList.remove('ord-wday-dropdown--open');
}

function storicoOpenWeekdayDropdown(weekday){
  _storicoWeekdayDropdown=weekday;
  var dd=document.getElementById('ord-storico-wday-dropdown');
  var btn=document.getElementById('ord-storico-wday-'+weekday);
  if(!dd||!btn)return;
  var label=_STORICO_WDAY_LABELS[weekday]||'';
  var inner='';
  for(var w=1;w<=6;w++){
    var txt=w===1?(label+' scorso'):(w+' '+label+' fa');
    inner+='<button type="button" class="ord-wday-dropdown-pick" onclick="storicoPickWeekdayAgo('+w+')">'+esc(txt)+'</button>';
  }
  inner+='<button type="button" class="ord-wday-dropdown-pick" onclick="storicoPickWeekdayBeyond6()">Oltre 6 '+esc(label)+' fa</button>';
  dd.innerHTML=inner;
  var btnRect=btn.getBoundingClientRect();
  dd.style.display='block';
  dd.classList.add('ord-wday-dropdown--open');
  dd.style.position='fixed';
  dd.style.left=Math.round(btnRect.left)+'px';
  dd.style.top=Math.round(btnRect.bottom+4)+'px';
  dd.style.zIndex='10050';
}

function storicoPickWeekdayAgo(weeksAgo){
  var wd=_storicoWeekdayDropdown!=null?_storicoWeekdayDropdown:_storicoWeekdayFilter;
  if(wd==null)return;
  _storicoWeekdayFilter=wd;
  _storicoWeeksAgo=weeksAgo||0;
  _storicoBeyond6=false;
  storicoCloseWeekdayDropdown();
  storicoUpdateWeekdayButtonsUI();
  renderStoricoOrdini();
}

function storicoPickWeekdayBeyond6(){
  var wd=_storicoWeekdayDropdown!=null?_storicoWeekdayDropdown:_storicoWeekdayFilter;
  if(wd==null)return;
  _storicoWeekdayFilter=wd;
  _storicoBeyond6=true;
  _storicoWeeksAgo=0;
  storicoCloseWeekdayDropdown();
  storicoUpdateWeekdayButtonsUI();
  renderStoricoOrdini();
}

function storicoClickWeekday(weekday,ev){
  if(ev&&typeof ev.stopPropagation==='function')ev.stopPropagation();
  _storicoBeyond6=false;
  if(_storicoWeekdayFilter!==weekday){
    _storicoWeekdayFilter=weekday;
    _storicoWeeksAgo=0;
    storicoCloseWeekdayDropdown();
    storicoUpdateWeekdayButtonsUI();
    renderStoricoOrdini();
    return;
  }
  if(_storicoWeeksAgo>0||_storicoBeyond6){
    _storicoWeeksAgo=0;
    _storicoBeyond6=false;
    storicoCloseWeekdayDropdown();
    storicoUpdateWeekdayButtonsUI();
    renderStoricoOrdini();
    return;
  }
  var dd=document.getElementById('ord-storico-wday-dropdown');
  var ddOpen=dd&&(dd.style.display==='block'||dd.classList.contains('ord-wday-dropdown--open'));
  if(_storicoWeekdayDropdown===weekday&&ddOpen){
    storicoCloseWeekdayDropdown();
    return;
  }
  storicoOpenWeekdayDropdown(weekday);
}

function storicoUpdateWeekdayButtonsUI(){
  var todayIdx=_storicoTodayWeekdayIdx();
  for(var i=1;i<=6;i++){
    var btn=document.getElementById('ord-storico-wday-'+i);
    if(!btn)continue;
    btn.classList.toggle('ord-wday-today',todayIdx===i);
    var active=_storicoWeekdayFilter===i;
    btn.classList.toggle('ord-wday-active',active);
    btn.classList.toggle('ord-wday-scorso',active&&(_storicoWeeksAgo>0||_storicoBeyond6));
  }
}

function _storicoWdayOnDocClick(ev){
  var dd=document.getElementById('ord-storico-wday-dropdown');
  if(!dd||dd.style.display==='none')return;
  if(dd.contains(ev.target))return;
  if(_storicoWeekdayDropdown){
    var activeBtn=document.getElementById('ord-storico-wday-'+_storicoWeekdayDropdown);
    if(activeBtn&&activeBtn.contains(ev.target))return;
  }
  storicoCloseWeekdayDropdown();
}

function _storicoBindWdayDocClickOnce(){
  if(_storicoWdayDocClickBound)return;
  _storicoWdayDocClickBound=true;
  document.addEventListener('click',_storicoWdayOnDocClick,true);
}

function _storicoInitWeekdayOnOpen(){
  if(_storicoWeekdayFilter!=null)return;
  var todayIdx=_storicoTodayWeekdayIdx();
  if(todayIdx!=null){
    _storicoWeekdayFilter=todayIdx;
    _storicoWeeksAgo=0;
  }
}

function storicoHtmlWeekdayBar(){
  var h='<div class="ord-storico-weekday-row ord-weekday-row">';
  h+='<div class="ord-weekday-scroll">';
  for(var i=1;i<=6;i++){
    h+='<button type="button" id="ord-storico-wday-'+i+'" class="ord-wday-btn" onclick="storicoClickWeekday('+i+',event)">'+_STORICO_WDAY_LABELS[i]+'</button>';
  }
  h+='</div>';
  h+='<div id="ord-storico-wday-dropdown" class="ord-wday-dropdown" style="display:none;"></div>';
  h+='</div>';
  return h;
}

function storicoHtmlFilterMeta(total){
  if(_storicoBeyond6&&_storicoWeekdayFilter!=null){
    var cut=_storicoOlderCutoffISO();
    var d=new Date(cut+'T00:00:00');
    var cutLbl=isNaN(d.getTime())?cut:d.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
    var dayLbl=(_STORICO_WDAY_LABELS[_storicoWeekdayFilter]||'').toLowerCase();
    return '<div class="ord-storico-filter-meta">Tutti i '+esc(dayLbl)+' prima del '+esc(cutLbl)+(total!=null?' · '+total+' ordini':'')+'</div>';
  }
  if(_storicoWeekdayFilter!=null){
    var iso=_storicoWeekdayTargetISO(_storicoWeekdayFilter,_storicoWeeksAgo);
    var lbl=_storicoDayLabel(iso);
    var suffix='';
    if(_storicoWeeksAgo===1)suffix=' · scorso';
    else if(_storicoWeeksAgo>1)suffix=' · '+_storicoWeeksAgo+' settimane fa';
    return '<div class="ord-storico-filter-meta">'+esc(lbl)+suffix+(total!=null?' · '+total+' ordini':'')+'</div>';
  }
  return '';
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
  var iso=_storicoGetFilterDateISO(ord);
  return iso||'senza-data';
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
    return _storicoMatchSearch(ord,q)&&_storicoMatchWeekday(ord);
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

  var h='';
  h+=storicoHtmlWeekdayBar();
  h+=storicoHtmlFilterMeta(total);
  h+='<div class="ord-storico-toolbar">';
  h+='<input type="search" id="ord-storico-search" class="ord-storico-search" placeholder="Cerca cliente o prodotto…" value="'+esc(_storicoSearch)+'" ';
  h+='oninput="storicoOnSearch(this.value)" autocomplete="off">';
  h+='</div>';

  if(!arch.length){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine archiviato.<br><small>Gli ordini completati da 13+ giorni vengono archiviati automaticamente.</small></div>';
    storicoUpdateWeekdayButtonsUI();
    return;
  }
  if(!total){
    sv.innerHTML=h+'<div class="ord-storico-empty">Nessun ordine corrisponde ai filtri.</div>';
    storicoUpdateWeekdayButtonsUI();
    return;
  }

  var lastDay=null;
  var _stCanSeeTot = _storicoOwnerCanSeeTotali();
  var showDaySep=_storicoBeyond6;
  filtered.forEach(function(ord){
    var dayKey=_storicoDayKey(ord);
    if(showDaySep&&dayKey!==lastDay){
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

  h+='<div class="ord-storico-clear-wrap">';
  h+='<button type="button" class="ord-storico-clear" onclick="clearStorico()">🗑️ Svuota storico</button>';
  h+='</div>';

  sv.innerHTML=h;
  storicoUpdateWeekdayButtonsUI();
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
    renderStoricoOrdini();
    showToastGen('purple','Storico svuotato');
  });
}
