// inventario.search.js - estratto da inventario.js

// ══ INVENTARIO & MAGAZZINO ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTARIO — ricerca veloce con indice pre-costruito
//
//  Problema originale: fuzzyScore() usa Levenshtein su ogni articolo ad ogni
//  tasto → O(n²) su 19.000 voci → blocco totale su mobile.
//
//  Soluzione:
//  1. _invBuildIndex() — costruisce UNA VOLTA SOLA un array di stringhe piatte
//     (una per articolo). Viene chiamato appena Firebase finisce di caricare.
//  2. renderInventario() — debounce 350ms, poi cerca con semplice indexOf()
//     sull'indice: niente fuzzy, niente Levenshtein, ~2ms per 19.000 voci.
//  3. Max 50 righe renderizzate. Lista vuota finché < 3 caratteri.
// ═══════════════════════════════════════════════════════════════════════════════

// Indice piatto: _invIdx[i] = stringa normalizzata dell'articolo i
var _invIdx = null;
var _invIdxBuilt = false;
var _invSearchTimer = null;

// Normalizza per ricerca: minuscolo, senza accenti, senza punteggiatura
function _invNorm(s){
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Costruisce l'indice — chiamato da loadMagazzinoFB() al termine del caricamento
function _invBuildIndex(){
  _invIdx = new Array(rows.length);
  for(var i = 0; i < rows.length; i++){
    var r = rows[i];
    if(!r){ _invIdx[i] = ''; continue; }
    var m = magazzino[i] || {};
    _invIdx[i] = _invNorm([
      r.desc  || '',
      r.codF  || '',
      r.codM  || '',
      m.marca || '',
      m.specs || '',
      m.posizione || ''
    ].join(' '));
  }
  _invIdxBuilt = true;
}

// ── Entry point chiamato dall'oninput e da goTab('t0') ────────────────────────
function renderInventario(){
  // Popola filtro categorie una-tantum (operazione leggera)
  var sel = document.getElementById('inv-cat-filter');
  if(sel && sel.options.length <= 1 && typeof categorie !== 'undefined'){
    categorie.forEach(function(cat){
      var opt = document.createElement('option');
      opt.value = cat.id; opt.textContent = cat.nome;
      sel.appendChild(opt);
    });
  }
  // Debounce 350ms — non parte ad ogni singolo tasto
  if(_invSearchTimer) clearTimeout(_invSearchTimer);
  _invSearchTimer = setTimeout(_doInvSearch, 350);
}

// ── Ricerca vera — eseguita dopo il debounce ──────────────────────────────────
function _doInvSearch(){
  var body    = document.getElementById('inv-body');
  var statsEl = document.getElementById('inv-stats');
  if(!body) return;

  // Database non ancora pronto
  if(!rows || !rows.length){
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--accent);font-size:14px;">⏳ Database in caricamento...</td></tr>';
    if(statsEl) statsEl.innerHTML = '';
    return;
  }

  // Costruisce l'indice se non esiste ancora (prima ricerca dopo caricamento)
  if(!_invIdxBuilt) _invBuildIndex();

  var rawSearch = (document.getElementById('inv-search') || {}).value || '';
  var catFilter = (document.getElementById('inv-cat-filter') || {}).value || '';
  var hasSearch = rawSearch.trim().length >= 3;
  var hasFilter = !!catFilter;
  var hasSottoScorta = (typeof invSottoScorta !== 'undefined') && invSottoScorta;
  var hasGiornalino = (typeof invGiornalino !== 'undefined') && invGiornalino;

  // Nessun criterio → mostra placeholder
  if(!hasSearch && !hasFilter && !hasSottoScorta && !hasGiornalino){
    body.innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:50px 20px;color:var(--muted);font-size:13px;">' +
      '🔍 Digita almeno <b style="color:var(--accent)">3 caratteri</b> per cercare tra ' +
      '<b style="color:var(--accent)">' + rows.length.toLocaleString('it-IT') + '</b> articoli' +
      '</td></tr>';
    if(statsEl) statsEl.innerHTML =
      '<div class="sc"><span class="n">' + rows.length.toLocaleString('it-IT') + '</span>Articoli totali</div>';
    return;
  }

  // ── Costruisce le query-words per ricerca multi-termine ───────────────────
  // Es. "vite inox m6" → cerca articoli che contengano TUTTE e tre le parole
  var qWords = hasSearch
    ? _invNorm(rawSearch).split(' ').filter(function(w){ return w.length >= 2; })
    : [];

  var MAX = 50;
  var results = [];
  var tot = 0, sottoScorta = 0, totVal = 0;

  for(var i = 0; i < rows.length; i++){
    var r = rows[i];
    if(!r) continue;
    if(removed.has(String(i))) continue;

    var m = magazzino[i] || {};

    // Filtro categoria
    if(hasFilter && (m.cat || '') !== catFilter) continue;

    // Filtro testo — indexOf sull'indice piatto, nessun fuzzy
    if(hasSearch){
      var hay = _invIdx[i] || '';
      var ok = true;
      for(var w = 0; w < qWords.length; w++){
        if(hay.indexOf(qWords[w]) < 0){ ok = false; break; }
      }
      if(!ok) continue;
    }

    // Filtro sotto-scorta
    var soglia = getSoglia(i);
    var qty = (m.qty !== undefined && m.qty !== '') ? Number(m.qty) : null;
    var isLow = qty !== null && qty <= soglia;
    if(hasSottoScorta && !isLow) continue;

    // Filtro giornalino
    if(hasGiornalino && !(r.giornalino)) continue;

    // Statistiche su tutti i match (non solo i primi 50)
    tot++;
    if(qty !== null) totVal += (parseFloat(r.prezzo) || 0) * qty;
    if(isLow) sottoScorta++;

    results.push({ r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty, _updatedAt:getRowUpdatedAt(r,i) });
  }

  // Ultimi aggiunti/modificati in alto.
  results.sort(function(a,b){ return (b._updatedAt||0) - (a._updatedAt||0); });
  if(results.length > MAX) results.length = MAX;

  // ── Render HTML dei primi MAX risultati ───────────────────────────────────
  var html = '';

  if(!results.length){
    html = '<tr><td colspan="10" style="padding:40px;text-align:center;color:var(--muted);">' +
      'Nessun risultato per <b style="color:var(--accent)">"' + esc(rawSearch) + '"</b>' +
      '</td></tr>';
  } else {
    for(var ri = 0; ri < results.length; ri++){
      var x  = results[ri];
      var r  = x.r, idx = x.i, m = x.m;
      var isLow   = x.isLow;
      var rowBg   = isLow ? 'rgba(229,62,62,0.08)' : '';
      var borderL = isLow ? 'border-left:3px solid #e53e3e;' : 'border-left:3px solid transparent;';
      var unit    = m.unit || 'pz';
      var specs   = m.specs || '';
      var pos     = m.posizione || '';
      var marca   = m.marca || '';
      var prezzoAcq = m.prezzoAcquisto || '';
      var catId   = m.cat || '';
      var catLabel = '';
      if(catId && typeof categorie !== 'undefined'){
        var cf = categorie.find(function(c){ return c.id === catId; });
        catLabel = cf ? cf.nome : '';
      }
      var sub = m.subcat || '';
      var codM7 = r.codM
        ? (String(r.codM).match(/^\d+$/) ? String(r.codM).padStart(7,'0') : String(r.codM))
        : '-';

      html += '<tr style="border-bottom:1px solid var(--border);' + borderL + 'background:' + rowBg + ';cursor:pointer;" onclick="openSchedaProdotto(' + idx + ')" title="Modifica">';
      // 1. Descrizione + marca
      html += '<td style="padding:8px 6px;">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text);">' + esc(r.desc || '—') + '</div>';
      if(marca) html += '<div style="font-size:10px;color:var(--muted);">• ' + esc(marca) + '</div>';
      html += '</td>';
      // 2. Specifiche
      html += '<td style="padding:8px 6px;font-size:11px;color:#2dd4bf;font-style:italic;">' + esc(specs) + '</td>';
      // 3. Cod. Fornitore
      html += '<td style="padding:8px 6px;font-size:11px;color:#fc8181;font-weight:600;">' + esc(String(r.codF || '—')) + '</td>';
      // 4. Mio Codice
      html += '<td style="padding:8px 6px;font-size:11px;color:var(--accent);font-weight:600;">' + esc(codM7) + '</td>';
      // 5. Quantità
      html += '<td style="padding:8px 6px;text-align:center;white-space:nowrap;">';
      html += '<button onclick="event.stopPropagation();deltaQta(' + idx + ',-1)" style="background:#333;border:none;color:var(--text);width:30px;height:30px;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;touch-action:manipulation;">−</button> ';
      html += '<input type="number" min="0" value="' + (x.qty !== null ? x.qty : '') + '" placeholder="—" onclick="event.stopPropagation()" ' +
              'style="width:44px;padding:3px 2px;border:1px solid ' + (isLow ? '#e53e3e' : 'var(--border)') + ';border-radius:5px;background:#111;color:' + (isLow ? '#e53e3e' : 'var(--accent)') + ';font-size:13px;font-weight:900;text-align:center;" ' +
              'onchange="event.stopPropagation();saveQta(' + idx + ',this.value)" id="inv-qty-' + idx + '"> ';
      html += '<button onclick="event.stopPropagation();deltaQta(' + idx + ',1)" style="background:#333;border:none;color:var(--text);width:30px;height:30px;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;touch-action:manipulation;">+</button>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' +
              '<button onclick="event.stopPropagation();openMovProdotto(' + idx + ')" style="background:none;border:none;color:#3182ce;font-size:10px;cursor:pointer;padding:0;">📊</button> ' +
              esc(unit) + (isLow ? ' <span style="color:#e53e3e;font-weight:700;">⚠ min:' + x.soglia + '</span>' : '') +
              '</div>';
      html += '</td>';
      // 6. Prezzo vendita
      html += '<td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:900;color:var(--accent);">€ ' + esc(r.prezzo || '0') + '</td>';
      // 7. Prezzo acquisto (riservato)
      html += '<td style="padding:8px 6px;text-align:right;" onclick="event.stopPropagation();">' +
              '<input type="text" value="' + esc(prezzoAcq) + '" placeholder="—" onclick="event.stopPropagation()" ' +
              'style="width:52px;padding:3px 5px;border:1px solid #333;border-radius:5px;background:#0d0d0d;color:#555;font-size:11px;text-align:right;font-style:italic;" ' +
              'title="Prezzo acquisto" ' +
              'onchange="event.stopPropagation();saveMagRow(' + idx + ',\'prezzoAcquisto\',this.value)">' +
              '</td>';
      // 8. Posizione
      html += '<td style="padding:8px 6px;font-size:11px;color:#888;font-style:italic;">' + esc(pos) + '</td>';
      // 9. Categoria
      html += '<td style="padding:8px 6px;">';
      if(catLabel) html += '<div style="font-size:10px;color:var(--accent);">' + esc(catLabel) + '</div>';
      if(sub)      html += '<div style="font-size:10px;color:#555;">' + esc(sub) + '</div>';
      html += '</td>';
      // 10. Giornalino
      var giorn = r.giornalino || '';
      html += '<td style="padding:8px 6px;text-align:center;">';
      if(giorn){
        var gCol = {rosso:'#e53e3e',verde:'#38a169',blu:'#3182ce',giallo:'#d69e2e',viola:'#805ad5',arancio:'#dd6b20',grigio:'#718096'};
        var dotColor = gCol[giorn] || '#888';
        html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + dotColor + ';" title="' + esc(giorn) + '"></span>';
      }
      html += '</td></tr>';
    }

    // Banner se ci sono più di MAX risultati
    if(tot > MAX){
      html += '<tr><td colspan="10" style="text-align:center;padding:12px;font-size:12px;color:var(--muted);background:rgba(245,196,0,.04);border-top:1px solid var(--border);">' +
              '📌 Mostrati <b style="color:var(--accent)">' + MAX + '</b> su <b>' + tot + '</b> risultati — aggiungi parole per restringere la ricerca.' +
              '</td></tr>';
    }
  }

  body.innerHTML = html;

  if(statsEl) statsEl.innerHTML =
    '<div class="sc"><span class="n">' + (tot > MAX ? MAX + '+' : tot) + '</span>Risultati</div>' +
    (totVal > 0 ? '<div class="sc g"><span class="n" style="color:#68d391">€ ' + totVal.toFixed(0) + '</span>Valore</div>' : '') +
    (sottoScorta ? '<div class="sc r"><span class="n" style="color:#e53e3e">' + sottoScorta + '</span>Sotto scorta</div>' : '');
}

// ── Sotto-tab Inventario: Lista | Magazzino | [G] Giornalino ─────────────────
var invSubTab = 'lista';
var _invDbChTimer = null;

function invUpdateSubTabButtons(){
  var a = {
    lista: document.getElementById('inv-subtab-lista'),
    mag: document.getElementById('inv-subtab-magazzino'),
    g: document.getElementById('inv-subtab-g')
  };
  if(!a.lista || !a.mag || !a.g) return;
  var inactive = 'flex:1;min-width:100px;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #2a2a2a;background:#1e1e1e;color:#888;font-size:13px;font-weight:800;cursor:pointer;touch-action:manipulation;';
  var activeLista = 'flex:1;min-width:100px;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:#111;font-size:13px;font-weight:800;cursor:pointer;touch-action:manipulation;';
  var activeMag = 'flex:1;min-width:100px;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #38a169;background:rgba(56,161,105,.25);color:#68d391;font-size:13px;font-weight:800;cursor:pointer;touch-action:manipulation;';
  var activeG = 'flex:1;min-width:100px;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #805ad5;background:rgba(128,90,213,.2);color:#d6bcfa;font-size:13px;font-weight:800;cursor:pointer;touch-action:manipulation;';
  a.lista.style.cssText = invSubTab === 'lista' ? activeLista : inactive;
  a.mag.style.cssText = invSubTab === 'magazzino' ? activeMag : inactive;
  a.g.style.cssText = invSubTab === 'giornalinoG' ? activeG : inactive;
}

function invSetSubTab(which){
  invSubTab = which;
  var pList = document.getElementById('inv-sub-panel-lista');
  var pMag = document.getElementById('inv-sub-panel-magazzino');
  var pG = document.getElementById('inv-sub-panel-giornalino-g');
  if(pList) pList.style.display = which === 'lista' ? '' : 'none';
  if(pMag) pMag.style.display = which === 'magazzino' ? '' : 'none';
  if(pG) pG.style.display = which === 'giornalinoG' ? '' : 'none';
  invUpdateSubTabButtons();
  if(which === 'lista') renderInventario();
  else if(which === 'magazzino' && typeof renderMagazzino === 'function') renderMagazzino();
  else if(which === 'giornalinoG') renderInventarioPromoG();
}

function invRefreshT0(){
  if(typeof invSubTab === 'undefined') invSubTab = 'lista';
  if(invSubTab === 'lista'){
    if(typeof renderInventario === 'function') renderInventario();
  } else if(invSubTab === 'magazzino'){
    if(typeof renderMagazzino === 'function') renderMagazzino();
  } else if(invSubTab === 'giornalinoG'){
    renderInventarioPromoG();
  }
  invUpdateSubTabButtons();
}

function _invIsPromoG(r){
  return r && r.isPromo === true && String(r.promoTipo || '') === 'G';
}

function renderInventarioPromoG(){
  var body = document.getElementById('inv-body-g');
  var statsEl = document.getElementById('inv-stats-g');
  if(!body) return;
  if(!rows || !rows.length){
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted);">⏳ Database in caricamento...</td></tr>';
    if(statsEl) statsEl.innerHTML = '';
    return;
  }
  if(!_invIdxBuilt) _invBuildIndex();
  var MAX = 50;
  var results = [];
  var tot = 0, sottoScorta = 0, totVal = 0;
  var i, r, m, soglia, qty, isLow;
  for(i = 0; i < rows.length; i++){
    r = rows[i];
    if(!r) continue;
    if(removed.has(String(i))) continue;
    if(!_invIsPromoG(r)) continue;
    m = magazzino[i] || {};
    soglia = getSoglia(i);
    qty = (m.qty !== undefined && m.qty !== '') ? Number(m.qty) : null;
    isLow = qty !== null && qty <= soglia;
    tot++;
    if(qty !== null) totVal += (parseFloat(r.prezzo) || 0) * qty;
    if(isLow) sottoScorta++;
    results.push({ r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty });
  }
  results.sort(function(a, b){
    var mb = (typeof getRowModifiedChronoAt === 'function') ? Number(getRowModifiedChronoAt(b.r, b.i)) : 0;
    var ma = (typeof getRowModifiedChronoAt === 'function') ? Number(getRowModifiedChronoAt(a.r, a.i)) : 0;
    if(!isFinite(mb)) mb = 0;
    if(!isFinite(ma)) ma = 0;
    return mb - ma;
  });
  if(results.length > MAX) results.length = MAX;

  var html = '';
  if(!results.length){
    html = '<tr><td colspan="10" style="padding:40px;text-align:center;color:var(--muted);">Nessun articolo con promo <b style="color:#805ad5">[G]</b> attiva.</td></tr>';
  } else {
    for(var ri = 0; ri < results.length; ri++){
      var x = results[ri];
      r = x.r;
      var idx = x.i;
      m = x.m;
      isLow = x.isLow;
      var rowBg = isLow ? 'rgba(229,62,62,0.08)' : '';
      var borderL = isLow ? 'border-left:3px solid #e53e3e;' : 'border-left:3px solid transparent;';
      var unit = m.unit || 'pz';
      var specs = m.specs || '';
      var pos = m.posizione || '';
      var marca = m.marca || '';
      var prezzoAcq = m.prezzoAcquisto || '';
      var catId = m.cat || '';
      var catLabel = '';
      if(catId && typeof categorie !== 'undefined'){
        var cf = categorie.find(function(c){ return c.id === catId; });
        catLabel = cf ? cf.nome : '';
      }
      var sub = m.subcat || '';
      var codM7 = r.codM
        ? (String(r.codM).match(/^\d+$/) ? String(r.codM).padStart(7, '0') : String(r.codM))
        : '-';

      html += '<tr style="border-bottom:1px solid var(--border);' + borderL + 'background:' + rowBg + ';cursor:pointer;" onclick="openSchedaProdotto(' + idx + ')" title="Modifica">';
      html += '<td style="padding:8px 6px;"><div style="font-size:12px;font-weight:600;color:var(--text);">' + esc(r.desc || '—') + '</div>';
      if(marca) html += '<div style="font-size:10px;color:var(--muted);">• ' + esc(marca) + '</div>';
      html += '</td>';
      html += '<td style="padding:8px 6px;font-size:11px;color:#2dd4bf;font-style:italic;">' + esc(specs) + '</td>';
      html += '<td style="padding:8px 6px;font-size:11px;color:#fc8181;font-weight:600;">' + esc(String(r.codF || '—')) + '</td>';
      html += '<td style="padding:8px 6px;font-size:11px;color:var(--accent);font-weight:600;">' + esc(codM7) + '</td>';
      html += '<td style="padding:8px 6px;text-align:center;white-space:nowrap;">';
      html += '<button onclick="event.stopPropagation();deltaQta(' + idx + ',-1)" style="background:#333;border:none;color:var(--text);width:30px;height:30px;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;touch-action:manipulation;">−</button> ';
      html += '<input type="number" min="0" value="' + (x.qty !== null ? x.qty : '') + '" placeholder="—" onclick="event.stopPropagation()" ' +
              'style="width:44px;padding:3px 2px;border:1px solid ' + (isLow ? '#e53e3e' : 'var(--border)') + ';border-radius:5px;background:#111;color:' + (isLow ? '#e53e3e' : 'var(--accent)') + ';font-size:13px;font-weight:900;text-align:center;" ' +
              'onchange="event.stopPropagation();saveQta(' + idx + ',this.value)" id="inv-g-qty-' + idx + '"> ';
      html += '<button onclick="event.stopPropagation();deltaQta(' + idx + ',1)" style="background:#333;border:none;color:var(--text);width:30px;height:30px;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;touch-action:manipulation;">+</button>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' +
              '<button onclick="event.stopPropagation();openMovProdotto(' + idx + ')" style="background:none;border:none;color:#3182ce;font-size:10px;cursor:pointer;padding:0;">📊</button> ' +
              esc(unit) + (isLow ? ' <span style="color:#e53e3e;font-weight:700;">⚠ min:' + x.soglia + '</span>' : '') +
              '</div></td>';
      html += '<td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:900;color:var(--accent);"><span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end;">€ ' + esc(r.prezzo || '0') +
              (typeof htmlPromoGBadge === 'function' ? htmlPromoGBadge() : '') + '</span></td>';
      html += '<td style="padding:8px 6px;text-align:right;" onclick="event.stopPropagation();">' +
              '<input type="text" value="' + esc(prezzoAcq) + '" placeholder="—" onclick="event.stopPropagation()" ' +
              'style="width:52px;padding:3px 5px;border:1px solid #333;border-radius:5px;background:#0d0d0d;color:#555;font-size:11px;text-align:right;font-style:italic;" ' +
              'onchange="event.stopPropagation();saveMagRow(' + idx + ',\'prezzoAcquisto\',this.value)"></td>';
      html += '<td style="padding:8px 6px;font-size:11px;color:#888;font-style:italic;">' + esc(pos) + '</td>';
      html += '<td style="padding:8px 6px;">';
      if(catLabel) html += '<div style="font-size:10px;color:var(--accent);">' + esc(catLabel) + '</div>';
      if(sub) html += '<div style="font-size:10px;color:#555;">' + esc(sub) + '</div>';
      html += '</td>';
      html += '<td style="padding:8px 6px;text-align:center;"><span style="color:#805ad5;font-weight:800;">[G]</span></td></tr>';
    }
    if(tot > MAX){
      html += '<tr><td colspan="10" style="text-align:center;padding:12px;font-size:12px;color:var(--muted);">📌 Mostrati <b>' + MAX + '</b> su <b>' + tot + '</b> articoli [G].</td></tr>';
    }
  }
  body.innerHTML = html;
  if(statsEl){
    statsEl.innerHTML =
      '<div class="sc"><span class="n">' + (tot > MAX ? MAX + '+' : tot) + '</span>Promo [G]</div>' +
      (totVal > 0 ? '<div class="sc g"><span class="n" style="color:#68d391">€ ' + totVal.toFixed(0) + '</span>Valore</div>' : '') +
      (sottoScorta ? '<div class="sc r"><span class="n" style="color:#e53e3e">' + sottoScorta + '</span>Sotto scorta</div>' : '');
  }
}

if(typeof window !== 'undefined'){
  window.addEventListener('db-changed', function(){
    var t0 = document.getElementById('t0');
    if(!t0 || !t0.classList.contains('active')) return;
    if(_invDbChTimer) clearTimeout(_invDbChTimer);
    _invDbChTimer = setTimeout(function(){
      if(typeof invRefreshT0 === 'function') invRefreshT0();
    }, 100);
  });
}
