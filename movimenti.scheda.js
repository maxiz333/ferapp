// movimenti.scheda.js - estratto da movimenti.js

// ------------------------------------------------------------------
//  FEATURE 6 - Articoli correlati
// ------------------------------------------------------------------

function ensureCorrelatiArray(i){
  if(!magazzino[i]) magazzino[i] = {};
  if(!Array.isArray(magazzino[i].correlati)) magazzino[i].correlati = [];
  return magazzino[i].correlati;
}

function normalizeCorrelati(i){
  var corr = ensureCorrelatiArray(i);
  var seen = {};
  var out = [];
  corr.forEach(function(ri){
    var n = parseInt(ri, 10);
    if(isNaN(n)) return;
    if(n === i) return;
    if(!rows[n]) return;
    if(removed && typeof removed.has === 'function' && removed.has(String(n))) return;
    if(seen[n]) return;
    seen[n] = true;
    out.push(n);
  });
  magazzino[i].correlati = out;
  return out;
}

function linkCorrelatiBidirectional(i, ri){
  if(i === ri || !rows[i] || !rows[ri]) return false;
  var ci = normalizeCorrelati(i);
  var cr = normalizeCorrelati(ri);
  var changed = false;
  if(ci.indexOf(ri) < 0){ ci.push(ri); changed = true; }
  if(cr.indexOf(i) < 0){ cr.push(i); changed = true; }
  return changed;
}

function unlinkCorrelatiBidirectional(i, ri){
  if(!rows[i] || !rows[ri]) return false;
  var ci = normalizeCorrelati(i);
  var cr = normalizeCorrelati(ri);
  var lenI = ci.length;
  var lenR = cr.length;
  magazzino[i].correlati = ci.filter(function(x){ return x !== ri; });
  magazzino[ri].correlati = cr.filter(function(x){ return x !== i; });
  return (lenI !== magazzino[i].correlati.length) || (lenR !== magazzino[ri].correlati.length);
}

function _saveCorrelati(i, ri){
  lsSet(MAGK, magazzino);
  if(typeof _fbSaveArticolo === 'function'){
    _fbSaveArticolo(i);
    if(ri != null && ri !== i) _fbSaveArticolo(ri);
  }
}

var _epCorrelatiUiState = { collapsed:true };

function epToggleCorrelati(forceValue){
  var next = (typeof forceValue === 'boolean') ? forceValue : !_epCorrelatiUiState.collapsed;
  _epCorrelatiUiState.collapsed = !!next;
  var body = document.getElementById('ep-correlati-body');
  var toggle = document.getElementById('ep-correlati-toggle');
  var head = document.querySelector('#ep-correlati-sec .ep-correlati-head');
  if(body) body.classList.toggle('is-collapsed', _epCorrelatiUiState.collapsed);
  if(toggle) toggle.classList.toggle('is-collapsed', _epCorrelatiUiState.collapsed);
  if(head) head.setAttribute('aria-expanded', _epCorrelatiUiState.collapsed ? 'false' : 'true');
}

function epResetCorrelatiUi(){
  _epCorrelatiUiState.collapsed = true;
  epToggleCorrelati(true);
  var searchEl = document.getElementById('ep-correlati-search');
  var resultsEl = document.getElementById('ep-correlati-results');
  if(searchEl) searchEl.value = '';
  if(resultsEl){
    resultsEl.classList.remove('is-open');
    resultsEl.innerHTML = '';
  }
}

function getCorrelatiSearchMatches(i, query, opts){
  opts = opts || {};
  var minChars = (typeof opts.minChars === 'number') ? opts.minChars : 2;
  var maxOptions = (typeof opts.maxOptions === 'number') ? opts.maxOptions : 200;
  var q = String(query || '').trim().toLowerCase();
  var corr = Array.isArray(opts.existingCorrelati) ? opts.existingCorrelati : normalizeCorrelati(i);
  var matches = [];
  if(q.length < minChars){
    return { query:q, minChars:minChars, maxOptions:maxOptions, tooShort:true, matches:matches };
  }
  for(var ri = 0; ri < rows.length; ri++){
    var r = rows[ri];
    if(!r) continue;
    if(removed && typeof removed.has === 'function' && removed.has(String(ri))) continue;
    if(ri === i) continue;
    if(corr.indexOf(ri) >= 0) continue;
    var desc = String(r.desc || '');
    var codF = String(r.codF || '');
    var codM = String(r.codM || '');
    var hay = (desc + ' ' + codF + ' ' + codM).toLowerCase();
    if(hay.indexOf(q) < 0) continue;
    matches.push({
      ri: ri,
      desc: desc,
      codF: codF,
      codM: codM,
      prezzo: r.prezzo || '-'
    });
    if(matches.length >= maxOptions) break;
  }
  return { query:q, minChars:minChars, maxOptions:maxOptions, tooShort:false, matches:matches };
}

function renderCorrelati(i) {
  var listEl = document.getElementById('ep-correlati-list');
  var resultsEl = document.getElementById('ep-correlati-results');
  var searchEl = document.getElementById('ep-correlati-search');
  var titleEl = document.getElementById('ep-correlati-title');
  if (!listEl || !resultsEl || !searchEl) return;
  epToggleCorrelati(_epCorrelatiUiState.collapsed);
  var corr = normalizeCorrelati(i);
  if(titleEl) titleEl.textContent = '🔄 Correlati (' + corr.length + ')';
  var listFrag = document.createDocumentFragment();
  corr.forEach(function (ri) {
    if (!rows[ri]) return;
    var rr = rows[ri] || {};
    var row = document.createElement('div');
    row.className = 'ep-correlati-row';
    var main = document.createElement('div');
    main.className = 'ep-correlati-main';
    var nm = document.createElement('div');
    nm.className = 'ep-correlati-name';
    nm.textContent = rr.desc || '-';
    var meta = document.createElement('div');
    meta.className = 'ep-correlati-meta';
    meta.textContent = (rr.codM || '—') + ' · ' + (rr.codF || '—');
    main.appendChild(nm);
    main.appendChild(meta);
    var price = document.createElement('div');
    price.className = 'ep-correlati-price';
    price.textContent = '€ ' + (rr.prezzo || '-');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ep-correlati-remove';
    btn.title = 'Rimuovi correlato';
    btn.textContent = '×';
    btn.onclick = function(){ rimuoviCorrelato(i, ri); };
    row.appendChild(main);
    row.appendChild(price);
    row.appendChild(btn);
    listFrag.appendChild(row);
  });
  listEl.innerHTML = '';
  if(!listFrag.childNodes.length){
    var empty = document.createElement('div');
    empty.className = 'ep-correlati-result-empty';
    empty.textContent = 'Nessun articolo correlato';
    listEl.appendChild(empty);
  }else{
    listEl.appendChild(listFrag);
  }

  var q = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
  console.log('Ricerca per:', q);
  resultsEl.innerHTML = '';
  resultsEl.classList.remove('is-open');
  var searchRes = getCorrelatiSearchMatches(i, q, {
    existingCorrelati: corr,
    minChars: 2,
    maxOptions: 200
  });
  if(searchRes.tooShort){
    return;
  }
  var optionCount = 0;
  var frag = document.createDocumentFragment();
  searchRes.matches.forEach(function(match){
    var resultRow = document.createElement('div');
    resultRow.className = 'ep-correlati-result';
    resultRow.setAttribute('role', 'option');
    resultRow.onclick = (function(target){
      return function(){ aggiungiCorrelatoByIdx(i, target); };
    })(match.ri);
    var resultMain = document.createElement('div');
    resultMain.className = 'ep-correlati-result-main';
    var resultName = document.createElement('div');
    resultName.className = 'ep-correlati-result-name';
    resultName.textContent = match.desc || '-';
    var resultMeta = document.createElement('div');
    resultMeta.className = 'ep-correlati-result-meta';
    resultMeta.textContent = (match.codM || '—') + ' · ' + (match.codF || '—');
    resultMain.appendChild(resultName);
    resultMain.appendChild(resultMeta);
    var resultPrice = document.createElement('div');
    resultPrice.className = 'ep-correlati-result-price';
    resultPrice.textContent = '€ ' + (match.prezzo || '-');
    resultRow.appendChild(resultMain);
    resultRow.appendChild(resultPrice);
    frag.appendChild(resultRow);
    optionCount++;
  });
  resultsEl.appendChild(frag);
  if(optionCount <= 0){
    var none = document.createElement('div');
    none.className = 'ep-correlati-result-empty';
    none.textContent = 'Nessun risultato';
    resultsEl.appendChild(none);
  }
  resultsEl.classList.add('is-open');
}

function aggiungiCorrelatoByIdx(i, ri) {
  ri = parseInt(ri, 10);
  if (isNaN(ri) || !rows[ri]) return;
  if (linkCorrelatiBidirectional(i, ri)) _saveCorrelati(i, ri);
  var searchEl = document.getElementById('ep-correlati-search');
  var resultsEl = document.getElementById('ep-correlati-results');
  if(searchEl) searchEl.value = '';
  if(resultsEl){
    resultsEl.classList.remove('is-open');
    resultsEl.innerHTML = '';
  }
  renderCorrelati(i);
}

function aggiungiCorrelato(i) {
  var searchEl = document.getElementById('ep-correlati-search');
  var q = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
  if(!q) return;
  for(var ri = 0; ri < rows.length; ri++){
    if(ri === i || !rows[ri]) continue;
    var desc = String(rows[ri].desc || '').toLowerCase();
    var codF = String(rows[ri].codF || '').toLowerCase();
    var codM = String(rows[ri].codM || '').toLowerCase();
    if(desc.indexOf(q) >= 0 || codF.indexOf(q) >= 0 || codM.indexOf(q) >= 0){
      aggiungiCorrelatoByIdx(i, ri);
      return;
    }
  }
}

function rimuoviCorrelato(i, ri) {
  ri = parseInt(ri, 10);
  if (isNaN(ri)) return;
  if (unlinkCorrelatiBidirectional(i, ri)) _saveCorrelati(i, ri);
  renderCorrelati(i);
}

// ------------------------------------------------------------------
//  FEATURE 3 - Prezzi a scaglioni
// ------------------------------------------------------------------
function renderScaglioni(i) {
  var el = document.getElementById('ep-scaglioni-list');
  if (!el) return;
  var m = magazzino[i] || {};
  var sc = m.scaglioni || [];
  var html = '';
  sc.forEach(function (s, si) {
    html += '<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px;flex-wrap:wrap;">';
    html += '<span style="font-size:11px;color:var(--muted)">da</span>';
    html += '<input type="number" min="1" value="' + (s.da || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'da\',this.value)" '
      + 'style="width:46px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:12px;text-align:center">';
    html += '<span style="font-size:11px;color:var(--muted)">a</span>';
    html += '<input type="number" min="1" placeholder="\u221E" value="' + (s.a || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'a\',this.value)" '
      + 'style="width:46px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:12px;text-align:center">';
    html += '<span style="font-size:11px;color:var(--muted)">pz &rarr; &euro;</span>';
    html += '<input type="text" value="' + esc(s.prezzo || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'prezzo\',this.value)" '
      + 'style="width:62px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--accent);font-size:13px;font-weight:700;text-align:right">';
    html += '<button onclick="delSc(' + i + ',' + si + ')" '
      + 'style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:16px;padding:0 2px">&times;</button>';
    html += '</div>';
  });
  el.innerHTML = html || '<div style="font-size:10px;color:#555;font-style:italic">Nessuno scaglione - cliccate + per aggiungerne uno</div>';
}

function addSc(i) {
  if (!magazzino[i]) magazzino[i] = {};
  if (!magazzino[i].scaglioni) magazzino[i].scaglioni = [];
  var sc = magazzino[i].scaglioni;
  var prevA = sc.length ? (sc[sc.length - 1].a || null) : null;
  sc.push({ da: prevA ? prevA + 1 : 1, a: null, prezzo: '' });
  lsSet(MAGK, magazzino);
  renderScaglioni(i);
}

function delSc(i, si) {
  if (!magazzino[i] || !magazzino[i].scaglioni) return;
  magazzino[i].scaglioni.splice(si, 1);
  lsSet(MAGK, magazzino);
  renderScaglioni(i);
}

function updSc(i, si, field, val) {
  if (!magazzino[i] || !magazzino[i].scaglioni) return;
  if (field === 'da' || field === 'a') {
    magazzino[i].scaglioni[si][field] = val === '' ? null : parseInt(val);
  } else {
    magazzino[i].scaglioni[si][field] = val;
  }
  lsSet(MAGK, magazzino);
}

function getPrezzoScaglione(i, qty) {
  var m = magazzino[i] || {};
  var sc = m.scaglioni || [];
  var q = parseFloat(qty) || 1;
  for (var si = 0; si < sc.length; si++) {
    var s = sc[si];
    if ((s.da === null || q >= s.da) && (s.a === null || q <= s.a) && s.prezzo) {
      return s.prezzo;
    }
  }
  return null;
}

// aggiungiScaglione / rimuoviScaglione / updateScaglione rimossi:
// usare addSc() / delSc() / updSc() definiti nella sezione FEATURE 3 sopra


// applicaScaglione(cartId,idx) rimossa - chiamava renderCartItems() non esistente
