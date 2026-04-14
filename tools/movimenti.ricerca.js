// movimenti.ricerca.js - estratto da movimenti.js

// -- Sistema ricerca globale (pannello #rg-panel - bottone - in header) ----
var _rGlobaleOpen = false;

function toggleRicercaGlobale() {
  var panel = document.getElementById('rg-panel');
  if (!panel) return;
  _rGlobaleOpen = !_rGlobaleOpen;
  panel.style.display = _rGlobaleOpen ? 'block' : 'none';
  if (_rGlobaleOpen) {
    var inp = document.getElementById('rg-input');
    if (inp) { inp.value = ''; inp.focus(); }
    var res = document.getElementById('rg-results');
    if (res) res.innerHTML = '<div style="color:#555;font-size:12px;font-style:italic;padding:12px">Scrivi almeno 2 caratteri-</div>';
  }
}

function eseguiRicercaGlobale() {
  var inp = document.getElementById('rg-input');
  if (!inp) return;
  var q = inp.value.trim().toLowerCase();
  var el = document.getElementById('rg-results');
  if (!el) return;
  if (q.length < 2) {
    el.innerHTML = '<div style="color:#555;font-size:12px;font-style:italic;padding:12px">Scrivi almeno 2 caratteri-</div>';
    return;
  }
  var hits = [];
  // - Inventario -
  rows.forEach(function (r, i) {
    if (removed.has(String(i))) return;
    var m = magazzino[i] || {};
    var hay = [r.desc, r.codF, r.codM, m.marca, m.specs, m.posizione, m.nomeFornitore].join(' ').toLowerCase();
    if (hay.indexOf(q) < 0) return;
    hits.push({ tipo: 'inv', label: r.desc || '-', sub: (r.codF || '') + (m.nomeFornitore ? ' - ' + m.nomeFornitore : ''), action: 'openSchedaProdotto(' + i + ');toggleRicercaGlobale()' });
  });
  // - Ordini -
  ordini.forEach(function (o) {
    var hay = [o.nomeCliente, o.nota].concat((o.items || []).map(function (it) { return (it.desc || '') + ' ' + (it.codF || ''); })).join(' ').toLowerCase();
    if (hay.indexOf(q) < 0) return;
    hits.push({ tipo: 'ord', label: 'Ordine ' + (o.nomeCliente || 'senza nome'), sub: o.data || '', action: 'goTab(\'to\');toggleRicercaGlobale()' });
  });
  // - Movimenti -
  movimenti.forEach(function (mv) {
    var hay = [mv.desc, mv.codF, mv.note, mv.tipo].join(' ').toLowerCase();
    if (hay.indexOf(q) < 0) return;
    hits.push({ tipo: 'mov', label: mv.desc || '-', sub: mv.data + ' - ' + mv.tipo + ' ' + (mv.delta >= 0 ? '+' : '') + mv.delta, action: 'goTab(\'tmov\');toggleRicercaGlobale()' });
  });
  if (!hits.length) {
    el.innerHTML = '<div style="color:#555;font-size:12px;padding:12px">Nessun risultato per "<b>' + esc(q) + '</b>"</div>';
    return;
  }
  var groupOrder = { inv: 0, ord: 1, mov: 2 };
  var groupLabel = { inv: '- Inventario', ord: '- Ordini', mov: '- Movimenti' };
  var sections = {};
  hits.forEach(function (h) { if (!sections[h.tipo]) sections[h.tipo] = []; sections[h.tipo].push(h); });
  var hhtml = '';
  Object.keys(sections).sort(function (a, b) { return groupOrder[a] - groupOrder[b]; }).forEach(function (tipo) {
    hhtml += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:6px 10px 3px;border-top:1px solid var(--border);">' + groupLabel[tipo] + ' (' + sections[tipo].length + ')</div>';
    sections[tipo].slice(0, 20).forEach(function (h) {
      hhtml += '<div onclick="' + h.action + '" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid #222;display:flex;flex-direction:column;gap:1px;" onmouseover="this.style.background=\'#2a2a2a\'" onmouseout="this.style.background=\'\'">'; 
      hhtml += '<span style="font-size:12px;color:var(--text);font-weight:600">' + esc(h.label) + '</span>';
      if (h.sub) hhtml += '<span style="font-size:10px;color:var(--muted)">' + esc(h.sub) + '</span>';
      hhtml += '</div>';
    });
  });
  el.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:6px 10px;">' + hits.length + ' risultati</div>' + hhtml;
}



// ------------------------------------------------------------------
//  FEATURE 4 - Import da foto (AI OCR)
// ------------------------------------------------------------------
function apriFotoImport() {
  document.getElementById('foto-import-overlay').classList.add('open');
  document.getElementById('fi-preview').innerHTML = '<span style="color:#555">Nessuna foto selezionata</span>';
  document.getElementById('fi-result').innerHTML = '';
  document.getElementById('fi-file').value = '';
  document.getElementById('fi-url-input').value = '';
}

function chiudiFotoImport() {
  document.getElementById('foto-import-overlay').classList.remove('open');
}

function fotoImportPreview(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('fi-preview').innerHTML =
      '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border)">';
    document.getElementById('fi-imgdata').value = e.target.result;
  };
  reader.readAsDataURL(file);
}

function analisiFotoAI() {
  var imgData = document.getElementById('fi-imgdata') ? document.getElementById('fi-imgdata').value : '';
  if (!imgData) { showToastGen('blue', '\u26A0\uFE0F Prima seleziona una foto'); return; }
  var resultEl = document.getElementById('fi-result');
  resultEl.innerHTML = '<div style="color:#888;font-size:12px;padding:8px">\uD83E\uDD16 Analisi in corso\u2026</div>';

  var base64 = imgData.split(',')[1];
  var mediaType = imgData.split(';')[0].replace('data:', '');

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Sei un assistente per una ferramenta italiana. Analizza questa immagine di un cartellino/etichetta/prodotto e estrai le seguenti informazioni. Rispondi SOLO con un JSON valido senza nessun testo prima o dopo:\n{"desc":"descrizione prodotto","codF":"codice fornitore","codM":"mio codice","prezzo":"prezzo vendita (solo numero)","specs":"specifiche tecniche (misure, materiale...)","marca":"marca/produttore","nomeFornitore":"nome del fornitore se visibile"}\nSe un campo non e\' visibile usa stringa vuota.' }
        ]
      }]
    })
  })
  .then(function (res) { return res.json(); })
  .then(function (data) {
    var testo = (data.content || []).map(function (c) { return c.type === 'text' ? c.text : ''; }).join('');
    var clean = testo.replace(/```json|```/g, '').trim();
    var parsed;
    try { parsed = JSON.parse(clean); } catch (e) { throw new Error('JSON non valido: ' + clean.slice(0, 100)); }

    var fields = ['desc','codF','codM','prezzo','specs','marca','nomeFornitore'];
    var labels = { desc:'Descrizione', codF:'Cod. Fornitore', codM:'Mio Codice', prezzo:'Prezzo', specs:'Specifiche', marca:'Marca', nomeFornitore:'Fornitore' };
    var html = '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">\u2705 Dati estratti \u2014 modifica se necessario poi clicca <b>Crea articolo</b></div>';
    fields.forEach(function (k) {
      html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">';
      html += '<label style="font-size:10px;color:var(--muted);width:90px;flex-shrink:0">' + labels[k] + '</label>';
      html += '<input type="text" id="fi-f-' + k + '" value="' + esc(parsed[k] || '') + '" ';
      html += 'style="flex:1;padding:5px 7px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:12px">';
      html += '</div>';
    });
    html += '<button onclick="creaArticoloDaFoto()" style="width:100%;padding:10px;margin-top:8px;border-radius:8px;border:none;background:var(--accent);color:#111;font-size:14px;font-weight:900;cursor:pointer">\u2795 Crea articolo</button>';
    resultEl.innerHTML = html;
  })
  .catch(function (e) {
    resultEl.innerHTML = '<div style="color:#e53e3e;font-size:12px;padding:8px">\u274C Errore: ' + esc(String(e)) + '</div>';
  });
}

function creaArticoloDaFoto() {
  function gfi(k) { var el = document.getElementById('fi-f-' + k); return el ? el.value.trim() : ''; }
  var descNew = gfi('desc') || 'Nuovo articolo';
  showConfirm('⚠️ Aggiungere "' + descNew + '" come NUOVO articolo al database?', function(){
    var nr = {
      desc: descNew,
      codF: gfi('codF'), codM: gfi('codM'),
      prezzo: gfi('prezzo'), prezzoOld: '', note: '',
      giornalino: '', priceHistory: [],
      data: new Date().toLocaleDateString('it-IT'),
      size: autoSize(gfi('prezzo'))
    };
    rows.push(nr);
    var ni = rows.length - 1;
    magazzino[ni] = {
      specs: gfi('specs'), marca: gfi('marca'), nomeFornitore: gfi('nomeFornitore'),
      qty: 0, unit: 'pz', posizione: '', soglia: '', prezzoAcquisto: ''
    };
    lsSet(SK, rows); lsSet(MAGK, magazzino);
    chiudiFotoImport();
    renderInventario();
    setTimeout(function () { openEditProdotto(ni); }, 80);
    showToastGen('green', '\u2705 Articolo creato da foto!');
  });
}

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') {
    if(_rGlobaleOpen) { toggleRicercaGlobale(); return; }
    if(_globalSearchOpen) { closeGlobalSearch(); return; }
  }
});

// --- Ricerca Globale -------------------------------------------------------
var _globalSearchOpen = false;
var _globalSearchTimer = null;

function openGlobalSearch(){
  _globalSearchOpen = true;
  var overlay = document.getElementById('global-search-overlay');
  var inp = document.getElementById('global-search-input');
  if(overlay){ overlay.classList.add('open'); }
  if(inp){ inp.value=''; inp.focus(); }
  document.getElementById('global-search-results').innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Digita almeno 2 caratteri...</div>';
}

function closeGlobalSearch(){
  _globalSearchOpen = false;
  var overlay = document.getElementById('global-search-overlay');
  if(overlay) overlay.classList.remove('open');
}

function onGlobalSearchInput(val){
  if(_globalSearchTimer) clearTimeout(_globalSearchTimer);
  _globalSearchTimer = setTimeout(function(){ doGlobalSearch(val); }, 200);
}

function doGlobalSearch(q){
  q = (q||'').trim();
  var el = document.getElementById('global-search-results');
  if(!el) return;
  if(q.length < 2){
    el.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Digita almeno 2 caratteri...</div>';
    return;
  }

  var html = '';
  var totale = 0;

  // -- Inventario -- (early-exit indexOf prima di fuzzyMatch per performance su 14k articoli)
  var invResults = [];
  var qLow = q.toLowerCase();
  rows.forEach(function(r,i){
    if(removed.has(String(i))) return;
    var m = magazzino[i] || {};
    var hay = [r.desc, r.codF, r.codM, m.marca, m.specs, m.posizione, m.nomeFornitore].join(' ');
    if(hay.toLowerCase().indexOf(qLow) < 0) return; // early exit veloce
    if(fuzzyMatch(q, hay)){
      invResults.push({r:r, m:m, i:i});
    }
  });

  if(invResults.length){
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">- Inventario ('+invResults.length+')</div>';
    invResults.slice(0,8).forEach(function(item){
      var qty = item.m.qty !== undefined && item.m.qty !== '' ? Number(item.m.qty) : '-';
      var soglia = getSoglia(item.i);
      var isLow = qty !== '-' && qty <= soglia;
      html += '<div data-gi="'+item.i+'" onclick="gsGoArticolo(this)" style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:#1e1e1e;border-radius:8px;margin-bottom:4px;cursor:pointer;border-left:3px solid '+(isLow?'#e53e3e':'transparent')+';">';
      html += '<div>';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text);">'+ esc(item.r.desc||'-') +'</div>';
      html += '<div style="font-size:10px;color:var(--muted);">'+esc(item.r.codF||'')+(item.m.marca?' - '+esc(item.m.marca):'')+'</div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--accent);">- '+(item.r.prezzo||'-')+'</div>';
      html += '<div style="font-size:10px;color:'+(isLow?'#e53e3e':'#555')+';">Qta: '+qty+(isLow?' --':'')+'</div>';
      html += '</div></div>';
    });
    if(invResults.length > 8) html += '<div style="font-size:10px;color:#555;text-align:center;padding:4px;">...e altri '+(invResults.length-8)+' articoli</div>';
    totale += invResults.length;
  }

  // -- Ordini --
  var ordResults = [];
  ordini.forEach(function(o){
    if(!o||!o.items) return;
    var hay = [o.id, o.stato, o.note].join(' ');
    o.items.forEach(function(item){ hay += ' ' + (item.desc||'') + ' ' + (item.codF||''); });
    if(fuzzyMatch(q, hay)) ordResults.push(o);
  });

  if(ordResults.length){
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px;">- Ordini ('+ordResults.length+')</div>';
    ordResults.slice(0,4).forEach(function(o){
      html += '<div onclick="closeGlobalSearch();goTab(&apos;to&apos;)" style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:#1e1e1e;border-radius:8px;margin-bottom:4px;cursor:pointer;">';
      html += '<div><div style="font-size:12px;font-weight:600;color:var(--text);">Ordine #'+esc(o.id)+'</div>';
      html += '<div style="font-size:10px;color:var(--muted);">'+(o.items||[]).length+' articoli</div></div>';
      var stCol = o.stato==='inviato'?'#f5c400':o.stato==='ricevuto'?'#38a169':'#fc8181';
      html += '<span style="font-size:11px;color:'+stCol+';font-weight:600;">'+(o.stato||'-')+'</span>';
      html += '</div>';
    });
    totale += ordResults.length;
  }

  // -- Movimenti --
  var movResults = [];
  movimenti.forEach(function(mv){
    var hay = [mv.desc, mv.codF, mv.tipo, mv.note, mv.data].join(' ');
    if(fuzzyMatch(q, hay)) movResults.push(mv);
  });

  if(movResults.length){
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px;">- Movimenti ('+movResults.length+')</div>';
    movResults.slice(0,5).forEach(function(mv){
      var tipoC = mv.tipo==='vendita'?'#fc8181':mv.tipo==='carico'?'#68d391':'#63b3ed';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#1e1e1e;border-radius:8px;margin-bottom:4px;">';
      html += '<div><div style="font-size:12px;color:var(--text);">'+esc(mv.desc||'-')+'</div>';
      html += '<div style="font-size:10px;color:var(--muted);">'+esc(mv.data||'')+' - '+esc(mv.tipo||'')+'</div></div>';
      html += '<span style="font-size:12px;font-weight:700;color:'+tipoC+';">'+(mv.delta>0?'+':'')+mv.delta+'</span>';
      html += '</div>';
    });
    if(movResults.length > 5) html += '<div style="font-size:10px;color:#555;text-align:center;padding:4px;">...e altri '+(movResults.length-5)+' movimenti</div>';
    totale += movResults.length;
  }

  if(!html){
    html = '<div style="text-align:center;padding:30px;">' +
      '<div style="font-size:30px;margin-bottom:8px;">-</div>' +
      '<div style="color:#555;font-size:13px;">Nessun risultato per <b>'+esc(q)+'</b></div></div>';
  } else {
    html = '<div style="font-size:10px;color:var(--muted);margin-bottom:12px;">'+totale+' risultati per "'+esc(q)+'"</div>' + html;
  }

  el.innerHTML = html;
}


function gsGoArticolo(el){
  var idx = parseInt(el.getAttribute('data-gi'));
  closeGlobalSearch();
  goTab('t0');
  setTimeout(function(){ openSchedaProdotto(idx); }, 80);
}
