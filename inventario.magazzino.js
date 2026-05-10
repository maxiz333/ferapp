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
  var hasRevPrz  = (typeof magRevisionePrezzi !== 'undefined') && magRevisionePrezzi;
  var chronoMode = (typeof magChronoMode !== 'undefined') ? magChronoMode : 'none';
  var hasChrono  = chronoMode === 'added' || chronoMode === 'modified';
  var mode       = (typeof magMode !== 'undefined') ? magMode : 'prod';
  var nowMs = Date.now();
  var recentiLimitMs = (typeof magChronoCutoffMs === 'number' && magChronoCutoffMs > 0) ? magChronoCutoffMs : (nowMs - 72 * 60 * 60 * 1000);
  var recentiMaxMs = (typeof magChronoNowMs === 'number' && magChronoNowMs > 0) ? magChronoNowMs : nowMs;

  // Nessun criterio → placeholder
  if(!hasSearch && !hasFilter && !hasSottoSc && !hasChrono && !hasRevPrz){
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
  var revPrzCount = { giallo:0, arancio:0, rosso:0, neutro:0 };
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

    // Semaforo Prezzi: calcola freshness (riusato sia dal filtro che dal render)
    var freshness = (typeof getPriceFreshnessInfo === 'function') ? getPriceFreshnessInfo(r) : null;
    if(hasRevPrz){
      if(!freshness || freshness.bucket === 'verde') continue;
    }
    if(hasChrono){
      var cAt = (typeof getRowCreatedAt === 'function') ? getRowCreatedAt(r) : 0;
      if(chronoMode === 'added'){
        if(cAt < recentiLimitMs || cAt > recentiMaxMs) continue;
      } else if(chronoMode === 'modified'){
        var modAt = (typeof getRowModifiedChronoAt === 'function') ? getRowModifiedChronoAt(r, i) : 0;
        if(modAt < recentiLimitMs || modAt > recentiMaxMs) continue;
        if(typeof _magModifiedChronoHidden !== 'undefined' && _magModifiedChronoHidden[String(i)]) continue;
      }
    }

    tot++;
    if(isLow) sottoScorta++;
    if(freshness && freshness.bucket !== 'verde' && revPrzCount.hasOwnProperty(freshness.bucket)){
      revPrzCount[freshness.bucket]++;
    }
    if(hasChrono){
      results.push({r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty, freshness:freshness});
    } else if(results.length < MAX){
      results.push({r:r, i:i, m:m, isLow:isLow, soglia:soglia, qty:qty, freshness:freshness});
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

  // Stats (in cronologia: un solo conteggio leggibile, senza duplicare il numero)
  if(statsEl){
    var countDisp = tot > MAX ? MAX + '+' : String(tot);
    var statsParts = [];
    if(hasChrono){
      if(chronoMode === 'added'){
        statsParts.push('<div class="sc"><span class="n" style="color:#68d391">' + countDisp + '</span>Ultimi aggiunti (3 gg)</div>');
      } else {
        statsParts.push('<div class="sc"><span class="n" style="color:#63b3ed">' + countDisp + '</span>Ultimi modificati (3 gg)</div>');
      }
    } else {
      statsParts.push('<div class="sc"><span class="n">' + countDisp + '</span>Trovati</div>');
    }
    if(sottoScorta) statsParts.push('<div class="sc r"><span class="n" style="color:#e53e3e">' + sottoScorta + '</span>Sotto scorta</div>');
    if(hasRevPrz){
      var revTot = (revPrzCount.giallo||0) + (revPrzCount.arancio||0) + (revPrzCount.rosso||0) + (revPrzCount.neutro||0);
      var revColor = revPrzCount.rosso ? '#e53e3e' : (revPrzCount.arancio ? '#dd6b20' : (revPrzCount.giallo ? '#f6e05e' : '#6b7280'));
      var revTooltip = 'Rosso ' + (revPrzCount.rosso||0) + ' \u00b7 Arancio ' + (revPrzCount.arancio||0) + ' \u00b7 Giallo ' + (revPrzCount.giallo||0) + ' \u00b7 Mai verif. ' + (revPrzCount.neutro||0);
      statsParts.push('<div class="sc r" title="' + revTooltip + '"><span class="n" style="color:' + revColor + '">' + revTot + '</span>\uD83D\uDEA6 Da rivedere</div>');
    }
    if(Object.keys(_magDupCodes||{}).length) statsParts.push('<div class="sc r"><span class="n" style="color:#f6ad55">' + Object.keys(_magDupCodes).length + '</span>Codici doppi</div>');
    statsEl.innerHTML = statsParts.join('');
  }

  list.classList.toggle('mag-list--chrono', hasChrono);

  if(!results.length){
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Nessun risultato per <b style="color:var(--accent)">"' + esc(rawSearch) + '"</b></div>';
    return;
  }

  // ── Render card ───────────────────────────────────────────────────────────
  var html = '';
  results.forEach(function(o){
    var r = o.r, i = o.i, m = o.m, isLow = o.isLow;
    var freshnessRow = o.freshness;
    var codMJson = JSON.stringify(r.codM == null ? '' : String(r.codM));
    var qty    = o.qty !== null ? o.qty : '';
    var unit   = rowListinoUnit(r);
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
    var prezzoVend = r.prezzo || '0';
    var prezzoVec = r.prezzoOld || '—';
    var prezzoAcq = (m.prezzoAcquisto !== undefined && m.prezzoAcquisto !== null && String(m.prezzoAcquisto).trim() !== '') ? m.prezzoAcquisto : '—';
    var posizione = m.posizione || '—';
    var fornitore = m.nomeFornitore || '—';
    var sogliaTxt = (m.soglia !== undefined && m.soglia !== null && m.soglia !== '') ? String(m.soglia) : '0';
    var correlati = Array.isArray(m.correlati) ? m.correlati : [];
    var corrCount = 0;
    correlati.forEach(function(ri){
      if(rows && rows[ri]) corrCount++;
    });
    var scList = Array.isArray(m.scaglioni) ? m.scaglioni : [];
    var scActiveCount = 0;
    scList.forEach(function(s){
      if(s && String(s.prezzo || '').trim()) scActiveCount++;
    });

    html += '<div class="mag-card' + (hasChrono ? ' mag-card--chrono' : '') + '" style="position:relative;background:#1e1e1e;border:1px solid ' + borderCol + ';border-radius:10px;padding:10px 12px;margin-bottom:10px;' + (isLow ? 'box-shadow:0 0 0 1px #e53e3e33;' : '') + '">';
    if(hasChrono){
      var chronoXClick = (chronoMode === 'modified')
        ? 'magRemoveFromModifiedChronoView(' + i + ')'
        : 'magDeleteArticolo(' + i + ',' + codMJson + ')';
      var chronoXTitle = (chronoMode === 'modified')
        ? 'Nascondi dalla lista modificati (non elimina dal database)'
        : 'Elimina articolo dal database';
      var chronoXLabel = (chronoMode === 'modified') ? 'Lista modificati' : 'Elimina articolo';
      html += '<div class="mag-card-chrono-actions" role="group" aria-label="' + esc(chronoXLabel) + '">';
      html += '<button type="button" class="mag-del-btn mag-del-btn--corner" onclick=\'' + chronoXClick + '\' title="' + esc(chronoXTitle) + '">X</button>';
      html += '</div>';
    }

    // Badge sotto scorta
    if(isLow){
      html += '<div style="background:#e53e3e;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px;display:inline-block;">⚠ SCORTA BASSA — ' + qty + ' ' + unit + ' (min: ' + o.soglia + ')</div>';
    }
    if(isDupCode){
      html += '<div style="background:#dd6b20;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:0 0 6px 6px;display:inline-block;">⚠ CODICE DUPLICATO</div>';
    }

    html += '<div class="mag-card-section mag-card-section--a">';
    html += '<div class="mag-card-top">';
    html += '<div class="mag-card-main-col">';
    html += '<div class="mag-edit-label">Descrizione</div>';
    html += '<input type="text" class="mag-edit-input mag-edit-input--desc" value="' + esc(r.desc || '') + '" onblur="magCardSaveField(' + i + ',\'desc\',this.value)" placeholder="Descrizione prodotto">';
    html += '<div class="mag-edit-row mag-edit-row--triple">';
    html += '<div class="mag-edit-col"><div class="mag-edit-label mag-edit-label--forn">Cod. Forn.</div><input type="text" class="mag-edit-input mag-edit-input--codef" value="' + esc(String(r.codF || '')) + '" onblur="magCardSaveField(' + i + ',\'codF\',this.value)"></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label mag-edit-label--mag">Mio Cod.</div><input type="text" class="mag-edit-input mag-edit-input--codem" value="' + esc(String(r.codM || '')) + '" onblur="magCardSaveField(' + i + ',\'codM\',this.value)"></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Acq.</div><input type="text" class="mag-edit-input mag-edit-input--meta" value="' + esc(String(prezzoAcq === '—' ? '' : prezzoAcq)) + '" onblur="magCardSaveField(' + i + ',\'prezzoAcquisto\',this.value)"></div>';
    html += '</div>';
    var dotHtml = '';
    if(freshnessRow && freshnessRow.dot){
      var ttl = freshnessRow.label + (freshnessRow.days != null ? ' (' + freshnessRow.days + ' gg)' : '');
      dotHtml = '<span title="' + esc(ttl) + '" class="mag-price-dot" style="background:' + freshnessRow.color + ';"></span>';
    }
    html += '<div class="mag-edit-row mag-edit-row--triple">';
    html += '<div class="mag-edit-col"><div class="mag-edit-label mag-edit-label--vend">Vend.</div><div class="mag-edit-price-wrap">' + dotHtml + '<input type="text" class="mag-edit-input mag-edit-input--price" value="' + esc(String(prezzoVend || '')) + '" onblur="magCardSaveField(' + i + ',\'prezzo\',this.value)"><button type="button" class="mag-price-check-btn" title="Aggiorna solo il timestamp prezzo" onclick="magCardPrezzoVerificato(' + i + ')">✓</button></div></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Vec.</div><input type="text" class="mag-edit-input mag-edit-input--meta" value="' + esc(String(prezzoVec === '—' ? '' : prezzoVec)) + '" onblur="magCardSaveField(' + i + ',\'prezzoOld\',this.value)"></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Promo</div><button type="button" class="mag-promo-toggle' + ((r.isPromo===true && String(r.promoTipo||'')==='G') ? ' is-on' : '') + '" onclick="magCardTogglePromoG(' + i + ')">[G]</button></div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="mag-card-side-col' + (hasChrono ? ' mag-card-side-col--chrono' : '') + '">';
    if(hasFoto){
      html += '<img src="' + _idbCache[i] + '" onclick="magZoomFoto(' + i + ')" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--accent);cursor:pointer;">';
      html += '<button onclick="magRimoviFoto(' + i + ')" style="font-size:9px;color:#e53e3e;background:transparent;border:none;cursor:pointer;padding:0;">rimuovi</button>';
    } else {
      html += '<button onclick="document.getElementById(\'mag-foto-inp-' + i + '\').click()" style="width:52px;height:52px;border-radius:8px;border:1px dashed #444;background:#111;color:#555;font-size:10px;cursor:pointer;line-height:1.3;">📷<br>foto</button>';
      html += '<input type="file" id="mag-foto-inp-' + i + '" accept="image/*" capture="environment" style="display:none;" onchange="magSalvaFoto(' + i + ',this)">';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Sezione B: logistica
    html += '<div class="mag-card-section mag-card-section--b">';
    html += '<div class="mag-edit-row mag-edit-row--logistics">';
    html += '<div class="mag-edit-col mag-edit-col--qty"><div class="mag-edit-label">Qtà</div><div class="mag-edit-qty-wrap"><button type="button" class="mag-edit-qty-btn" onclick="magCardDeltaQty(' + i + ',-1)">−</button><input type="number" min="0" id="mag-qty-' + i + '" value="' + esc(String(qty)) + '" placeholder="Qtà" class="mag-edit-input mag-edit-input--qty" onblur="magCardSaveField(' + i + ',\'qty\',this.value)"><button type="button" class="mag-edit-qty-btn" onclick="magCardDeltaQty(' + i + ',1)">+</button></div></div>';
    html += '<div class="mag-edit-col mag-edit-col--unit"><div class="mag-edit-label">Unità</div><select id="mag-unit-' + i + '" class="mag-edit-select mag-edit-select--unit" onchange="magCardSaveField(' + i + ',\'unit\',this.value)">';
    var umList = (typeof UM_STANDARD !== 'undefined' && UM_STANDARD && UM_STANDARD.length) ? UM_STANDARD : ['pz','kg','MQ','mt','conf','CT','RT','FG'];
    umList.forEach(function(u){
      html += '<option value="' + u + '"' + (unit === u ? ' selected' : '') + '>' + u + '</option>';
    });
    html += '</select></div>';
    html += '<div class="mag-edit-col mag-edit-col--scorta"><div class="mag-edit-label">Scorta</div><input type="number" min="0" class="mag-edit-input mag-edit-input--danger" value="' + esc(sogliaTxt) + '" onblur="magCardSaveField(' + i + ',\'soglia\',this.value)"></div>';
    html += '</div>';
    html += '</div>';

    // Sezione C: anagrafica
    html += '<div class="mag-card-section mag-card-section--c">';
    html += '<div class="mag-edit-row mag-edit-row--anag">';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Marca</div><input type="text" class="mag-edit-input mag-edit-input--meta" value="' + esc(marca) + '" onblur="magCardSaveField(' + i + ',\'marca\',this.value)"></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Posizione</div><input type="text" class="mag-edit-input mag-edit-input--italic" value="' + esc(posizione === '—' ? '' : posizione) + '" onblur="magCardSaveField(' + i + ',\'posizione\',this.value)"></div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Fornitore</div><input type="text" class="mag-edit-input mag-edit-input--meta" value="' + esc(fornitore === '—' ? '' : fornitore) + '" onblur="magCardSaveField(' + i + ',\'nomeFornitore\',this.value)"></div>';
    html += '</div>';
    html += '</div>';

    // Sezione D: classificazione + specifiche
    html += '<div class="mag-card-section mag-card-section--d">';
    html += '<div class="mag-edit-row">';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Categoria</div><select class="mag-edit-select" onchange="magCardSaveField(' + i + ',\'cat\',this.value)">';
    html += '<option value="">— Categoria —</option>';
    if(typeof categorie !== 'undefined') categorie.forEach(function(cat){
      html += '<option value="' + cat.id + '"' + (m.cat === cat.id ? ' selected' : '') + '>' + esc(cat.nome) + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div class="mag-edit-col"><div class="mag-edit-label">Sottocategoria</div><select class="mag-edit-select" onchange="magCardSaveField(' + i + ',\'subcat\',this.value)">';
    html += '<option value="">— Sotto-categoria —</option>';
    subsForCat.forEach(function(s){
      html += '<option' + (m.subcat === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '</div>';
    html += '<div class="mag-edit-label">Specifiche</div>';
    html += '<textarea class="mag-edit-textarea" onblur="magCardSaveField(' + i + ',\'specs\',this.value)" placeholder="Specifiche tecniche...">' + esc(specs) + '</textarea>';
    html += '</div>';

    // Sezione E: avanzate correlati + scaglioni
    html += '<div class="mag-card-section mag-card-section--e">';
    var advOpen = !!(_magCardUiState.adv && _magCardUiState.adv[String(i)]);
    html += '<div class="mag-meta-band mag-meta-band--cat">';
    html += '<div class="mag-meta-pair"><span class="mag-meta-label">Cat</span><span class="mag-meta-value">' + esc(catLabel || '—') + ' / ' + esc(sub || '—') + '</span></div>';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<span class="mag-badge-inline" title="Articoli correlati in scheda prodotto">🔄 ' + corrCount + '</span>';
    if(scActiveCount > 0) html += '<span class="mag-badge-inline" title="Scaglioni prezzo configurati">📦 ' + scActiveCount + '</span>';
    html += '<button type="button" class="mag-edit-adv-btn" onclick="magCardToggleAdvanced(' + i + ')">' + (advOpen ? 'Nascondi' : 'Avanzate') + '</button>';
    html += '</div>';
    html += '</div>';
    if(advOpen){
      html += '<div class="mag-card-adv">';
      html += '<div class="mag-edit-label">Correlati</div>';
      html += '<div class="mag-meta-band" style="margin-top:0;">';
      html += '<input type="text" id="mag-correlati-add-' + i + '" class="mag-edit-input" placeholder="Codice o descrizione...">';
      html += '<button type="button" class="mag-edit-adv-btn" onclick="magCardAddCorrelato(' + i + ')">+ Collega</button>';
      html += '</div>';
      if(correlati.length){
        html += '<div class="mag-chip-wrap">';
        correlati.forEach(function(ri){
          if(!rows[ri]) return;
          html += '<span class="mag-chip">' + esc(rows[ri].desc || ('#' + ri)) + '<button type="button" onclick="magCardRemoveCorrelato(' + i + ',' + ri + ')">×</button></span>';
        });
        html += '</div>';
      }
      html += '<div class="mag-edit-label" style="margin-top:6px;">Scaglioni</div>';
      html += '<div class="mag-meta-band" style="margin-top:0;"><button type="button" class="mag-edit-adv-btn" onclick="magCardAddScaglione(' + i + ')">+ Scaglione</button></div>';
      if(scList.length){
        scList.forEach(function(s, si){
          var daV = (s && s.da != null) ? s.da : '';
          var aV = (s && s.a != null) ? s.a : '';
          var pV = (s && s.prezzo != null) ? s.prezzo : '';
          html += '<div class="mag-sc-row">';
          html += '<input type="number" class="mag-edit-input mag-edit-input--mini" placeholder="Da" value="' + esc(String(daV)) + '" onblur="magCardUpdScaglione(' + i + ',' + si + ',\'da\',this.value)">';
          html += '<input type="number" class="mag-edit-input mag-edit-input--mini" placeholder="A" value="' + esc(String(aV)) + '" onblur="magCardUpdScaglione(' + i + ',' + si + ',\'a\',this.value)">';
          html += '<input type="text" class="mag-edit-input mag-edit-input--mini" placeholder="Prezzo" value="' + esc(String(pV)) + '" onblur="magCardUpdScaglione(' + i + ',' + si + ',\'prezzo\',this.value)">';
          html += '<button type="button" class="mag-edit-adv-btn mag-edit-adv-btn--danger" onclick="magCardDelScaglione(' + i + ',' + si + ')">×</button>';
          html += '</div>';
        });
      }
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="mag-card-footer-actions">';
    html += '<button type="button" class="mag-quick-save-btn" onclick="magCardSaveBatch(' + i + ')">💾 Salva rapido</button>';
    html += '<button type="button" onclick="openEditProdotto(' + i + ')" style="flex:1;padding:8px;border-radius:7px;border:1px solid var(--accent)44;background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;touch-action:manipulation;">✏️ Modifica articolo</button>';
    var footDelClick = (hasChrono && chronoMode === 'modified')
      ? 'magRemoveFromModifiedChronoView(' + i + ')'
      : 'magDeleteArticolo(' + i + ',' + codMJson + ')';
    var footDelTitle = (hasChrono && chronoMode === 'modified')
      ? 'Nascondi dalla lista modificati (non elimina dal database)'
      : 'Elimina articolo dal database';
    html += '<button type="button" class="mag-del-btn mag-del-btn--footer" onclick=\'' + footDelClick + '\' title="' + esc(footDelTitle) + '">🗑</button>';
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

var _magCardUiState = { adv: {} };

function _magCardPersist(i, opts){
  if(!rows || !rows[i]) return;
  opts = opts || {};
  if(rows[i]) rows[i]._updatedAt = Date.now();
  if(magazzino && magazzino[i]) magazzino[i]._updatedAt = Date.now();
  if(rows.length <= 5000) lsSet(SK, rows);
  lsSet(MAGK, magazzino);
  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(i);
  if(typeof updateStats === 'function') updateStats();
  if(typeof updateStockBadge === 'function') updateStockBadge();
  if(opts.toast && typeof showToastGen === 'function') showToastGen('green', opts.toast);
  if(opts.rerender && typeof renderMagazzino === 'function') renderMagazzino();
}

function magCardSaveField(i, field, value){
  if(!rows || !rows[i]) return;
  if(!magazzino[i]) magazzino[i] = {};
  var r = rows[i];
  var m = magazzino[i];
  var changed = false;
  var productTouched = false;
  var priceTouched = false;
  var needRerender = false;
  var v = (value == null) ? '' : String(value);

  if(field === 'desc'){
    if(String(r.desc || '') !== v){ r.desc = v; changed = true; }
  } else if(field === 'codF'){
    if(String(r.codF || '') !== v){ r.codF = v; changed = true; }
  } else if(field === 'codM'){
    var codM = (typeof sanitizeCodiceMagazzinoInput === 'function') ? sanitizeCodiceMagazzinoInput(v) : v;
    if(typeof findDuplicateCodMagazzino === 'function'){
      var dup = findDuplicateCodMagazzino(codM, i);
      if(dup){
        if(typeof showCodiceMagazzinoDuplicateError === 'function') showCodiceMagazzinoDuplicateError(codM, dup.desc);
        return;
      }
    }
    if(String(r.codM || '') !== String(codM)){ r.codM = codM; changed = true; }
  } else if(field === 'prezzo'){
    var np = String(v || '').trim();
    if(np && String(r.prezzo || '') !== np){
      if(!r.priceHistory) r.priceHistory = [];
      if(r.prezzo){
        r.priceHistory.unshift({ prezzo:r.prezzo, data:new Date().toLocaleDateString('it-IT') });
        if(r.priceHistory.length > 30) r.priceHistory.length = 30;
      }
      r.prezzoOld = r.prezzo || r.prezzoOld || '';
      r.prezzo = np;
      r.size = (typeof autoSize === 'function') ? autoSize(np) : r.size;
      changed = true;
      productTouched = true;
      priceTouched = true;
      needRerender = true;
    }
  } else if(field === 'prezzoOld'){
    if(String(r.prezzoOld || '') !== v){ r.prezzoOld = v; changed = true; }
  } else if(field === 'prezzoAcquisto'){
    if(String(m.prezzoAcquisto || '') !== v){ m.prezzoAcquisto = v; changed = true; }
  } else if(field === 'qty'){
    var prevQty = (m.qty !== undefined && m.qty !== '') ? Number(m.qty) : null;
    var newQty = (v === '') ? '' : parseFloat(v);
    if(v !== '' && isNaN(newQty)) return;
    m.qty = newQty;
    var n1 = (prevQty === null || prevQty === undefined) ? null : Number(prevQty);
    var n2 = (newQty === '' || newQty === null || newQty === undefined) ? null : Number(newQty);
    if(n1 !== n2){
      changed = true;
      productTouched = true;
      if(typeof checkScorta === 'function') checkScorta(i, n2, n1);
      if(n1 !== null && n2 !== null && n1 !== n2 && typeof registraMovimento === 'function'){
        var delta = n2 - n1;
        var tipo = delta < 0 ? 'vendita' : 'carico';
        registraMovimento(i, tipo, delta, n1, n2, 'modifica card magazzino');
      }
    }
  } else if(field === 'unit'){
    var unit = (typeof normalizeUmValue === 'function') ? normalizeUmValue(v) : v;
    if(String(rowListinoUnit(r) || 'pz') !== String(unit || 'pz')){
      r.unit = unit || 'pz';
      changed = true;
    }
  } else if(field === 'soglia'){
    var sog = (v === '') ? 0 : parseFloat(v);
    if(isNaN(sog)) sog = 0;
    if(Number(m.soglia || 0) !== sog){ m.soglia = sog; changed = true; }
  } else if(field === 'marca'){
    if(String(m.marca || '') !== v){ m.marca = v; changed = true; }
  } else if(field === 'posizione'){
    if(String(m.posizione || '') !== v){ m.posizione = v; changed = true; }
  } else if(field === 'nomeFornitore'){
    if(String(m.nomeFornitore || '') !== v){ m.nomeFornitore = v; changed = true; }
  } else if(field === 'cat'){
    if(String(m.cat || '') !== v){
      m.cat = v;
      if(m.subcat){
        var cat = (typeof categorie !== 'undefined' && Array.isArray(categorie))
          ? categorie.find(function(c){ return c.id === v; })
          : null;
        var subOk = !!(cat && Array.isArray(cat.sub) && cat.sub.indexOf(m.subcat) >= 0);
        if(!subOk) m.subcat = '';
      }
      changed = true;
      needRerender = true;
    }
  } else if(field === 'subcat'){
    if(String(m.subcat || '') !== v){ m.subcat = v; changed = true; }
  } else if(field === 'specs'){
    if(String(m.specs || '') !== v){ m.specs = v; changed = true; }
  } else if(field === 'promoTipo'){
    needRerender = true;
  }

  if(!changed) return;
  if(productTouched && typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
  if(priceTouched && typeof touchRowPriceUpdate === 'function') touchRowPriceUpdate(r);
  _magCardPersist(i, { rerender:needRerender });
}

function magCardSaveBatch(i){
  _magCardPersist(i, { rerender:true, toast:'Salvato' });
}

function magCardPrezzoVerificato(i){
  if(!rows || !rows[i]) return;
  if(typeof touchRowPriceUpdate !== 'function') return;
  touchRowPriceUpdate(rows[i]);
  _magCardPersist(i, { rerender:true, toast:'Prezzo verificato' });
}

function magCardDeltaQty(i, delta){
  var inp = document.getElementById('mag-qty-' + i);
  var cur = inp ? (parseFloat(inp.value) || 0) : 0;
  var nxt = Math.max(0, cur + delta);
  if(inp) inp.value = String(nxt);
  magCardSaveField(i, 'qty', nxt);
}

function magCardTogglePromoG(i){
  if(!rows || !rows[i]) return;
  var r = rows[i];
  var isOn = r.isPromo === true && String(r.promoTipo || '') === 'G';
  r.isPromo = !isOn;
  r.promoTipo = !isOn ? 'G' : '';
  if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
  _magCardPersist(i, { rerender:true });
}

function magCardToggleAdvanced(i){
  var k = String(i);
  _magCardUiState.adv[k] = !_magCardUiState.adv[k];
  renderMagazzino();
}

function magCardAddCorrelato(i){
  if(!rows || !rows[i]) return;
  if(!magazzino[i]) magazzino[i] = {};
  var inp = document.getElementById('mag-correlati-add-' + i);
  var raw = inp ? String(inp.value || '').trim() : '';
  if(!raw) return;
  var target = -1;
  var norm = raw.toLowerCase();
  for(var ri = 0; ri < rows.length; ri++){
    if(ri === i || !rows[ri]) continue;
    var cod = String(rows[ri].codM || '').toLowerCase();
    var desc = String(rows[ri].desc || '').toLowerCase();
    if(cod === norm || desc.indexOf(norm) >= 0){ target = ri; break; }
  }
  if(target < 0){
    if(typeof showToastGen === 'function') showToastGen('orange', 'Correlato non trovato');
    return;
  }
  if(!magazzino[i].correlati) magazzino[i].correlati = [];
  if(magazzino[i].correlati.indexOf(target) < 0) magazzino[i].correlati.push(target);
  if(!magazzino[target]) magazzino[target] = {};
  if(!magazzino[target].correlati) magazzino[target].correlati = [];
  if(magazzino[target].correlati.indexOf(i) < 0) magazzino[target].correlati.push(i);
  if(inp) inp.value = '';
  _magCardPersist(i, { rerender:true });
  if(target !== i && typeof _fbSaveArticolo === 'function') _fbSaveArticolo(target);
}

function magCardRemoveCorrelato(i, ri){
  if(!magazzino[i] || !Array.isArray(magazzino[i].correlati)) return;
  magazzino[i].correlati = magazzino[i].correlati.filter(function(x){ return x !== ri; });
  if(magazzino[ri] && Array.isArray(magazzino[ri].correlati)){
    magazzino[ri].correlati = magazzino[ri].correlati.filter(function(x){ return x !== i; });
  }
  _magCardPersist(i, { rerender:true });
  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(ri);
}

function magCardAddScaglione(i){
  if(!magazzino[i]) magazzino[i] = {};
  if(!Array.isArray(magazzino[i].scaglioni)) magazzino[i].scaglioni = [];
  var sc = magazzino[i].scaglioni;
  var prevA = sc.length ? (sc[sc.length - 1].a || null) : null;
  sc.push({ da: prevA ? Number(prevA) + 1 : 1, a: null, prezzo: '' });
  _magCardPersist(i, { rerender:true });
}

function magCardUpdScaglione(i, si, field, val){
  if(!magazzino[i] || !Array.isArray(magazzino[i].scaglioni) || !magazzino[i].scaglioni[si]) return;
  var s = magazzino[i].scaglioni[si];
  if(field === 'da' || field === 'a'){
    var n = parseInt(val, 10);
    s[field] = isNaN(n) ? null : n;
  } else if(field === 'prezzo'){
    s.prezzo = String(val || '').trim();
  }
  _magCardPersist(i, { rerender:false });
}

function magCardDelScaglione(i, si){
  if(!magazzino[i] || !Array.isArray(magazzino[i].scaglioni)) return;
  magazzino[i].scaglioni.splice(si, 1);
  _magCardPersist(i, { rerender:true });
}
