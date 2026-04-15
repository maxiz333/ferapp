// database.cartellini.js - estratto da database.js

// [SECTION: CARTELLINI] ----------------------------------------------------
//  Render tabella dati, genera cartellini, stampa, storico fatture
function renderTable(){
  var tb=document.getElementById('vb');
  if(!tb) return; // (DOM = Document Object Model) elemento non ancora pronto, skip
  tb.innerHTML='';

  // Rimuovi banner precedente
  var oldBanner=document.getElementById('_rt_banner_row');
  if(oldBanner) oldBanner.remove();

  // Quali indici renderizzare
  var idx = _filterIndices !== null ? _filterIndices : null;
  var total = idx !== null ? idx.length : rows.length;
  var limit = (!_tableShowAll && total > _tablePageSize) ? _tablePageSize : total;

  // Banner se la tabella - cappata
  if(!_tableShowAll && total > _tablePageSize){
    var banner=document.createElement('tr');
    banner.id='_rt_banner_row';
    banner.innerHTML='<td colspan="12" style="text-align:center;padding:10px;background:#1a1a1a;border-bottom:2px solid var(--accent);">'+
      '<span style="color:var(--muted);font-size:12px;">- Mostrati i primi <b style="color:var(--accent)">'+_tablePageSize+'</b> di <b style="color:var(--accent)">'+total+'</b> articoli. '+
      'Usa la - ricerca per trovare altri oppure '+
      '<button onclick="_tableShowAll=true;renderTable();" style="background:var(--accent);color:#111;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;margin-left:6px;">Mostra tutti</button></span>'+
      '</td>';
    tb.appendChild(banner);
  }

  for(var _li=0;_li<limit;_li++){
    var i = idx !== null ? idx[_li] : _li;
    var r=rows[i];
    if(!r) continue;
var isRem=removed.has(String(i));
    var m=magazzino[i]||{};
    var g=r.giornalino?getGiornalino(r.giornalino):null;
    var gBg=(!isRem&&g&&g.val)?g.color:'';
    var gText=(!isRem&&g&&g.val)?g.text:'var(--text)';
    var borderL=isRem?'border-left:3px solid #e53e3e44;':'border-left:3px solid '+(g&&g.val?g.nastro:'transparent')+';';
    var opacity=isRem?'opacity:.45;':'';
    var specs=m.specs||'';
    var hasSpecs=!!(m.specs||m.posizione);
    var soglia=getSoglia(i);
    var qty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    var isLow=qty!==null&&qty<=soglia;
    var unit=m.unit||'pz';

    var tr=document.createElement('tr');
    tr.dataset.idx=i;
    tr.style.cssText='border-bottom:1px solid var(--border);'+borderL+opacity+(gBg?'background:'+gBg+';':'');

    tr.innerHTML=
      // Data
      '<td style="padding:6px 5px;white-space:nowrap;">'+
        '<input type="text" id="d'+i+'" value="'+esc(r.data)+'" onchange="upd('+i+')" style="width:74px;padding:4px 5px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--muted);font-size:11px;">'+
      '</td>'+
      // Descrizione
      '<td style="padding:6px 5px;">'+
        '<input type="text" id="e'+i+'" value="'+esc(r.desc)+'" onchange="upd('+i+')" placeholder="Descrizione..." '+
          'style="width:100%;min-width:130px;padding:4px 6px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:12px;font-weight:600;">'+
      '</td>'+
      // Specifiche turchine (click apre overlay)
      '<td style="padding:6px 5px;max-width:160px;cursor:pointer;" onclick="openEditProdotto('+i+')" title="Modifica articolo">'+
        '<div style="font-size:11px;color:#2dd4bf;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:155px;">'+
          (specs?(specs.length>40?esc(specs.substring(0,40))+'-':esc(specs)):'<span style="color:#444;font-size:10px;">- -</span>')+
        '</div>'+
        (m.posizione?'<div style="font-size:9px;color:#888;margin-top:1px;">- '+esc(m.posizione)+'</div>':'')+
      '</td>'+
      // Cod Fornitore
      '<td style="padding:6px 5px;">'+
        '<input type="text" id="f'+i+'" value="'+esc(r.codF)+'" onchange="upd('+i+')" placeholder="-" '+
          'style="width:82px;padding:4px 5px;border:1px solid #e53e3e44;border-radius:5px;background:#111;color:#fc8181;font-size:11px;font-weight:600;">'+
      '</td>'+
      // Mio Codice
      '<td style="padding:6px 5px;">'+
        '<input type="text" id="m'+i+'" value="'+esc(r.codM)+'" onchange="upd('+i+')" placeholder="-" '+
          'style="width:70px;padding:4px 5px;border:1px solid var(--accent)44;border-radius:5px;background:#111;color:var(--accent);font-size:11px;font-weight:600;">'+
      '</td>'+
      // Prezzo vecchio
      '<td style="padding:6px 5px;text-align:right;">'+
        '<input type="text" id="po'+i+'" value="'+esc(r.prezzoOld)+'" placeholder="-" onchange="upd('+i+')" '+
          'style="width:54px;padding:4px 5px;border:1px solid var(--border);border-radius:5px;background:#111;color:#888;font-size:11px;text-align:right;text-decoration:'+(r.prezzoOld?'line-through':'none')+';opacity:.7;">'+
      '</td>'+
      // Prezzo nuovo + storico
      '<td style="padding:6px 5px;text-align:right;white-space:nowrap;">'+
        '<input type="text" id="p'+i+'" value="'+esc(r.prezzo)+'" onchange="updPrice('+i+')" '+
          'style="width:50px;padding:4px 5px;border:1px solid var(--accent)44;border-radius:5px;background:#111;color:var(--accent);font-size:13px;font-weight:900;text-align:right;">'+
        ' <button onclick="showPriceHistory('+i+')" title="Storico prezzi" style="background:none;border:none;cursor:pointer;font-size:11px;vertical-align:middle;">-</button>'+
      '</td>'+
      // Giornalino
      '<td style="padding:6px 4px;text-align:center;">'+selGiornalino('gi'+i,r.giornalino||'',i)+'</td>'+
      // Dimensione
      '<td style="padding:6px 4px;text-align:center;">'+sel('s'+i,r.size,[['small','Piccolo'],['large','Grande']],'upd('+i+')')+'</td>'+
      // Quantit-
      '<td style="padding:6px 4px;text-align:center;white-space:nowrap;">'+
        '<button onclick="deltaQta('+i+',-1)" style="background:#333;border:none;color:var(--text);width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;line-height:1;vertical-align:middle;">-</button>'+
        '<input type="number" min="0" value="'+(qty!==null?qty:'')+'" placeholder="-" '+
          'style="width:38px;padding:3px 2px;border:1px solid '+(isLow?'#e53e3e':'var(--border)')+';border-radius:5px;background:#111;color:'+(isLow?'#e53e3e':'var(--accent)')+';font-size:12px;font-weight:900;text-align:center;margin:0 2px;vertical-align:middle;" '+
          'onchange="saveQta('+i+',this.value)" id="tb-qty-'+i+'">'+
        '<button onclick="deltaQta('+i+',1)" style="background:#333;border:none;color:var(--text);width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;line-height:1;vertical-align:middle;">+</button>'+
        (isLow?'<div style="font-size:9px;color:#e53e3e;margin-top:1px;">-- min:'+soglia+'</div>':'<div style="font-size:9px;color:var(--muted);margin-top:1px;">'+esc(unit)+'</div>')+
      '</td>'+
      // Note
      '<td style="padding:6px 4px;text-align:center;">'+
        '<button class="ni" onclick="openNote('+i+')" title="Note" style="font-size:16px;">'+(r.note?'--':'-')+'</button>'+
      '</td>'+
      // Azioni
      '<td style="padding:6px 4px;text-align:center;white-space:nowrap;">'+
        '<button class="dup-btn" onclick="dupRow('+i+')" title="Duplica" style="font-size:14px;">-</button> '+
        '<button class="del-btn" onclick="delRow('+i+')" style="font-size:13px;">-</button>'+
      '</td>';

    tb.appendChild(tr);
  }
  updateStats();
}

function readRow(i){
  if(!rows[i]) return false;
  var prev = rows[i];
  var rawCodM = (document.getElementById('m'+i)||{}).value||'';
  var newCodM = (typeof sanitizeCodiceMagazzinoInput === 'function')
    ? sanitizeCodiceMagazzinoInput(rawCodM)
    : String(rawCodM).trim();
  var mel = document.getElementById('m'+i);
  if(mel) mel.value = newCodM;
  if(typeof findDuplicateCodMagazzino === 'function'){
    var dupRow = findDuplicateCodMagazzino(newCodM, i);
    if(dupRow){
      if(typeof showCodiceMagazzinoDuplicateError === 'function') showCodiceMagazzinoDuplicateError(newCodM, dupRow.desc);
      else showToastGen('red', "⚠️ Errore: Il codice " + String(newCodM).trim() + " è già assegnato all'articolo " + (dupRow.desc || '—') + ". Usa un codice diverso.");
      if(mel) mel.value = prev.codM || '';
      return false;
    }
  }
  var now = Date.now();
  rows[i]={
    data: (document.getElementById('d'+i)||{}).value||'',
    desc: (document.getElementById('e'+i)||{}).value||'',
    codF: (document.getElementById('f'+i)||{}).value||'',
    codM: newCodM,
    prezzoOld:(document.getElementById('po'+i)||{}).value||'',
    prezzo:(document.getElementById('p'+i)||{}).value||'',
    size:(document.getElementById('s'+i)||{}).value||'small',
    note:prev.note||'',
    priceHistory:prev.priceHistory||[],
    giornalino:(document.getElementById('gi'+i)||{value:prev.giornalino||''}).value,
    createdAt: prev.createdAt,
    isPromo: prev.isPromo,
    promoTipo: prev.promoTipo,
    lastProductChangeAt: prev.lastProductChangeAt,
    _updatedAt: now
  };
  return true;
}

function upd(i){
  if(readRow(i) === false) return;
  save();
  updateStats();
  updRowColor(i);
  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(i);
}
function updRowColor(i){
  var tr=document.querySelector('#tb tr[data-idx="'+i+'"]');
  if(!tr) return;
  if(rows[i]&&rows[i].giornalino){
    var g=getGiornalino(rows[i].giornalino);
    tr.style.background=g.color;
    tr.classList.remove('promo-row');
  } else {
    tr.style.background='';
    tr.classList.remove('promo-row');
  }
  var s=document.getElementById('gi'+i);
  if(s&&rows[i]){
    var g=getGiornalino(rows[i].giornalino||'');
    s.style.background=g.color; s.style.color=g.text;
  }
}
function updPrice(i){
  var oldPrezzo=rows[i]?rows[i].prezzo:'';
  if(readRow(i) === false) return;
  if(oldPrezzo && oldPrezzo!==rows[i].prezzo){
    if(!rows[i].priceHistory) rows[i].priceHistory=[];
    rows[i].priceHistory.unshift({prezzo:oldPrezzo, data:new Date().toLocaleDateString('it-IT')});
  }
  var s=document.getElementById('s'+i);
  if(s){s.value=autoSize(rows[i].prezzo);rows[i].size=s.value;}
  save();updateStats();
  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(i);
}

function clearAll(){
  var d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  d.innerHTML='<div style="background:#fff;border-radius:10px;padding:24px;max-width:320px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3);">'+
    '<div style="font-size:32px;margin-bottom:12px;">--</div>'+
    '<p style="font-size:14px;font-weight:bold;margin-bottom:8px;">Eliminare tutto?</p>'+
    '<p style="font-size:12px;color:#666;margin-bottom:16px;">Tutti gli articoli verranno spostati nel cestino.</p>'+
    '<div style="display:flex;gap:8px;justify-content:center;">'+
    '<button id="cancel-clear" style="background:#6b7280;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:13px;">Annulla</button>'+
    '<button id="confirm-clear" style="background:#dc2626;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:13px;">Elimina tutto</button>'+
    '</div></div>';
  document.body.appendChild(d);
  document.getElementById('cancel-clear').onclick=function(){d.remove();};
  document.getElementById('confirm-clear').onclick=function(){
    d.remove();
    rows.forEach(function(r){cestino.unshift(Object.assign({},r,{deletedAt:new Date().toLocaleString('it-IT')}));});
    rows=[]; removed=new Set(); lsSet(RK,[]); lsSet(CK,cestino);
    save(); renderTable(); genTags(); updateBadge();
  };
}

function addRow(){
  showConfirm('⚠️ Stai aggiungendo un NUOVO articolo al database. Continuare?', function(){
    var firstDate=rows.length>0?rows[0].data:'04-03-2026';
    rows.push({data:firstDate,desc:'',codF:'',codM:'',prezzoOld:'',prezzo:'',size:'small',note:'',giornalino:''});
    renderTable();save();
  });
}

function delRow(i){
  if(!rows[i]) return;
  _takeSnapshot();
  cestino.unshift(Object.assign({},rows[i],{deletedAt:new Date().toLocaleString('it-IT')}));
  lsSet(CK,cestino);
  rows.splice(i,1);
  var newRem=new Set();
  removed.forEach(function(idx){
    var n=Number(idx);
    if(n<i) newRem.add(String(n));
    else if(n>i) newRem.add(String(n-1));
  });
  removed=newRem; lsSet(RK,removed.slice());
  // Salva SENZA leggere dal DOM (il DOM - disallineato dopo splice)
  if(rows.length<=5000) lsSet(SK,rows); lsSet(MAGK,magazzino); updateStats();
  renderTable(); genTags(); updateBadge();
  showToastGen('red','- Eliminato');
}

function save(){
  _takeSnapshot();
  var ok = true;
  rows.forEach(function(_,i){
    if(!ok) return;
    if(document.getElementById('d'+i) && readRow(i) === false) ok = false;
  });
  if(!ok) return;
  // Salta localStorage se il catalogo è troppo grande (limite ~5MB)
  if(rows.length <= 5000) lsSet(SK,rows);
  lsSet(MAGK,magazzino);
  updateStats();
}

function updateStats(){
  var stEl=document.getElementById('st');
  if(!stEl) return; // DOM non ancora pronto
  var total=rows.length, rem=removed.size;
  var conGiornalino=rows.filter(function(r,i){return r.giornalino&&!removed.has(String(i));}).length;
  stEl.textContent=total;
  document.getElementById('sa').textContent=total-rem;
  document.getElementById('sr').textContent=rem;
  document.getElementById('sp').textContent=conGiornalino;
  document.getElementById('sc2').textContent=cestino.length;
  updatePromoBadge();
}

function updateBadge(){
  var b=document.getElementById('cb');
  if(!b) return;
  b.textContent=cestino.length;
  b.style.display=cestino.length>0?'inline':'none';
  updateStats();
}

function norm(s){return window.AppUtils.norm(s);}
function stem(w){
  return window.AppUtils.stem(w);
}
function lev(a,b){
  return window.AppUtils.lev(a,b);
}
function wordScore(qw,tw){
  return window.AppUtils.wordScore(qw,tw);
}
function fuzzyScore(query,text){
  return window.AppUtils.fuzzyScore(query,text);
}
function doFilter(){
  var q=(document.getElementById('si')||{value:''}).value.trim();
  var hint=document.getElementById('sh');

  if(!q){
    _filterIndices=null;
    _tableShowAll=false;
    renderTable();
    if(hint) hint.textContent='';
    return;
  }

  // Cerca su TUTTI i rows[] (non solo quelli renderizzati)
  var qn=norm(q);
  var matches=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    if(!r) continue;
    var text=[r.data,r.desc,r.codF,r.codM,r.prezzo,r.prezzoOld,r.note].join(' ');
    if(fuzzyScore(qn,text)>=60) matches.push(i);
  }

  _filterIndices=matches;
  _tableShowAll=(matches.length<=_tablePageSize);
  renderTable();

  if(hint){
    if(matches.length===0) hint.textContent='-- Nessun risultato';
    else hint.textContent=matches.length+' risultat'+(matches.length===1?'o':'i')+' su '+rows.length;
  }
}

function doSort(col){
  if(sortCol===col) sortDir*=-1; else{sortCol=col;sortDir=1;}
  rows.sort(function(a,b){
    var va=a[col]||'',vb=b[col]||'';
    if(col==='prezzo'||col==='prezzoOld'){
      va=parseFloat(va.replace(',','.'))||0;vb=parseFloat(vb.replace(',','.'))||0;
      return (va-vb)*sortDir;
    }
    return va.localeCompare(vb)*sortDir;
  });
  removed.clear();lsSet(RK,[]);
  save();renderTable();
  document.querySelectorAll('th .si').forEach(function(s){s.textContent='-';});
  var cols=['data','desc','codF','codM','prezzoOld','prezzo'];
  var idx=cols.indexOf(col);
  if(idx>=0){var icons=document.querySelectorAll('th .si');if(icons[idx])icons[idx].textContent=sortDir===1?'-':'-';}
}

function openNote(i){
  noteIdx=i;
  _noteSnapshot=rows[i]?rows[i].note||'':null;
  document.getElementById('nd').textContent=rows[i]?rows[i].desc||'':'';
  var full=rows[i]?rows[i].note||'':'';
  document.getElementById('nt').value=full.split('|||')[0];
  var npEl=document.getElementById('np');
  if(npEl) npEl.style.display='none';
  document.getElementById('nm').classList.add('open');
}
function saveNote(){
  if(noteIdx===null) return;
  var txt=document.getElementById('nt').value.trim();
  if(rows[noteIdx]) rows[noteIdx].note=txt;
  save(); updateNoteBadge();
  var btn=document.querySelector('#tb tr[data-idx="'+noteIdx+'"] .ni');
  if(btn) btn.textContent=rows[noteIdx].note?'--':'-';
  _noteSnapshot=null; // conferma: non ripristinare
  document.getElementById('nm').classList.remove('open');
  noteIdx=null;
}
function closeNote(){
  // ripristina snapshot se esiste (Annulla)
  if(_noteSnapshot!==null && noteIdx!==null && rows[noteIdx]){
    rows[noteIdx].note=_noteSnapshot;
    save(); updateNoteBadge();
  }
  _noteSnapshot=null;
  document.getElementById('nm').classList.remove('open');
  noteIdx=null;
}

function makeTag(r,idx){
  var cls=r.size==='large'?'tag-large':'tag-small';
  var cp=r.giornalino?' cp':'';
  var g=getGiornalino(r.giornalino||'');
  var showBarrato=editorSettings.barrato?(r.barrato==='si'||r.prezzoOld):false;
  var oldH=showBarrato&&r.prezzoOld?'<span class="top2">&euro;&nbsp;'+r.prezzoOld+'</span>':'';
  var clickAttr=(idx!==undefined)?'onclick="quickEditPrice('+idx+')" title="Tocca per modificare il prezzo" style="cursor:pointer;"':'';
  var promoStyle=r.giornalino?'--promo-color:'+g.nastro+';':'';
  return '<div class="'+cls+cp+'" style="'+promoStyle+'"><div class="th2"><span class="td2">'+r.data+'</span></div><div class="tpa">'+oldH+'<span class="tpr" '+clickAttr+'>&euro;&nbsp;'+r.prezzo+'</span></div><div class="tf2"><span class="tcf">'+r.codF+'</span><span class="tcm">'+r.codM+'</span></div></div>';
}
function buildTagsHTML(data,withIdx){
  var active=data.filter(function(r,i){return !removed.has(String(i));});
  var sm=active.filter(function(r){return r.size==='small';});
  var lg=active.filter(function(r){return r.size==='large';});
  var h='';
  // calcola indici originali
  function origIdx(r){ return rows.indexOf(r); }
  for(var i=0;i<sm.length;i+=3) h+='<div class="tag-row">'+sm.slice(i,i+3).map(function(r){return makeTag(r,withIdx?origIdx(r):undefined);}).join('')+'</div>';
  for(var i=0;i<lg.length;i+=2) h+='<div class="tag-row">'+lg.slice(i,i+2).map(function(r){return makeTag(r,withIdx?origIdx(r):undefined);}).join('')+'</div>';
  return h;
}
function genTags(){
  save();
  var printArea=document.getElementById('print-area');
  if(!printArea) return; // DOM non ancora pronto
  var html=buildTagsHTML(rows,true);
  printArea.innerHTML=html;
  var t1area=document.getElementById('print-area-t1');
  if(t1area) t1area.innerHTML=html;
}
function showPrev(){
  genTags();
  document.getElementById('pc').innerHTML=buildTagsHTML(rows,false);
  document.getElementById('pov').classList.add('open');
  // Scala l'anteprima in modo che 1mm corrisponda visivamente alle proporzioni reali
  _scalePrevContainer();
}
function showPrevPromoScaled(){
  var promo=rows.filter(function(r,i){return r.giornalino&&!removed.has(String(i));});
  if(!promo.length){showToastGen('red','-- Nessun articolo con giornalino');return;}
  document.getElementById('pc').innerHTML=buildTagsHTML(promo);
  document.getElementById('pov').classList.add('open');
  _scalePrevContainer();
}
function _scalePrevContainer(){
  // Calcola quanti px = 1mm sul dispositivo reale
  var mmPx = (function(){
    var d=document.createElement('div');
    d.style.cssText='position:absolute;width:100mm;height:0;visibility:hidden;';
    document.body.appendChild(d);
    var px=d.getBoundingClientRect().width;
    document.body.removeChild(d);
    return px/100;
  })();
  var pc=document.getElementById('pc');
  if(!pc)return;
  // Larghezza disponibile del pannello (pb) meno padding 6mm-2
  var pb=document.getElementById('pb');
  var availW=(pb?pb.getBoundingClientRect().width:window.innerWidth) - 12*mmPx;
  // Larghezza A4 reale in mm = 210mm, meno margini 4mm-2 = 202mm
  var a4W=202*mmPx;
  var scale=Math.min(1, availW/a4W);
  pc.style.transformOrigin='top left';
  pc.style.transform='scale('+scale.toFixed(4)+')';
  pc.style.width=(a4W)+'px';
  pc.style.marginBottom=((a4W*(scale-1)))+'px'; // compensa lo spazio perso
}
function closePrev(){document.getElementById('pov').classList.remove('open');}

function quickEditPrice(idx){
  if(!rows[idx]) return;
  var r=rows[idx];
  var d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  d.innerHTML='<div style="background:#fff;border-radius:10px;padding:24px;max-width:320px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.3);">'+
    '<p style="font-size:13px;font-weight:bold;color:#1e3a5f;margin-bottom:4px;">-- Modifica prezzo</p>'+
    '<p style="font-size:11px;color:var(--muted);margin-bottom:12px;">'+esc(r.desc)+'</p>'+
    '<label style="font-size:11px;color:var(--muted);">Nuovo prezzo (-)</label>'+
    '<input id="qep-val" type="text" value="'+esc(r.prezzo)+'" style="width:100%;padding:10px;border:2px solid #1e3a5f;border-radius:6px;font-size:18px;font-weight:bold;text-align:center;margin:6px 0 14px;">'+
    '<div style="display:flex;gap:8px;justify-content:center;">'+
    '<button id="qep-cancel" style="background:#6b7280;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:13px;">Annulla</button>'+
    '<button id="qep-ok" style="background:#1d4ed8;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:13px;">- Salva</button>'+
    '</div></div>';
  document.body.appendChild(d);
  var inp=document.getElementById('qep-val');
  inp.focus(); inp.select();
  document.getElementById('qep-cancel').onclick=function(){d.remove();};
  document.getElementById('qep-ok').onclick=function(){
    var newP=inp.value.trim();
    if(!newP){d.remove();return;}
    var prevPrezzo = rows[idx].prezzo;
    // salva storico
    if(!rows[idx].priceHistory) rows[idx].priceHistory=[];
    if(rows[idx].prezzo && rows[idx].prezzo!==newP){
      rows[idx].priceHistory.unshift({prezzo:rows[idx].prezzo, data:new Date().toLocaleDateString('it-IT')});
    }
    rows[idx].prezzo=newP;
    rows[idx].size=autoSize(newP);
    var nowQ = Date.now();
    rows[idx]._updatedAt = nowQ;
    if(!magazzino[idx]) magazzino[idx] = {};
    magazzino[idx]._updatedAt = nowQ;
    if(String(prevPrezzo||'') !== String(newP||'') && typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(rows[idx]);
    // aggiorna input nella tabella se visibile
    var inp2=document.getElementById('p'+idx);
    if(inp2) inp2.value=newP;
    var sel=document.getElementById('s'+idx);
    if(sel) sel.value=rows[idx].size;
    if(rows.length <= 5000) lsSet(MAGK, magazzino);
    save(); genTags(); updateStats();
    if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(idx);
    d.remove();
  };
}

function showPriceHistory(idx){
  if(!rows[idx]) return;
  var r=rows[idx];
  var hist=r.priceHistory||[];
  var d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  var histH=hist.length?hist.map(function(h){
    return '<tr><td style="padding:5px 8px;color:var(--muted);">'+h.data+'</td><td style="padding:5px 8px;font-weight:bold;">- '+h.prezzo+'</td></tr>';
  }).join(''):'<tr><td colspan="2" style="padding:10px;color:#aaa;text-align:center;">Nessuno storico</td></tr>';
  d.innerHTML='<div style="background:#fff;border-radius:10px;padding:24px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.3);">'+
    '<p style="font-size:13px;font-weight:bold;color:#1e3a5f;margin-bottom:4px;">- Storico prezzi</p>'+
    '<p style="font-size:11px;color:var(--muted);margin-bottom:12px;">'+esc(r.desc)+'</p>'+
    '<p style="font-size:12px;margin-bottom:6px;">Prezzo attuale: <b style="color:#dc2626;">- '+esc(r.prezzo)+'</b></p>'+
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">'+
    '<tr style="background:#f0f4ff;"><th style="padding:5px 8px;text-align:left;">Data modifica</th><th style="padding:5px 8px;text-align:left;">Prezzo precedente</th></tr>'+
    histH+'</table>'+
    '<div style="margin-top:14px;text-align:right;">'+
    '<button id="ph-close" style="background:#6b7280;color:#fff;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-size:13px;">Chiudi</button>'+
    '</div></div>';
  document.body.appendChild(d);
  document.getElementById('ph-close').onclick=function(){d.remove();};
}

function showList(){
  var al=document.getElementById('al');al.innerHTML='';
  rows.forEach(function(r,i){
    var isRem=removed.has(String(i));
    var li=document.createElement('li');
    if(isRem) li.classList.add('r');
    li.innerHTML='<input type="checkbox"'+(isRem?' checked':'')+' onchange="toggleRem('+i+',this)">'+
      '<span class="ld">'+(r.desc||'(senza desc.)')+(r.note?'<span class="ln">- '+r.note+'</span>':'')+'</span>'+
      '<span class="lp">- '+r.prezzo+'</span><span class="lc">'+r.codF+'</span>';
    al.appendChild(li);
  });
  document.getElementById('lo').classList.add('open');
}
function closeList(){document.getElementById('lo').classList.remove('open');}
function toggleRem(i,cb){
  if(cb.checked){removed.add(String(i));cb.closest('li').classList.add('r');}
  else{removed.delete(String(i));cb.closest('li').classList.remove('r');}
  lsSet(RK,removed.slice());updateStats();
}
function clearChecked(){
  showConfirm('Rimuovere dalla tabella tutti gli articoli spuntati?', function(){

  var toRemove=removed.slice().map(Number).sort(function(a,b){return b-a;});
  toRemove.forEach(function(i){
    if(rows[i]){cestino.unshift(Object.assign({},rows[i],{deletedAt:new Date().toLocaleString('it-IT')}));rows.splice(i,1);}
  });
  lsSet(CK,cestino);removed.clear();lsSet(RK,[]);
  save();renderTable();closeList();updateBadge();

  });
}
function buildListHTML(){
  var nome=document.getElementById('fn').value;
  var tot=rows.length,rem=removed.size;
  var h='<html><head><title>Lista</title><style>body{font-family:Arial;padding:15mm;font-size:11pt;}h1{font-size:14pt;margin-bottom:4px;}.sub{color:var(--muted);font-size:10pt;margin-bottom:14px;}table{width:100%;border-collapse:collapse;font-size:10pt;}th{background:#1e3a5f;color:#fff;padding:5px 6px;text-align:left;}td{padding:4px 6px;border-bottom:1px solid #ddd;}.r{opacity:.4;text-decoration:line-through;}.price{font-weight:bold;color:#c00;}.note{font-size:9pt;color:var(--muted);font-style:italic;}.rb{background:#fee2e2;color:#c00;padding:1px 6px;border-radius:4px;font-size:8pt;}.ab{background:#dcfce7;color:#166534;padding:1px 6px;border-radius:4px;font-size:8pt;}</style></head><body>';
  h+='<h1>- Lista Articoli - '+nome+'</h1><p class="sub">Generato il '+new Date().toLocaleDateString('it-IT')+' - Totale: '+tot+' - Attivi: '+(tot-rem)+' - Rimossi: '+rem+'</p>';
  h+='<table><thead><tr><th>#</th><th>Descrizione</th><th>Cod.Forn.</th><th>Mio Cod.</th><th>Prezzo</th><th>Stato</th></tr></thead><tbody>';
  rows.forEach(function(r,i){
    var isR=removed.has(String(i));
    h+='<tr class="'+(isR?'r':'')+'"><td>'+(i+1)+'</td><td>'+(r.desc||'')+(r.note?'<br><span class="note">- '+r.note+'</span>':'')+'</td><td>'+r.codF+'</td><td>'+r.codM+'</td><td class="price">- '+r.prezzo+'</td><td>'+(isR?'<span class="rb">Rimosso</span>':'<span class="ab">Attivo</span>')+'</td></tr>';
  });
  return h+'</tbody></table></body></html>';
}
function exportPDF(){
  var w=window.open('');
  if(!w){showToastGen('red','-- Popup bloccato - usa Stampa - Salva come PDF.');return;}
  w.document.write(buildListHTML());
  w.document.close();
  setTimeout(function(){w.print();},600);
}
function printList(){exportPDF();}

function saveHist(){
  var name=document.getElementById('fn').value||'Fattura';
  save();
  if(!rows.length){showToastGen('red','-- Nessun dato da salvare');return;}
  var hist=lsGet(HK,[]);
  hist.unshift({id:Date.now(),name:name,date:new Date().toLocaleDateString('it-IT'),rows:rows.map(function(r){return Object.assign({},r);})});
  lsSet(HK,hist);showToastGen('green','- "'+name+'" salvata nello storico!');
}
function renderHist(){
  var hist=lsGet(HK,[]);
  var el=document.getElementById('hl');
  if(!hist.length){el.innerHTML='<p style="color:#aaa;font-size:13px;">Nessuna fattura salvata.</p>';return;}
  el.innerHTML=hist.map(function(h){
    return '<div class="hi"><div class="hi-info"><b>'+h.name+'</b><span>'+h.date+'</span><span>- '+h.rows.length+' articoli</span></div>'+
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">'+
      '<button class="btn btn-teal" onclick="viewHist('+h.id+')">-- Visualizza</button>'+
      '<button class="btn" onclick="loadHist('+h.id+')">- Carica</button>'+
      '<button class="btn btn-red" onclick="delHist('+h.id+')">--</button></div></div>';
  }).join('');
}
function loadHist(id){
  var hist=lsGet(HK,[]);var e=hist.find(function(h){return h.id===id;});
  if(!e) return;
  showConfirm('Caricare "'+e.name+'"? I dati correnti andranno persi.', function(){
    document.getElementById('fn').value=e.name;
    rows=e.rows.map(function(r){return Object.assign({},r);});
    removed.clear();lsSet(RK,[]);
    save();renderTable();genTags();goTab('t1');
    showToastGen('green','- "'+e.name+'" caricata!');
  });
}
function delHist(id){
  showConfirm('Eliminare questa fattura dallo storico?', function(){

  var hist=lsGet(HK,[]).filter(function(h){return h.id!==id;});
  lsSet(HK,hist);renderHist();

  });
}
function viewHist(id){
  var hist=lsGet(HK,[]);var e=hist.find(function(h){return h.id===id;});
  if(!e) return;
  document.getElementById('vt').textContent='-- '+e.name+' - '+e.date;
  var tot=e.rows.length;
  var lg=e.rows.filter(function(r){return r.size==='large';}).length;
  var pr=e.rows.filter(function(r){return r.giornalino;}).length;
  document.getElementById('vs').innerHTML=
    '<div class="sc"><span class="n">'+tot+'</span>Articoli</div>'+
    '<div class="sc g"><span class="n">'+(tot-lg)+'</span>Piccoli</div>'+
    '<div class="sc o"><span class="n">'+lg+'</span>Grandi</div>'+
    '<div class="sc p"><span class="n">'+pr+'</span>Con Giornalino</div>';
  document.getElementById('vb').innerHTML=e.rows.map(function(r,i){
    var g=getGiornalino(r.giornalino||'');
    return '<tr style="background:'+(r.giornalino?g.color:(i%2?'#f9f9f9':''))+';border-bottom:1px solid #eee;">' +
      '<td style="padding:4px 5px;color:#888">'+(i+1)+'</td>'+
      '<td style="padding:4px 5px;font-weight:500">'+(r.desc||'-')+'</td>'+
      '<td style="padding:4px 5px;font-size:11px;color:#555">'+(r.codF||'-')+'</td>'+
      '<td style="padding:4px 5px;font-size:11px;color:#555">'+(r.codM||'-')+'</td>'+
      '<td style="padding:4px 5px;color:#aaa">'+(r.prezzoOld?'- '+r.prezzoOld:'-')+'</td>'+
      '<td style="padding:4px 5px;font-weight:bold;color:#dc2626">- '+r.prezzo+'</td>'+
      '<td style="padding:4px 5px;text-align:center">'+(r.giornalino?g.label:'-')+'</td>'+
      '<td style="padding:4px 5px;font-size:11px">'+(r.size==='large'?'Grande':'Piccolo')+'</td></tr>';
  }).join('');
  document.getElementById('vl').onclick=function(){closeView();loadHist(id);};
  document.getElementById('vo').classList.add('open');
}
function closeView(){document.getElementById('vo').classList.remove('open');}
function printView(){
  var title=document.getElementById('vt').textContent;
  var tbl=document.getElementById('vta').outerHTML;
  var w=window.open('','_blank');if(!w){showToastGen('red','-- Popup bloccato');return;}
  w.document.write('<html><head><title>'+title+'</title><style>body{font-family:Arial;padding:12mm;font-size:10pt;}h1{font-size:13pt;margin-bottom:10px;}table{width:100%;border-collapse:collapse;}th{background:#1e3a5f;color:#fff;padding:5px;}td{padding:4px 5px;border-bottom:1px solid #ddd;}</style></head><body><h1>'+title+'</h1>'+tbl+'</body></html>');
  w.document.close();w.print();
}

function renderCestino(){
  var el=document.getElementById('cl');var ca=document.getElementById('ca');
  if(!cestino.length){el.innerHTML='<p style="color:#aaa;font-size:13px;">Il cestino - vuoto.</p>';ca.style.display='none';}
  else {
    ca.style.display='block';
    el.innerHTML=cestino.map(function(r,i){
      return '<div style="border:1px solid #fee2e2;border-radius:6px;padding:10px 14px;margin-bottom:8px;background:#fff8f8;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'+
        '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(r.desc||'(senza descrizione)')+'</div>'+
        '<div style="font-size:11px;color:var(--muted);margin-top:2px;"><span style="color:#dc2626;font-weight:bold">- '+r.prezzo+'</span> - <span style="color:#fc8181;font-weight:600;">'+r.codF+'</span> / <span style="color:var(--accent);font-weight:600;">'+r.codM+'</span> - <i>Eliminato: '+r.deletedAt+'</i>'+(r.note?' - - '+r.note:'')+'</div></div>'+
        '<div style="display:flex;gap:5px;flex-shrink:0;"><button class="btn btn-green" onclick="restoreOne('+i+')">-- Ripristina</button><button class="btn btn-red" onclick="permDel('+i+')">- Elimina</button></div></div>';
    }).join('');
  }
  // Cestino carrelli/ordini
  var ccEl=document.getElementById('cart-cestino-list');
  if(!ccEl) return;
  if(!carrelliCestino.length){
    ccEl.innerHTML='<p style="color:#aaa;font-size:13px;">Nessun ordine nel cestino.</p>';
    return;
  }
  ccEl.innerHTML=carrelliCestino.map(function(cart,i){
    var tot=(cart.items||[]).reduce(function(s,it){return s+(parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0));},0);
    var items=(cart.items||[]).map(function(it){return '<div style="font-size:11px;color:#aaa;padding:2px 0;">- '+esc(it.desc||'')+'  -'+it.qty+'  -'+(parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0)).toFixed(2)+'</div>';}).join('');
    return '<div style="border:1px solid #333;border-radius:10px;padding:12px;margin-bottom:10px;background:#1e1e1e;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'+
      '<div style="font-size:13px;font-weight:800;color:var(--text);">- '+esc(cart.nome)+'</div>'+
      '<div style="font-size:14px;font-weight:900;color:var(--accent);">- '+tot.toFixed(2)+'</div></div>'+
      items+
      '<div style="font-size:10px;color:#555;margin:6px 0;">Eliminato: '+esc(cart.deletedAt||'')+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:8px;">'+
      '<button onclick="ripristinaCarrello('+i+')" style="flex:1;padding:8px;border-radius:8px;border:1px solid #38a169;background:transparent;color:#68d391;font-size:12px;font-weight:700;cursor:pointer;touch-action:manipulation;">-- Ripristina</button>'+
      '<button onclick="eliminaCartCestino('+i+')" style="padding:8px 14px;border-radius:8px;border:1px solid #555;background:transparent;color:#888;font-size:12px;cursor:pointer;touch-action:manipulation;">- Elimina def.</button>'+
      '</div></div>';
  }).join('');
}

function ripristinaCarrello(i){
  var cart=carrelliCestino.splice(i,1)[0];
  if(!cart) return;
  delete cart.deletedAt;
  carrelli.push(cart);
  activeCartId=cart.id;
  lsSet(CART_CK, carrelliCestino);
  saveCarrelli();
  renderCestino();
  goTab('tc');
  showToastGen('green','-- Ordine ripristinato');
}

function eliminaCartCestino(i){
  carrelliCestino.splice(i,1);
  lsSet(CART_CK, carrelliCestino);
  renderCestino();
}
function restoreOne(i){
  var r=cestino[i];if(!r) return;
  var obj=Object.assign({},r);delete obj.deletedAt;
  rows.push(obj);cestino.splice(i,1);lsSet(CK,cestino);
  save();renderTable();renderCestino();updateBadge();
}
function restoreAll(){
  cestino.forEach(function(r){var obj=Object.assign({},r);delete obj.deletedAt;rows.push(obj);});
  cestino=[];lsSet(CK,cestino);save();renderTable();renderCestino();updateBadge();goTab('t1');
}
function permDel(i){
  showConfirm('Eliminare definitivamente? Non sar- pi- recuperabile.', function(){

  cestino.splice(i,1);lsSet(CK,cestino);renderCestino();updateBadge();

  });
}
function emptyTrash(){
  showConfirm('Svuotare il cestino? ' + cestino.length + ' articoli eliminati definitivamente.', function(){

  cestino=[];lsSet(CK,cestino);renderCestino();updateBadge();

  });
}

function dupRow(i){
  if(!rows[i]) return;
  // leggi valori aggiornati prima di duplicare
  if(document.getElementById('d'+i)) readRow(i);
  var copy=Object.assign({},rows[i]);
  rows.splice(i+1,0,copy);
  // shifta removed e cestino
  var newRem=new Set();
  removed.forEach(function(idx){
    var n=Number(idx);
    if(n<=i) newRem.add(String(n));
    else newRem.add(String(n+1));
  });
  removed=newRem; lsSet(RK,removed.slice());
  save(); renderTable();
  // evidenzia la riga duplicata
  setTimeout(function(){
    var tr=document.querySelector('#tb tr[data-idx="'+(i+1)+'"]');
    if(tr){tr.style.background='#fef9c3';setTimeout(function(){tr.style.background='';},1200);}
  },50);
}

function backupJSON(){
  var data={
    version:1,
    date:new Date().toISOString(),
    nome:document.getElementById('fn').value,
    rows:rows,
    removed:removed.slice(),
    cestino:cestino,
    history:lsGet(HK,[])
  };
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='backup_cartellini_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}

function restoreJSON(e){
  var f=e.target.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(ev){
    try{
      var data=JSON.parse(ev.target.result);
      if(!data.rows||!Array.isArray(data.rows)) throw new Error('File non valido');
      showConfirm('Ripristinare il backup del '+new Date(data.date).toLocaleDateString('it-IT')+'?\nSovrascriver- i dati correnti.', function(){
        rows=data.rows;
        removed=new Set(data.removed||[]);
        cestino=data.cestino||[];
        if(data.history) lsSet(HK,data.history);
        if(data.nome) document.getElementById('fn').value=data.nome;
        lsSet(RK,removed.slice());
        lsSet(CK,cestino);
        save(); renderTable(); genTags(); updateBadge(); goTab('t1');
        showToastGen('green','- Backup ripristinato! '+rows.length+' articoli caricati');
      });
    }catch(err){ showToastGen('red','- Errore: '+err.message); }
  };
  r.readAsText(f,'UTF-8');
  e.target.value='';
}
