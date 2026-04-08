// database.magazzino.js - estratto da database.js

// [SECTION: MAGAZZINO] -----------------------------------------------------
//  Inventario, scorte, soglie, movimenti qty, categorie, magazzino
var invSottoScorta=false;
var invGiornalino=false;

function filterSottoScorta(){
  invSottoScorta=!invSottoScorta;
  var btn=document.getElementById('inv-scorta-btn');
  if(btn){
    btn.style.background=invSottoScorta?'#e53e3e':'#1e1e1e';
    btn.style.color=invSottoScorta?'#fff':'var(--muted)';
    btn.style.borderColor=invSottoScorta?'#e53e3e':'var(--border)';
  }
  renderInventario();
}

function filterGiornalino(){
  invGiornalino=!invGiornalino;
  var btn=document.getElementById('inv-giorn-btn');
  if(btn){
    btn.style.background=invGiornalino?'#805ad5':'#1e1e1e';
    btn.style.color=invGiornalino?'#fff':'var(--muted)';
    btn.style.borderColor=invGiornalino?'#805ad5':'var(--border)';
  }
  renderInventario();
}

function renderInventario(){
  var search=(document.getElementById('inv-search')||{}).value||'';
  var catFilter=(document.getElementById('inv-cat-filter')||{}).value||'';
  var body=document.getElementById('inv-body');
  var statsEl=document.getElementById('inv-stats');
  if(!body) return;

  // Popola filtro cat se vuoto
  var sel=document.getElementById('inv-cat-filter');
  if(sel && sel.options.length<=1){
    categorie.forEach(function(cat){
      var opt=document.createElement('option');
      opt.value=cat.id; opt.textContent=cat.nome; sel.appendChild(opt);
    });
  }

  var tot=0,totVal=0,sottoScorta=0;
  var html='';
  var _invShown=0;
  var _invCap=300;

  // Se il database non è ancora caricato da Firebase, mostra messaggio
  if(!rows || !rows.length){
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--accent);font-size:14px;">⏳ Database in caricamento, attendere...</td></tr>';
    return;
  }

  rows.forEach(function(r,i){
    if(!r)return;
    if(removed.has(String(i))) return;
    var m=magazzino[i]||{};
    var catId=m.cat||'';

    // filtri
    if(catFilter && catId!==catFilter) return;
    // Protezione null/undefined su codF, codM, desc
    var haystack=[r.desc||'',String(r.codF||''),String(r.codM||''),m.marca||'',m.specs||''].join(' ');
    if(search && !fuzzyMatch(search,haystack)) return;

    var soglia=getSoglia(i);
    var qty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    var isLow=qty!==null&&qty<=soglia;
    if(invSottoScorta && !isLow) return;

    tot++;
    var prezzo=(r.prezzo);
    if(qty!==null) totVal+=prezzo*qty;
    if(isLow) sottoScorta++;

    var catLabel='';
    if(catId){var cf=categorie.find(function(x){return x.id===catId;});catLabel=cf?cf.nome:'';}
    var sub=m.subcat||'';
    var unit=m.unit||'pz';
    var specs=m.specs||'';
    var pos=m.posizione||'';
    var marca=m.marca||'';
    var rowBg=isLow?'rgba(229,62,62,0.08)':'';
    var borderL=isLow?'border-left:3px solid #e53e3e;':'border-left:3px solid transparent;';

    var prezzoAcq=m.prezzoAcquisto||'';
    if(_invShown>=_invCap && !search && !catFilter) return;
    _invShown++;
    html+='<tr style="border-bottom:1px solid var(--border);'+borderL+'background:'+rowBg+';cursor:pointer;" onclick="openSchedaProdotto('+i+')" title="Clicca per modificare">';
    // 1. Descrizione + marca
    html+='<td style="padding:8px 6px;">';
    html+='<div style="font-size:12px;font-weight:600;color:var(--text);">'+(r.desc||'-')+'</div>';
    if(marca) html+='<div style="font-size:10px;color:var(--muted);">- '+esc(marca)+'</div>';
    html+='</td>';
    // 2. Specifiche tecniche
    html+='<td style="padding:8px 6px;font-size:11px;color:#2dd4bf;font-style:italic;">'+esc(specs)+'</td>';
    // 3. Codice fornitore
    html+='<td style="padding:8px 6px;font-size:11px;color:#fc8181;font-weight:600;">'+esc(r.codF||'-')+'</td>';
    // 4. Mio codice
    html+='<td style="padding:8px 6px;font-size:11px;color:var(--accent);font-weight:600;">'+esc(r.codM||'-')+'</td>';
    // 5. Quantit- + e -
    html+='<td style="padding:8px 6px;text-align:center;white-space:nowrap;">';
    html+='<button onclick="event.stopPropagation();deltaQta('+i+',-1)" style="background:#333;border:none;color:var(--text);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;">-</button> ';
    html+='<input type="number" min="0" value="'+(qty!==null?qty:'')+'" placeholder="-" onclick="event.stopPropagation()" '+
      'style="width:44px;padding:3px 2px;border:1px solid '+(isLow?'#e53e3e':'var(--border)')+';border-radius:5px;background:#111;color:'+(isLow?'#e53e3e':'var(--accent)')+';font-size:13px;font-weight:900;text-align:center;" '+
      'onchange="event.stopPropagation();saveQta('+i+',this.value)" id="inv-qty-'+i+'"> ';
    html+='<button onclick="event.stopPropagation();deltaQta('+i+',1)" style="background:#333;border:none;color:var(--text);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;">+</button>';
    html+='<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+ '<button onclick="event.stopPropagation();openMovProdotto('+i+')" style="background:none;border:none;color:#3182ce;font-size:10px;cursor:pointer;padding:0;" title="Storico movimenti">-</button> ' +esc(unit)+(isLow?' <span style="color:#e53e3e;font-weight:700;">-- min:'+soglia+'</span>':'')+'</div>';
    html+='</td>';
    // 6. Prezzo vendita
    html+='<td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:900;color:var(--accent);">- '+esc(r.prezzo)+'</td>';
    // 7. Prezzo acquisto - discreto, non visibile a occhi estranei
    html+='<td style="padding:8px 6px;text-align:right;" onclick="event.stopPropagation();">';
    html+='<input type="text" value="'+esc(prezzoAcq)+'" placeholder="-" onclick="event.stopPropagation()" '+
      'style="width:52px;padding:3px 5px;border:1px solid #333;border-radius:5px;background:#0d0d0d;color:#555;font-size:11px;text-align:right;font-style:italic;" '+
      'title="Prezzo acquisto (riservato)" '+
      'onchange="event.stopPropagation();saveMagRow('+i+',\'prezzoAcquisto\',this.value)">';
    html+='</td>';
    // 8. Posizione
    html+='<td style="padding:8px 6px;font-size:11px;color:#888;font-style:italic;">'+esc(pos)+'</td>';
    // 9. Categoria in fondo piccola
    html+='<td style="padding:8px 6px;">';
    if(catLabel) html+='<div style="font-size:10px;color:var(--accent);">'+esc(catLabel)+'</div>';
    if(sub) html+='<div style="font-size:10px;color:#555;">'+esc(sub)+'</div>';
    html+='</td>';
    html+='</tr>';
  });

  if(!html) html='<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--muted);">- Nessun prodotto trovato.</td></tr>';
  body.innerHTML=html;

  if(statsEl) statsEl.innerHTML=
    '<div class="sc"><span class="n">'+tot+'</span>Prodotti</div>'+
    '<div class="sc g"><span class="n" style="color:#68d391">- '+totVal.toFixed(2)+'</span>Valore</div>'+
    (sottoScorta?'<div class="sc r"><span class="n" style="color:#e53e3e">'+sottoScorta+'</span>Sotto scorta</div>':'');
}

function deltaQta(i,delta){
  if(!magazzino[i]) magazzino[i]={};
  var cur=magazzino[i].qty!==undefined&&magazzino[i].qty!==''?Number(magazzino[i].qty):0;
  var nv=Math.max(0,cur+delta);
  var prevQty=cur;
  magazzino[i].qty=nv;
  lsSet(MAGK,magazzino);
  updateStockBadge();
  checkScorta(i, nv, prevQty);
  var tipoMov = delta < 0 ? 'vendita' : 'carico';
  registraMovimento(i, tipoMov, delta, prevQty, nv, '');
  var soglia=getSoglia(i);
  var isLow=nv<=soglia;
  // aggiorna input in entrambe le tabelle
  ['inv-qty-'+i,'tb-qty-'+i].forEach(function(id){
    var inp=document.getElementById(id);
    if(inp){
      inp.value=nv;
      inp.style.color=isLow?'#e53e3e':'var(--accent)';
      inp.style.borderColor=isLow?'#e53e3e':'var(--border)';
    }
  });
  // re-render solo la tab attiva
  var t0=document.getElementById('t0');
  if(t0&&t0.classList.contains('active')) renderInventario();
}

// -- SCHEDA PRODOTTO dal Magazzino -----------------------------------------
function openSchedaProdotto(i){
  openEditProdotto(i);
}

// Filtro sotto scorta nel magazzino
var magSottoScorta=false;
function toggleMagSottoScorta(){
  magSottoScorta=!magSottoScorta;
  var btn=document.getElementById('mag-scorta-btn');
  if(btn){
    btn.style.background=magSottoScorta?'#e53e3e':'#1e1e1e';
    btn.style.color=magSottoScorta?'#fff':'var(--muted)';
    btn.style.borderColor=magSottoScorta?'#e53e3e':'var(--border)';
  }
  renderMagazzino();
}

// -----------------------------------------------
//  MAGAZZINO
// -----------------------------------------------

function getCatLabel(r){
  // magazzino[idx].cat e magazzino[idx].subcat
  var m=magazzino[r._idx]||{};
  var cat=m.cat||'';
  var sub=m.subcat||'';
  return cat?(sub?cat+' - '+sub:cat):'-';
}

var magMode='prod'; // 'prod' o 'spec'
function setMagMode(mode){
  magMode=mode;
  var bp=document.getElementById('mag-mode-prod');
  var bs=document.getElementById('mag-mode-spec');
  if(bp&&bs){
    if(mode==='prod'){
      bp.style.background='var(--accent)'; bp.style.color='#111'; bp.style.borderColor='var(--accent)';
      bs.style.background='#1e1e1e'; bs.style.color='var(--muted)'; bs.style.borderColor='var(--border)';
      document.getElementById('mag-search').placeholder='- Cerca prodotto, codice...';
    } else {
      bs.style.background='var(--accent)'; bs.style.color='#111'; bs.style.borderColor='var(--accent)';
      bp.style.background='#1e1e1e'; bp.style.color='var(--muted)'; bp.style.borderColor='var(--border)';
      document.getElementById('mag-search').placeholder='- Cerca nelle specifiche tecniche...';
    }
  }
  renderMagazzino();
}

// Ricerca fuzzy intelligente: matcha anche parole parziali e ordine diverso
function fuzzyMatch(query, target){
  if(!query) return true;
  var q=query.toLowerCase().trim();
  var t=(target||'').toLowerCase();
  // Match esatto sottostringa
  if(t.indexOf(q)>=0) return true;
  // Match per parole singole: ogni parola della query deve apparire nel testo
  var words=q.split(/\s+/).filter(Boolean);
  return words.every(function(w){ return t.indexOf(w)>=0; });
}

function renderMagazzino(){
  var search=(document.getElementById('mag-search')||{}).value||'';
  var catFilter=(document.getElementById('mag-cat-filter')||{}).value||'';
  var list=document.getElementById('mag-list');
  var statsEl=document.getElementById('mag-stats');
  if(!list) return;

  // Popola filtro categorie
  var sel=document.getElementById('mag-cat-filter');
  if(sel && sel.options.length<=1){
    categorie.forEach(function(cat){
      var opt=document.createElement('option');
      opt.value=cat.id; opt.textContent=cat.nome;
      sel.appendChild(opt);
    });
  }

  // Raggruppa per categoria
  var grouped={};
  var totalProd=0, totalCat=new Set();

  // Database non ancora caricato
  if(!rows||!rows.length){
    list.innerHTML='<div style="text-align:center;padding:40px;color:var(--accent);font-size:14px;">⏳ Database in caricamento, attendere...</div>';
    return;
  }

  rows.forEach(function(r,i){
    if(!r)return;
    if(removed.has(String(i))) return;
    var m=magazzino[i]||{};
    var catId=m.cat||'__nessuna__';
    // Filtro intelligente per modalit-
    if(search){
      if(magMode==='prod'){
        // Cerca in descrizione + codici — protezione null
        var haystack=[r.desc||'',String(r.codF||''),String(r.codM||''),m.marca||''].join(' ');
        if(!fuzzyMatch(search, haystack)) return;
      } else {
        // Cerca solo nelle specifiche tecniche
        var haystack=m.specs||'';
        if(!fuzzyMatch(search, haystack)) return;
      }
    }
    if(catFilter && catId!==catFilter) return;
    if(!grouped[catId]) grouped[catId]=[];
    var soglia=getSoglia(i);
    var qty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    var isLow=qty!==null&&qty<=soglia;
    grouped[catId].push({r:r,i:i,m:m,isLow:isLow});
    totalProd++;
    if(catId!=='__nessuna__') totalCat.add(catId);
  });

  // Stats
  statsEl.innerHTML=
    '<div class="sc"><span class="n">'+totalProd+'</span>Prodotti</div>'+
    '<div class="sc g"><span class="n" style="color:#68d391">'+totalCat.size+'</span>Categorie</div>'+
    '<div class="sc o"><span class="n" style="color:#f6ad55">'+(grouped['__nessuna__']?grouped['__nessuna__'].length:0)+'</span>Senza cat.</div>';

  if(totalProd===0){
    list.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);">- Nessun prodotto trovato.</div>';
    return;
  }

  var html='';
  // Prima le categorie note, poi __nessuna__
  var orderedKeys=Object.keys(grouped).filter(function(k){return k!=='__nessuna__';});
  orderedKeys.sort(function(a,b){
    var na=catNome(a), nb=catNome(b);
    return na.localeCompare(nb);
  });
  if(grouped['__nessuna__']) orderedKeys.push('__nessuna__');

  orderedKeys.forEach(function(catId){
    var items=grouped[catId];
    var catLabel=catId==='__nessuna__'?'- Senza categoria':('- '+catNome(catId));
    html+='<div style="margin-bottom:18px;">';
    html+='<div style="font-size:13px;font-weight:700;color:var(--accent);padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:8px;">'+catLabel+' <span style="font-size:11px;color:var(--muted);font-weight:400;">('+items.length+')</span></div>';
    items.forEach(function(o){
      var r=o.r,i=o.i,m=o.m,isLow=o.isLow;
      var qty=m.qty||'';
      var unit=m.unit||'pz';
      var sub=m.subcat||'';
      var marca=m.marca||'';
      var specs=m.specs||'';
      var borderCol=isLow?'#e53e3e':'var(--border)';
      html+='<div style="background:#1e1e1e;border:1px solid '+borderCol+';border-radius:8px;padding:10px 12px;margin-bottom:8px;'+( isLow?'box-shadow:0 0 0 1px #e53e3e33;':'')+'">';
      html+='<div id="mag-scorta-badge-'+i+'" style="background:#e53e3e;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px;display:'+(isLow?'inline-block':'none')+';">'+(isLow?'- SCORTA BASSA - '+qty+' '+unit+' (min: '+m.soglia+')':'')+'</div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">';
      html+='<div style="flex:1;min-width:0;">';
      html+='<div style="font-size:12px;font-weight:700;color:var(--text);">'+(r.desc||'')+'</div>';
      html+='<div style="font-size:10px;color:var(--muted);margin-top:2px;">';
      if(sub) html+='<span style="color:var(--accent);font-size:10px;">'+sub+'</span> - ';
      if(marca) html+='- '+marca+' - ';
      html+='<span style="color:#fc8181;font-weight:600;">'+(r.codF||'-')+'</span>'+'<span style="color:#888;"> / </span>'+'<span style="color:var(--accent);font-weight:600;">'+(r.codM||'-')+'</span>';
      html+='</div>';
      if(specs) html+='<div style="font-size:11px;color:#aaa;margin-top:4px;font-style:italic;">- '+specs+'</div>';
      html+='</div>';
      // Colonna destra: foto (sempre visibile in cima) + prezzo + qt-
      var hasFotoTop=Object.prototype.hasOwnProperty.call(_idbCache,i)&&!!_idbCache[i];
      html+='<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">';
      // FOTO in cima a destra - sempre visibile
      if(hasFotoTop){
        html+='<img src="'+_idbCache[i]+'" onclick="magZoomFoto('+i+')" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--accent);cursor:pointer;" title="Tocca per ingrandire">';
        html+='<button onclick="magRimoviFoto('+i+')" style="font-size:9px;color:#e53e3e;background:transparent;border:none;cursor:pointer;padding:0;">- rimuovi</button>';
      } else {
        html+='<button onclick="document.getElementById(\'mag-foto-inp-'+i+'\').click()" style="width:52px;height:52px;border-radius:8px;border:1px dashed #444;background:#111;color:#555;font-size:10px;cursor:pointer;line-height:1.3;">-<br>foto</button>';
        html+='<input type="file" id="mag-foto-inp-'+i+'" accept="image/*" capture="environment" style="display:none;" onchange="magSalvaFoto('+i+',this)">';
      }
      html+='<div style="font-size:15px;font-weight:900;color:var(--accent);">- '+r.prezzo+'</div>';
      html+='<div style="display:flex;gap:3px;align-items:center;">';
      html+='<input type="number" min="0" value="'+esc(qty)+'" placeholder="Qt-" '+
        'style="width:58px;padding:4px 6px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:13px;font-weight:700;text-align:center;" '+
        'onchange="saveQta('+i+',this.value)" oninput="saveQta('+i+',this.value)">';
      html+='<select style="width:52px;padding:4px 4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--accent);font-size:11px;margin-left:3px;" onchange="saveMagRow('+i+',\'unit\',this.value)">';
      ['pz','mt','kg','lt','conf','rot','sc'].forEach(function(u){
        html+='<option'+(unit===u?' selected':'')+'>'+u+'</option>';
      });
      html+='</select>';
      html+='</div>'; // fine flex qt-+unit-
      html+='</div>'; // fine colonna destra
      html+='</div>'; // fine flex principale card
      // Riga dettagli
      html+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;">';
      html+='<select style="flex:1;min-width:130px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" onchange="saveMagRow('+i+',\'cat\',this.value);renderMagazzino();">';
      html+='<option value="">- Categoria -</option>';
      categorie.forEach(function(cat){
        html+='<option value="'+cat.id+'"'+(m.cat===cat.id?' selected':'')+'>'+cat.nome+'</option>';
      });
      html+='</select>';
      // Sotto-categoria dinamica
      var subsForCat=[];
      if(m.cat){var cf=categorie.find(function(x){return x.id===m.cat;});if(cf)subsForCat=cf.sub||[];}
      html+='<select style="flex:1;min-width:130px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" onchange="saveMagRow('+i+',\'subcat\',this.value)">';
      html+='<option value="">- Sotto-categoria -</option>';
      subsForCat.forEach(function(s){
        html+='<option'+(m.subcat===s?' selected':'')+'>'+s+'</option>';
      });
      html+='</select>';
      html+='<input type="text" placeholder="- Marca" value="'+esc(marca)+'" '+
        'style="width:100px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" '+
        'onchange="saveMagRow('+i+',\'marca\',this.value)">';
      html+='</div>';
      html+='<input type="text" placeholder="- Specifiche tecniche (es: M6x30, IP44, 1000W...)" value="'+esc(specs)+'" '+
        'style="width:100%;margin-top:6px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:#111;color:#aaa;font-size:11px;font-style:italic;" '+
        'onchange="saveMagRow('+i+',\'specs\',this.value)">';
      html+='<button onclick="openEditProdotto('+i+')" style="margin-top:8px;width:100%;padding:7px;border-radius:7px;border:1px solid var(--accent)44;background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;">-- Modifica articolo</button>';
          });
    html+='</div>';
  });

  list.innerHTML=html;
}

function catNome(id){
  var c=categorie.find(function(x){return x.id===id;});
  return c?c.nome:id;
}

var _saveMagTimer=null;
// -- FOTO ARTICOLO ---------------------------------------------------------
function magSalvaFoto(i, input){
  if(!input.files||!input.files[0]) return;
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var MAX=400;
      var w=img.width, h=img.height;
      if(w>MAX||h>MAX){ var r=Math.min(MAX/w,MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
      var cv=document.createElement('canvas');
      cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      var dataURL=cv.toDataURL('image/jpeg',0.75);
      idbSalvaFoto(i, dataURL); // IndexedDB, non localStorage
      renderMagazzino();
      showToastGen('green','- Foto salvata');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}
function magRimoviFoto(i){
  idbRimoviFoto(i);
  renderMagazzino();
  showToastGen('green','- Foto rimossa');
}
function magZoomFoto(i){
  idbGetFoto(i).then(function(foto){
    if(!foto) return;
    _mostraOverlayFotoSpecifiche(i, foto);
  });
}

function _mostraOverlayFotoSpecifiche(i, foto){
  var m=magazzino[i]||{};
  var r=rows[i]||{};
  var ov=document.getElementById('_foto-zoom-ov');
  if(!ov){
    ov=document.createElement('div');
    ov.id='_foto-zoom-ov';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;';
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML='';
  // Bottone chiudi
  var closeBtn=document.createElement('button');
  closeBtn.textContent='-';
  closeBtn.style.cssText='position:absolute;top:12px;right:16px;background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;z-index:2;';
  closeBtn.onclick=function(){ ov.remove(); };
  ov.appendChild(closeBtn);
  // Immagine (se presente)
  if(foto){
    var img=document.createElement('img');
    img.src=foto;
    img.style.cssText='max-width:100%;max-height:45vh;object-fit:contain;border-radius:10px;margin-bottom:14px;';
    ov.appendChild(img);
  } else {
    // Bottone aggiunta foto
    var addFotoLbl=document.createElement('label');
    addFotoLbl.style.cssText='display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:8px;border:1px dashed #444;color:#555;font-size:13px;cursor:pointer;margin-bottom:14px;';
    addFotoLbl.innerHTML='- Aggiungi foto';
    var addFotoInp=document.createElement('input');
    addFotoInp.type='file'; addFotoInp.accept='image/*'; addFotoInp.capture='environment';
    addFotoInp.style.display='none';
    addFotoInp.onchange=function(){ magSalvaFoto(i, addFotoInp); ov.remove(); };
    addFotoLbl.appendChild(addFotoInp);
    ov.appendChild(addFotoLbl);
  }
  // Scheda specifiche
  var info=document.createElement('div');
  info.style.cssText='width:100%;max-width:400px;background:#1c1c1c;border-radius:10px;padding:12px 14px;';
  var specs=[
    r.desc?('<b style="font-size:14px;color:#f0f0f0;">'+esc(r.desc)+'</b>'):'',
    r.codM?('<span style="color:var(--accent);font-size:11px;">'+esc(r.codM)+'</span>'):'',
    r.codF?('<span style="color:#fc8181;font-size:11px;">'+esc(r.codF)+'</span>'):'',
    m.marca?('<span style="color:#a0aec0;font-size:11px;">- '+esc(m.marca)+'</span>'):'',
    m.specs?('<div style="color:#2dd4bf;font-size:12px;margin-top:6px;">'+esc(m.specs)+'</div>'):'',
    m.subcat?('<span style="color:#888;font-size:11px;">- '+esc(m.subcat)+'</span>'):'',
    r.prezzo?('<div style="color:var(--accent);font-size:16px;font-weight:900;margin-top:8px;">- '+esc(r.prezzo)+'</div>'):'',
    m.qty!==undefined&&m.qty!==''?('<span style="color:#68d391;font-size:11px;">- Scorta: '+m.qty+' '+(m.unit||'pz')+'</span>'):'',
  ].filter(Boolean).join('<br>');
  info.innerHTML=specs;
  ov.appendChild(info);
}

// Mostra overlay foto+specifiche da carrello/ordini (passa rowIdx)
function mostraFotoSpecifiche(rowIdx){
  idbGetFoto(rowIdx).then(function(foto){
    _mostraOverlayFotoSpecifiche(rowIdx, foto||null);
  });
}

function saveMagRow(i,field,val){
  if(!magazzino[i]) magazzino[i]={};
  _takeSnapshot();
  if(field==='qty'){
    var prevQty = magazzino[i].qty!==undefined&&magazzino[i].qty!=='' ? Number(magazzino[i].qty) : null;
    var newQty  = val!=='' ? parseFloat(val) : null;
    magazzino[i].qty = newQty;
    lsSet(MAGK,magazzino);
    updateStockBadge();
    if(newQty!==null && prevQty!==null && newQty!==prevQty){
      var delta=newQty-prevQty;
      var tipo=delta<0?'vendita':'carico';
      checkScorta(i, newQty, prevQty);
      registraMovimento(i, tipo, delta, prevQty, newQty, 'modifica magazzino');
    } else if(newQty!==null && prevQty===null){
      checkScorta(i, newQty, null);
    }
    // Aggiorna visuale scorta nella riga senza perdere il focus
    _updateMagQtyRow(i, newQty);
  } else {
    magazzino[i][field]=val;
    lsSet(MAGK,magazzino);
    if(field==='cat'){
      // ri-render dopo cambio categoria (gi- chiamato nel template)
    }
  }
}

function _updateMagQtyRow(i, qty){
  // Aggiorna solo l'indicatore scorta nella riga senza re-render completo
  var soglia=getSoglia(i);
  var isLow = qty!==null && qty<=soglia;
  var badge = document.getElementById('mag-scorta-badge-'+i);
  if(badge){
    if(isLow){
      badge.textContent='- SCORTA BASSA - '+qty+' '+(magazzino[i].unit||'pz')+' (min: '+(magazzino[i].soglia||0)+')';
      badge.style.display='inline-block';
    } else {
      badge.style.display='none';
    }
  }
}

// -- QUANTIT- NELLA TAB DATI ----------------------------------------------
function buildQtaCell(i){
  var m=magazzino[i]||{};
  var qty=m.qty!==undefined&&m.qty!==''?m.qty:'';
  var unit=m.unit||'pz';
  var soglia=m.soglia!==undefined&&m.soglia!==''?Number(m.soglia):null;
  var isLow=soglia!==null && qty!=='' && Number(qty)<=soglia && Number(qty)>=0;
  var col=isLow?'#e53e3e':'var(--accent)';
  var html='<input type="number" min="0" value="'+esc(String(qty))+'" placeholder="-" '+
    'style="width:42px;padding:3px 4px;border:1px solid '+(isLow?'#e53e3e':'var(--border)')+';border-radius:5px;'+
    'background:#111;color:'+col+';font-size:12px;font-weight:700;text-align:center;" '+
    'onchange="saveQta('+i+',this.value)" oninput="saveQta('+i+',this.value)"> '+
    '<button onclick="openSoglia('+i+')" title="Imposta soglia scorta minima" '+
    'style="background:none;border:none;cursor:pointer;font-size:11px;padding:1px 2px;">'+
    (isLow?'-':(soglia!==null?'-':'-'))+'</button>';
  return html;
}

function saveQta(i,val){
  if(!magazzino[i]) magazzino[i]={};
  var prevQty=magazzino[i].qty!==undefined&&magazzino[i].qty!==''?Number(magazzino[i].qty):null;
  magazzino[i].qty=val;
  lsSet(MAGK,magazzino);
  updateStockBadge();
  var numVal=val!==''?Number(val):null;
  checkScorta(i, numVal, prevQty);
  if(numVal !== null){
    var prevForMov = prevQty !== null ? prevQty : 0;
    var deltaMov = numVal - prevForMov;
    if(deltaMov !== 0){
      var tipoSQ = deltaMov < 0 ? 'vendita' : 'carico';
      registraMovimento(i, tipoSQ, deltaMov, prevQty, numVal, 'modifica manuale');
    }
  }
  var soglia=getSoglia(i);
  var isLow=numVal!==null&&numVal<=soglia;
  ['inv-qty-'+i,'tb-qty-'+i].forEach(function(id){
    var inp=document.getElementById(id);
    if(inp){
      inp.value=val;
      inp.style.color=isLow?'#e53e3e':'var(--accent)';
      inp.style.borderColor=isLow?'#e53e3e':'var(--border)';
    }
  });
}

// -- SOGLIA SCORTA MINIMA -------------------------------------------------
var sogliaIdx=null;
function openSoglia(i){
  sogliaIdx=i;
  var m=magazzino[i]||{};
  _sogliaSnapshot=m.soglia;
  document.getElementById('sq-desc').textContent=rows[i]?rows[i].desc||'':'';
  document.getElementById('sq-val').value=m.soglia!==undefined?m.soglia:'';
  document.getElementById('sq').classList.add('open');
}
function saveSoglia(){
  if(sogliaIdx===null) return;
  if(!magazzino[sogliaIdx]) magazzino[sogliaIdx]={};
  var v=document.getElementById('sq-val').value.trim();
  magazzino[sogliaIdx].soglia=v===''?'':Number(v);
  lsSet(MAGK,magazzino);
  updateStockBadge();
  // aggiorna cella qt- nella tabella
  // aggiorna colore input qt- se sotto soglia
  var sv2=magazzino[sogliaIdx].soglia;
  var qv=magazzino[sogliaIdx].qty;
  var isLow2=sv2!==''&&sv2!==undefined&&qv!==undefined&&qv!==''&&Number(qv)<=Number(sv2);
  ['tb-qty-'+sogliaIdx,'inv-qty-'+sogliaIdx].forEach(function(id){
    var inp=document.getElementById(id);
    if(inp){
      inp.style.color=isLow2?'#e53e3e':'var(--accent)';
      inp.style.borderColor=isLow2?'#e53e3e':'var(--border)';
    }
  });
  _sogliaSnapshot=null;
  document.getElementById('sq').classList.remove('open');
  sogliaIdx=null;
}
function closeSoglia(){
  if(_sogliaSnapshot!==undefined && sogliaIdx!==null){
    if(!magazzino[sogliaIdx]) magazzino[sogliaIdx]={};
    magazzino[sogliaIdx].soglia=_sogliaSnapshot;
    lsSet(MAGK,magazzino);
    updateStockBadge();
  }
  _sogliaSnapshot=null;
  document.getElementById('sq').classList.remove('open');
  sogliaIdx=null;
}

// -- BADGE SCORTE BASSE ---------------------------------------------------
function updateStockBadge(){
  var count=0;
  rows.forEach(function(r,i){
    if(removed.has(String(i))) return;
    var m=magazzino[i]||{};
    var soglia=m.soglia!==undefined&&m.soglia!==''?Number(m.soglia):null;
    var qty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    if(soglia!==null && qty!==null && qty<=soglia) count++;
  });
  var badge=document.getElementById('stock-badge');
  if(badge){
    if(count>0){badge.textContent=count;badge.style.display='';}
    else{badge.style.display='none';}
  }
}

// -----------------------------------------------
//  CATEGORIE - ALBERO
// -----------------------------------------------

function renderCatTree(){
  var el=document.getElementById('cat-tree');
  if(!el) return;
  var html='';
  categorie.forEach(function(cat,ci){
    html+='<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;">';
    html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html+='<span style="font-size:14px;">-</span>';
    html+='<input type="text" value="'+esc(cat.nome)+'" '+
      'style="flex:1;font-size:13px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 4px;" '+
      'onchange="renameCategoria('+ci+',this.value)">';
    html+='<button style="background:none;border:none;color:#e53e3e;font-size:16px;cursor:pointer;padding:4px;" onclick="deleteCategoria('+ci+')" title="Elimina categoria">--</button>';
    html+='</div>';
    // Sotto-categorie
    html+='<div style="padding-left:20px;">';
    cat.sub.forEach(function(sub,si){
      html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">';
      html+='<span style="color:var(--muted);font-size:12px;">-</span>';
      html+='<input type="text" value="'+esc(sub)+'" '+
        'style="flex:1;font-size:12px;background:transparent;border:none;border-bottom:1px solid #333;color:#aaa;padding:2px 4px;" '+
        'onchange="renameSub('+ci+','+si+',this.value)">';
      html+='<button style="background:none;border:none;color:#e53e3e;font-size:13px;cursor:pointer;padding:2px 5px;" onclick="deleteSub('+ci+','+si+')">-</button>';
      html+='</div>';
    });
    html+='<div style="display:flex;gap:6px;margin-top:8px;">';
    html+='<input type="text" id="newsub-'+ci+'" placeholder="Nuova sotto-categoria..." '+
      'style="flex:1;font-size:12px;padding:5px 8px;border:1px solid #333;border-radius:6px;background:#111;color:var(--text);">';
    html+='<button style="background:var(--accent);color:#111;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;" onclick="addSub('+ci+')">+ Sub</button>';
    html+='</div>';
    html+='</div>';
    html+='</div>';
  });
  el.innerHTML=html;
}

function addCategoria(){
  var inp=document.getElementById('new-cat-nome');
  var nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  var id='cat_'+Date.now();
  categorie.push({id:id,nome:nome,sub:[]});
  lsSet(CATK,categorie);
  inp.value='';
  renderCatTree();
}

function deleteCategoria(ci){
  showConfirm('Eliminare la categoria "' + categorie[ci].nome + '"?', function(){

  var id=categorie[ci].id;
  categorie.splice(ci,1);
  lsSet(CATK,categorie);
  // rimuovi dai magazzino
  Object.keys(magazzino).forEach(function(k){if(magazzino[k].cat===id){magazzino[k].cat='';magazzino[k].subcat='';}});
  lsSet(MAGK,magazzino);
  renderCatTree();

  });
}

function renameCategoria(ci,val){
  categorie[ci].nome=val.trim();
  lsSet(CATK,categorie);
}

function addSub(ci){
  var inp=document.getElementById('newsub-'+ci);
  var nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  categorie[ci].sub.push(nome);
  lsSet(CATK,categorie);
  renderCatTree();
}

function deleteSub(ci,si){
  categorie[ci].sub.splice(si,1);
  lsSet(CATK,categorie);
  renderCatTree();
}

function renameSub(ci,si,val){
  categorie[ci].sub[si]=val.trim();
  lsSet(CATK,categorie);
}



// -----------------------------------------------------------------------
