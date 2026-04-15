// inventario.magazzino.js - estratto da inventario.js

// ═══════════════════════════════════════════════════════════════════════════════
//  MAGAZZINO — override renderMagazzino (stessa strategia dell'inventario)
//
//  Problema: la versione in database (moduli) itera 19.000 articoli AL CLICK sulla
//  tab, costruendo HTML per ognuno → crash immediato su mobile.
//
//  Soluzione:
//  • Lista vuota finché non si digitano ≥ 3 caratteri (o filtro/sottoScorta)
//  • Ricerca con indexOf sull'indice _invIdx già costruito (zero fuzzyMatch)
//  • Max 50 card renderizzate
//  • Debounce 350ms sulla digitazione
// ═══════════════════════════════════════════════════════════════════════════════

var _magSearchTimer = null;

function renderMagazzino(){
  // Popola filtro categorie una-tantum
  var sel = document.getElementById('mag-cat-filter');
  if(sel && sel.options.length <= 1 && typeof categorie !== 'undefined'){
    categorie.forEach(function(cat){
      var opt = document.createElement('option');
      opt.value = cat.id; opt.textContent = cat.nome;
      sel.appendChild(opt);
    });
  }
  if(_magSearchTimer) clearTimeout(_magSearchTimer);
  _magSearchTimer = setTimeout(_doMagSearch, 350);
}

function _doMagSearch(){
  var list    = document.getElementById('mag-list');
  var statsEl = document.getElementById('mag-stats');
  if(!list) return;

  // Database non pronto
  if(!rows || !rows.length){
    list.classList.remove('mag-list--chrono');
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--accent);font-size:14px;">⏳ Database in caricamento...</div>';
    if(statsEl) statsEl.innerHTML = '';
    return;
  }

  // Costruisce indice se mancante (condiviso con inventario)
  if(!_invIdxBuilt) _invBuildIndex();

  var rawSearch  = (document.getElementById('mag-search') || {}).value || '';
  var catFilter  = (document.getElementById('mag-cat-filter') || {}).value || '';
  var hasSearch  = rawSearch.trim().length >= 3;
  var hasFilter  = !!catFilter;
  var hasSottoSc = (typeof magSottoScorta !== 'undefined') && magSottoScorta;
  var chronoMode = (typeof magChronoMode !== 'undefined') ? magChronoMode : 'none';
  var hasChrono  = chronoMode === 'added' || chronoMode === 'modified';
  var mode       = (typeof magMode !== 'undefined') ? magMode : 'prod';
  var nowMs = Date.now();
  var recentiLimitMs = (typeof magChronoCutoffMs === 'number' && magChronoCutoffMs > 0) ? magChronoCutoffMs : (nowMs - 72 * 60 * 60 * 1000);
  var recentiMaxMs = (typeof magChronoNowMs === 'number' && magChronoNowMs > 0) ? magChronoNowMs : nowMs;

  // Nessun criterio → placeholder
  if(!hasSearch && !hasFilter && !hasSottoSc && !hasChrono){
    list.classList.remove('mag-list--chrono');
    list.innerHTML =
      '<div style="text-align:center;padding:50px 20px;color:var(--muted);font-size:13px;">' +
      '🔍 Digita almeno <b style="color:var(--accent)">3 caratteri</b> per cercare tra ' +
      '<b style="color:var(--accent)">' + rows.length.toLocaleString('it-IT') + '</b> articoli' +
      '</div>';
    if(statsEl) statsEl.innerHTML =
      '<div class="sc"><span class="n">' + rows.length.toLocaleString('it-IT') + '</span>Articoli totali</div>';
    return;
  }

  // Query words
  var qWords = hasSearch
    ? _invNorm(rawSearch).split(' ').filter(function(w){ return w.length >= 2; })
    : [];

  var MAX = 50;
  var results = [], tot = 0, sottoScorta = 0;
  if(typeof rebuildMagDuplicateCodes === 'function') rebuildMagDuplicateCodes();

  for(var i = 0; i < rows.length; i++){
    var r = rows[i];
    if(!r) continue;
    if(removed.has(String(i))) continue;
    var m = magazzino[i] || {};

    // Filtro categoria
    if(hasFilter && (m.cat || '__nessuna__') !== catFilter) continue;

    // Filtro testo — indexOf sull'indice piatto
    if(hasSearch){
      var hay = '';
      if(mode === 'spec'){
        // Modalità specifiche: cerca solo in specs
        hay = _invNorm(m.specs || '');
      } else {
        hay = _invIdx[i] || '';
      }
      var ok = true;
      for(var w = 0; w < qWords.length; w++){
        if(hay.indexOf(qWords[w]) < 0){ ok = false; break; }
      }
      if(!ok) continue;
    }

    // Filtro sotto-scorta
    var soglia = getSoglia(i);
    var qty    = (m.qty !== undefined && m.qty !== '') ? Number(m.qty) : null;
    var isLow  = qty !== null && qty <= soglia;
    if(hasSottoSc && !isLow) continue;
    if(hasChrono){
      var cAt = (typeof getRowCreatedAt === 'function') ? getRowCreatedAt(r) : 0;
      if(chronoMode === 'added'){
        if(cAt < recentiLimitMs || cAt > recentiMaxMs) continue;
      } else if(chronoMode === 'modified'){
        var modAt = (typeof getRowModifiedChronoAt === 'function') ? getRowModifiedChronoAt(r, i) : 0;
        if(modAt < recentiLimitMs || modAt > recentiMaxMs) continue;
      }
    }

    tot++;
    if(isLow) sottoScorta++;
    if(hasChrono){
      results.push({r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty});
    } else if(results.length < MAX){
      results.push({r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty});
    }
  }

  if(hasChrono && results.length){
    if(chronoMode === 'added' && typeof getRowCreatedAt === 'function'){
      results.sort(function(a, b){
        return getRowCreatedAt(b.r) - getRowCreatedAt(a.r);
      });
    } else if(chronoMode === 'modified' && typeof getRowModifiedChronoAt === 'function'){
      results.sort(function(a, b){
        var mb = Number(getRowModifiedChronoAt(b.r, b.i));
        var ma = Number(getRowModifiedChronoAt(a.r, a.i));
        if(!isFinite(mb)) mb = 0;
        if(!isFinite(ma)) ma = 0;
        return mb - ma;
      });
    }
    if(results.length > MAX) results = results.slice(0, MAX);
  }

  // Stats
  if(statsEl) statsEl.innerHTML =
    '<div class="sc"><span class="n">' + (tot > MAX ? MAX + '+' : tot) + '</span>Trovati</div>' +
    (sottoScorta ? '<div class="sc r"><span class="n" style="color:#e53e3e">' + sottoScorta + '</span>Sotto scorta</div>' : '') +
    (chronoMode === 'added' ? '<div class="sc"><span class="n" style="color:#68d391">3g</span>Ultimi aggiunti</div>' : '') +
    (chronoMode === 'modified' ? '<div class="sc"><span class="n" style="color:#63b3ed">3g</span>Ultimi modificati</div>' : '') +
    (chronoMode === 'modified' ? '<div class="sc"><span class="n" style="color:#63b3ed">' + results.length + '</span>Visualizzati: ' + results.length + ' articoli modificati negli ultimi 3 gg</div>' : '') +
    (Object.keys(_magDupCodes||{}).length ? '<div class="sc r"><span class="n" style="color:#f6ad55">' + Object.keys(_magDupCodes).length + '</span>Codici doppi</div>' : '');

  list.classList.toggle('mag-list--chrono', hasChrono);

  if(!results.length){
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Nessun risultato per <b style="color:var(--accent)">"' + esc(rawSearch) + '"</b></div>';
    return;
  }

  // ── Render card ───────────────────────────────────────────────────────────
  var html = '';
  results.forEach(function(o){
    var r = o.r, i = o.i, m = o.m, isLow = o.isLow;
    var codMJson = JSON.stringify(r.codM == null ? '' : String(r.codM));
    var qty    = o.qty !== null ? o.qty : '';
    var unit   = (typeof normalizeUmValue === 'function') ? normalizeUmValue(m.unit || 'pz') : (m.unit || 'pz');
    var specs  = m.specs  || '';
    var marca  = m.marca  || '';
    var sub    = m.subcat || '';
    var borderCol = isLow ? '#e53e3e' : 'var(--border)';

    // Categoria label
    var catLabel = '';
    if(m.cat && typeof categorie !== 'undefined'){
      var cf = categorie.find(function(c){ return c.id === m.cat; });
      catLabel = cf ? cf.nome : '';
    }

    // Sotto-categorie per il select dinamico
    var subsForCat = [];
    if(m.cat && typeof categorie !== 'undefined'){
      var cfx = categorie.find(function(x){ return x.id === m.cat; });
      if(cfx) subsForCat = cfx.sub || [];
    }

    var hasFoto = Object.prototype.hasOwnProperty.call(_idbCache, i) && !!_idbCache[i];
    var codM7 = r.codM ? (String(r.codM).match(/^\d+$/) ? String(r.codM).padStart(7,'0') : String(r.codM)) : '—';
    var dupKey = (typeof normalizeCodiceMagazzino === 'function') ? normalizeCodiceMagazzino(r.codM) : String(r.codM||'').trim();
    var isDupCode = !!(dupKey && _magDupCodes && _magDupCodes[dupKey] && _magDupCodes[dupKey].length > 1);

    html += '<div class="mag-card' + (hasChrono ? ' mag-card--chrono' : '') + '" style="position:relative;background:#1e1e1e;border:1px solid ' + borderCol + ';border-radius:10px;padding:10px 12px;margin-bottom:10px;' + (isLow ? 'box-shadow:0 0 0 1px #e53e3e33;' : '') + '">';
    if(hasChrono){
      html += '<div class="mag-card-chrono-actions" role="group" aria-label="Elimina articolo">';
      html += '<button type="button" class="mag-del-btn mag-del-btn--corner" onclick=\'magDeleteArticolo(' + i + ',' + codMJson + ')\' title="Elimina articolo">X</button>';
      html += '</div>';
    }

    // Badge sotto scorta
    if(isLow){
      html += '<div style="background:#e53e3e;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px;display:inline-block;">⚠ SCORTA BASSA — ' + qty + ' ' + unit + ' (min: ' + o.soglia + ')</div>';
    }
    if(isDupCode){
      html += '<div style="background:#dd6b20;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:0 0 6px 6px;display:inline-block;">⚠ CODICE DUPLICATO</div>';
    }

    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;' + (hasChrono ? 'min-height:40px;' : '') + '">';

    // Colonna sinistra: info
    html += '<div style="flex:1;min-width:0;padding-right:4px;">';
    html += '<div style="font-size:13px;font-weight:700;color:var(--text);">' + esc(r.desc || '—') + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:3px;">';
    if(sub)   html += '<span style="color:var(--accent);">' + esc(sub) + '</span> · ';
    if(marca) html += esc(marca) + ' · ';
    html += '<span style="color:#fc8181;font-weight:600;">' + esc(String(r.codF || '—')) + '</span>';
    html += ' <span style="color:#888;">/</span> ';
    html += '<span style="color:var(--accent);font-weight:600;">' + esc(codM7) + '</span>';
    html += '</div>';
    if(specs) html += '<div style="font-size:11px;color:#aaa;margin-top:4px;font-style:italic;">📐 ' + esc(specs) + '</div>';
    html += '</div>';

    // Colonna destra: foto + prezzo + qty (margin-top se cronologia: angolo per la X)
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;' + (hasChrono ? 'margin-top:34px;' : '') + '">';
    if(hasFoto){
      html += '<img src="' + _idbCache[i] + '" onclick="magZoomFoto(' + i + ')" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--accent);cursor:pointer;">';
      html += '<button onclick="magRimoviFoto(' + i + ')" style="font-size:9px;color:#e53e3e;background:transparent;border:none;cursor:pointer;padding:0;">rimuovi</button>';
    } else {
      html += '<button onclick="document.getElementById(\'mag-foto-inp-' + i + '\').click()" style="width:52px;height:52px;border-radius:8px;border:1px dashed #444;background:#111;color:#555;font-size:10px;cursor:pointer;line-height:1.3;">📷<br>foto</button>';
      html += '<input type="file" id="mag-foto-inp-' + i + '" accept="image/*" capture="environment" style="display:none;" onchange="magSalvaFoto(' + i + ',this)">';
    }
    html += '<div style="font-size:15px;font-weight:900;color:var(--accent);display:flex;align-items:center;gap:6px;">€ ' + esc(r.prezzo || '0') + (((r.isPromo===true && String(r.promoTipo||'')==='G') && typeof htmlPromoGBadge==='function') ? htmlPromoGBadge() : '') + '</div>';
    // Qty + unità
    html += '<div style="display:flex;gap:3px;align-items:center;">';
    html += '<input type="number" min="0" value="' + esc(String(qty)) + '" placeholder="Qtà" ' +
            'style="width:58px;padding:4px 6px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:13px;font-weight:700;text-align:center;" ' +
            'onchange="saveQta(' + i + ',this.value)" oninput="saveQta(' + i + ',this.value)">';
    html += '<select style="width:52px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--accent);font-size:11px;" onchange="saveMagRow(' + i + ',\'unit\',this.value)">';
    var umList = (typeof UM_STANDARD !== 'undefined' && UM_STANDARD && UM_STANDARD.length) ? UM_STANDARD : ['pz','kg','MQ','mt','conf'];
    umList.forEach(function(u){
      html += '<option value="' + u + '"' + (unit === u ? ' selected' : '') + '>' + u + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '</div>'; // fine colonna destra
    html += '</div>'; // fine flex principale

    // Riga dettagli: categoria + sotto-cat + marca + specs + bottone modifica
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;">';
    html += '<select style="flex:1;min-width:130px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" onchange="saveMagRow(' + i + ',\'cat\',this.value);renderMagazzino();">';
    html += '<option value="">— Categoria —</option>';
    if(typeof categorie !== 'undefined') categorie.forEach(function(cat){
      html += '<option value="' + cat.id + '"' + (m.cat === cat.id ? ' selected' : '') + '>' + esc(cat.nome) + '</option>';
    });
    html += '</select>';
    html += '<select style="flex:1;min-width:130px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" onchange="saveMagRow(' + i + ',\'subcat\',this.value)">';
    html += '<option value="">— Sotto-categoria —</option>';
    subsForCat.forEach(function(s){
      html += '<option' + (m.subcat === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    });
    html += '</select>';
    html += '<input type="text" placeholder="Marca" value="' + esc(marca) + '" ' +
            'style="width:100px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:11px;" ' +
            'onchange="saveMagRow(' + i + ',\'marca\',this.value)">';
    html += '</div>';
    html += '<input type="text" placeholder="📐 Specifiche tecniche (es: M6×30, IP44, 1000W...)" value="' + esc(specs) + '" ' +
            'style="width:100%;margin-top:6px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:#111;color:#aaa;font-size:11px;font-style:italic;" ' +
            'onchange="saveMagRow(' + i + ',\'specs\',this.value)">';
    html += '<div class="mag-card-footer-actions">';
    html += '<button type="button" onclick="openEditProdotto(' + i + ')" style="flex:1;padding:8px;border-radius:7px;border:1px solid var(--accent)44;background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;touch-action:manipulation;">✏️ Modifica articolo</button>';
    html += '<button type="button" class="mag-del-btn mag-del-btn--footer" onclick=\'magDeleteArticolo(' + i + ',' + codMJson + ')\' title="Elimina articolo">🗑</button>';
    html += '</div>';
    html += '</div>'; // fine card
  });

  // Banner più risultati
  if(tot > MAX){
    html += '<div style="text-align:center;padding:14px;font-size:12px;color:var(--muted);background:rgba(245,196,0,.04);border-radius:8px;margin-top:4px;">' +
            '📌 Mostrati <b style="color:var(--accent)">' + MAX + '</b> su <b>' + tot + '</b> — aggiungi parole per restringere.' +
            '</div>';
  }

  list.innerHTML = html;
}
