// ══ CARTELLINI TOOL ═════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  TAB CARTELLINI (t1) — caricamento lazy e cap ridotto su mobile
//
//  Problema: renderTable() viene chiamata da init() all'avvio E ogni volta
//  che si apre t1, renderizzando fino a 300 righe con <input> editabili.
//  Su mobile 300 input nel DOM = crash / freeze.
//
//  Soluzione:
//  • _tablePageSize ridotto a 50 su mobile (≤768px), 100 su desktop
//  • renderTable() soppressa durante init() se t1 non è visibile
//  • goTabDirect override: per t1 mostra banner + ricerca prima di caricare
// ═══════════════════════════════════════════════════════════════════════════════

// ── Riduce _tablePageSize su mobile ──────────────────────────────────────────
(function(){
  var isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if(typeof _tablePageSize !== 'undefined'){
    _tablePageSize = isMobile ? 50 : 100;
  }
})();

// ── Lazy loading tab Cartellini (t1) ─────────────────────────────────────────
// NON sovrascriviamo goTabDirect (causa loop per hoisting).
// Usiamo un flag: _t1LazyPending viene controllato dentro renderTable
// che è chiamata da goTabDirect quando id==='t1'.
var _t1LazyPending = false;

// Intercetta i click sui bottoni che portano a t1 nell'HTML
// aggiungendo il flag prima che goTabDirect chiami renderTable
document.addEventListener('click', function(e){
  var btn = e.target.closest('button[onclick]');
  if(!btn) return;
  var oc = btn.getAttribute('onclick') || '';
  // Controlla se il click porta alla tab t1
  if(oc.indexOf("goTab('t1')") >= 0 || oc.indexOf('goTab("t1")') >= 0 ||
     oc.indexOf("goTabDirect('t1')") >= 0){
    _t1LazyPending = true;
  }
}, true); // capture phase: scatta PRIMA di onclick

// Sovrascrive renderTable con una versione che mostra il banner lazy
// quando _t1LazyPending è attivo e ci sono molti articoli.
// USA var + IIFE per evitare il bug di hoisting delle function declaration.
var renderTable = (function(_origRenderTable){
  return function(){
    if(_t1LazyPending){
      _t1LazyPending = false;
      var cap = (typeof _tablePageSize !== 'undefined') ? _tablePageSize : 50;
      var total = rows ? rows.filter(function(r,i){ return r && !removed.has(String(i)); }).length : 0;
      if(total > cap){
        // Mostra banner invece di caricare tutto
        var tb = document.getElementById('tb');
        if(tb){
          tb.innerHTML = '';
          var tr = document.createElement('tr');
          tr.id = '_cart_lazy_banner';
          tr.innerHTML =
            '<td colspan="12" style="padding:30px 20px;text-align:center;background:#1a1a1a;">' +
            '<div style="font-size:32px;margin-bottom:10px;">🏷️</div>' +
            '<div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:6px;">' +
            (rows ? rows.length.toLocaleString('it-IT') : '0') + ' articoli nel database' +
            '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-bottom:16px;">' +
            'Usa 🔍 la ricerca sopra, oppure carica i primi ' + cap + '.' +
            '</div>' +
            '<button onclick="_tableShowAll=false;renderTable();if(typeof genTags===\'function\')genTags();" ' +
            'style="padding:10px 24px;border-radius:10px;border:none;background:var(--accent);color:#111;font-size:14px;font-weight:800;cursor:pointer;touch-action:manipulation;">' +
            '📋 Carica i primi ' + cap + '</button>' +
            '</td>';
          tb.appendChild(tr);
          if(typeof updateStats === 'function') updateStats();
          return; // non chiamare _origRenderTable
        }
      }
    }
    // Comportamento normale
    _origRenderTable();
  };
})(renderTable); // cattura renderTable dei moduli database.* QUI, prima dell'assegnazione


// ═══════════════════════════════════════════════════════════════════════════════
//  CT — CARTELLINI TOOL  (array separato da rows[])
//
//  ARCHITETTURA:
//  • rows[]   = database Firebase (19.000 articoli, caricato da loadMagazzinoFB)
//  • ctRows[] = cartellini selezionati per la stampa (chiave localStorage CTK)
//  • I due array non si sovrascrivono mai
// ═══════════════════════════════════════════════════════════════════════════════

var _fbSyncingCt = false; // flag per evitare loop sync Firebase cartellini
var _ctTab = 'dafare'; // tab attiva: 'dafare' | 'temp' | 'fatti'
var _ctLastDupFattiReportAt = 0;
var _ctFattiSearch = '';

function ctCodiceArticolo(r){
  return String(r && r.codM || '').trim().toUpperCase();
}

function ct_isDafare(r){ return r && !r.fatto && !r.temp; }
function ct_isTemp(r){ return r && !r.fatto && !!r.temp; }
function ct_isFatto(r){ return r && !!r.fatto; }

/** Evidenziazione cross-tab: peerInOther = anche in Temp (su Da fare) o in Da fare (su Temp). */
function ct_crossTabRowStyle(rowStyle, code, peerInOther, peerInFatti){
  var out = { rowStyle: rowStyle, crossActive: false, showInDafareBadge: false };
  if(!code) return out;
  var inOther = !!peerInOther;
  var inFatti = !!peerInFatti;
  if(inOther && inFatti){
    out.rowStyle = out.rowStyle.replace(/border-left:3px solid [^;]+;/, '');
    out.rowStyle += 'box-shadow:inset 3px 0 0 #e53e3e,inset 6px 0 0 #38a169;';
    out.rowStyle += 'background:linear-gradient(90deg,rgba(229,62,62,.14),rgba(56,161,105,.14));';
    out.crossActive = true;
    out.showInDafareBadge = inOther;
    return out;
  }
  if(inOther){
    out.rowStyle = out.rowStyle.replace(/border-left:3px solid [^;]+;/, 'border-left:3px solid #e53e3e;');
    out.rowStyle += 'background:linear-gradient(90deg,rgba(229,62,62,.18),rgba(229,62,62,.06));';
    out.crossActive = true;
    out.showInDafareBadge = true;
    return out;
  }
  if(inFatti){
    out.rowStyle = out.rowStyle.replace(/border-left:3px solid [^;]+;/, 'border-left:3px solid #38a169;');
    out.rowStyle += 'background:linear-gradient(90deg,rgba(56,161,105,.18),rgba(56,161,105,.06));';
  }
  return out;
}
function ct_filterPrintable(rows){
  return (rows || []).filter(function(r){ return ct_isDafare(r); });
}

/** Sposta la riga all'indice i in cima al sottoinsieme indicato (dafare/temp/fatti). */
function ct_bringToFront(i, isMember){
  if(isNaN(i) || i < 0 || i >= ctRows.length || !isMember(ctRows[i])) return;
  var row = ctRows.splice(i, 1)[0];
  var insertAt = ctRows.findIndex(isMember);
  if(insertAt < 0){
    if(isMember === ct_isFatto){
      insertAt = ctRows.length;
    } else {
      insertAt = ctRows.findIndex(function(r){ return !ct_isFatto(r); });
      if(insertAt < 0) insertAt = ctRows.length;
    }
  }
  ctRows.splice(insertAt, 0, row);
}

function ctFindActiveDuplicateByCode(code){
  if(!code) return null;
  for(var i = 0; i < ctRows.length; i++){
    var r = ctRows[i];
    if(r && !r.fatto && ctCodiceArticolo(r) === code) return { row: r, idx: i };
  }
  return null;
}

function ctFindDoneHistoryByCode(code){
  if(!code) return null;
  for(var i = 0; i < ctRows.length; i++){
    var r = ctRows[i];
    if(r && r.fatto && ctCodiceArticolo(r) === code){
      return { row: r, idx: i, data: r.fattoData || r.data || '' };
    }
  }
  return null;
}

function ctWarnDoneHistory(row){
  var code = ctCodiceArticolo(row);
  var old = ctFindDoneHistoryByCode(code);
  if(old && typeof showToastGen === 'function'){
    showToastGen('yellow', 'Attenzione: hai già stampato un cartellino per questo codice il giorno ' + (old.data || 'non indicato'));
  }
}

function ctConfirmAddDuplicate(row){
  var code = ctCodiceArticolo(row);
  if(!code) return true;
  var dup = ctFindActiveDuplicateByCode(code);
  if(!dup) return true;
  return window.confirm('Articolo già in lista, vuoi aggiungerlo di nuovo?');
}

function ctPrepareImportRows(rowsToAdd){
  var accepted = [];
  var activeDup = [];
  var doneWarnings = [];
  var seenInBatch = {};
  (rowsToAdd || []).forEach(function(row){
    var code = ctCodiceArticolo(row);
    if(!code){
      accepted.push(row);
      return;
    }
    var active = ctFindActiveDuplicateByCode(code) || seenInBatch[code];
    if(active) activeDup.push(row);
    else accepted.push(row);
    seenInBatch[code] = { row: row };
    var done = ctFindDoneHistoryByCode(code);
    if(done) doneWarnings.push({ code: code, data: done.data || 'non indicato' });
  });
  if(activeDup.length){
    var codes = activeDup.map(function(r){ return ctCodiceArticolo(r); }).filter(Boolean).slice(0, 8).join(', ');
    var ok = window.confirm(activeDup.length + ' articoli sono già nella lista di stampa di oggi' + (codes ? ' (' + codes + ')' : '') + '. Vuoi aggiungerli di nuovo?');
    if(ok) accepted = accepted.concat(activeDup);
  }
  if(doneWarnings.length && typeof showToastGen === 'function'){
    var first = doneWarnings.slice(0, 3).map(function(x){ return x.code + ' (' + x.data + ')'; }).join(', ');
    showToastGen('yellow', 'Attenzione: già stampati in passato: ' + first + (doneWarnings.length > 3 ? ' +' + (doneWarnings.length - 3) : ''));
  }
  return accepted;
}

function ctReportDuplicatiFatti(){
  var map = {};
  (ctRows || []).forEach(function(r){
    if(!r || !r.fatto) return;
    var code = ctCodiceArticolo(r);
    if(!code) return;
    if(!map[code]) map[code] = [];
    map[code].push(r);
  });
  var dup = Object.keys(map).filter(function(code){ return map[code].length > 1; });
  if(!dup.length) return 0;
  var msg = 'Duplicati nei cartellini fatti: ' + dup.slice(0, 6).map(function(code){
    return code + ' x' + map[code].length;
  }).join(', ') + (dup.length > 6 ? ' +' + (dup.length - 6) : '');
  if(typeof showToastGen === 'function') showToastGen('orange', msg);
  return dup.length;
}

function ctUpdateSearchPlaceholder(){
  var inp = document.getElementById('ct-search');
  var res = document.getElementById('ct-search-results');
  if(!inp) return;
  if(_ctTab === 'fatti'){
    inp.placeholder = '🔍 Cerca nei cartellini fatti...';
    _ctFattiSearch = String(inp.value || '').trim();
    if(res){ res.style.display = 'none'; res.innerHTML = ''; }
  } else if(_ctTab === 'temp'){
    inp.placeholder = '🔍 Cerca nei cartellini parcheggiati...';
    _ctFattiSearch = String(inp.value || '').trim();
    if(res){ res.style.display = 'none'; res.innerHTML = ''; }
  } else {
    inp.placeholder = '🔍 Cerca articolo dal database e aggiungi...';
    _ctFattiSearch = '';
  }
}

// ── Riordino righe (SortableJS) ───────────────────────────────────────────────
var _ctSortableInstance = null;

/** Indici reali in ctRows[] per la tab/filtro corrente (stessa logica di CT.render). */
function ct_buildRealIndices(){
  var realIndices = [];
  ctRows.forEach(function(r, i){
    if(_ctTab === 'fatti' && ct_isFatto(r)) realIndices.push(i);
    else if(_ctTab === 'temp' && ct_isTemp(r)) realIndices.push(i);
    else if(_ctTab === 'dafare' && ct_isDafare(r)) realIndices.push(i);
  });
  if((_ctTab === 'fatti' || _ctTab === 'temp') && _ctFattiSearch){
    var qLocal = _ctFattiSearch.toLowerCase();
    realIndices = realIndices.filter(function(i){
      var r = ctRows[i] || {};
      return [
        r.desc || '',
        r.codM || '',
        r.codF || '',
        r.prezzo || '',
        r.prezzoOld || '',
        r.fattoData || '',
        r.data || ''
      ].join(' ').toLowerCase().indexOf(qLocal) >= 0;
    });
  }
  return realIndices;
}

/** Riordina il sottoinsieme visibile senza spostare righe dell'altra tab. */
function ct_reorderInTab(fromDisplayIdx, toDisplayIdx){
  if(fromDisplayIdx === toDisplayIdx) return false;
  if((_ctTab === 'fatti' || _ctTab === 'temp') && _ctFattiSearch) return false;
  var realIndices = ct_buildRealIndices();
  if(fromDisplayIdx < 0 || toDisplayIdx < 0 ||
     fromDisplayIdx >= realIndices.length || toDisplayIdx >= realIndices.length) return false;
  var subset = realIndices.map(function(i){ return ctRows[i]; });
  var moved = subset.splice(fromDisplayIdx, 1)[0];
  subset.splice(toDisplayIdx, 0, moved);
  var newRows = ctRows.slice();
  realIndices.forEach(function(realIdx, displayIdx){
    newRows[realIdx] = subset[displayIdx];
  });
  ctRows = newRows;
  CT.save();
  ct_refreshPrintPreviewIfOpen();
  return true;
}

function ct_refreshPrintPreviewIfOpen(){
  var pov = document.getElementById('pov');
  if(!pov || !pov.classList.contains('open') || typeof buildTagsHTML !== 'function') return;
  var printable = ct_filterPrintable(ctRows);
  var html = buildTagsHTML(printable, false);
  var pc = document.getElementById('pc');
  if(pc) pc.innerHTML = html;
  var pa = document.getElementById('print-area');
  if(pa) pa.innerHTML = html;
  var pat1 = document.getElementById('print-area-t1');
  if(pat1) pat1.innerHTML = html;
}

function ct_initMobileReorder(){
  if(_ctSortableInstance){
    try{ _ctSortableInstance.destroy(); }catch(e){}
    _ctSortableInstance = null;
  }
  if(typeof Sortable === 'undefined') return;
  var tbody = document.getElementById('ct-sortable-tbody');
  if(!tbody) return;
  _ctSortableInstance = Sortable.create(tbody, {
    animation: 150,
    delay: 450,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    filter: 'input, select, button',
    preventOnFilter: false,
    ghostClass: 'ct-row-ghost',
    chosenClass: 'ct-row-chosen',
    dragClass: 'ct-row-drag',
    disabled: ((_ctTab === 'fatti' || _ctTab === 'temp') && !!_ctFattiSearch),
    onStart: function(){ tbody.classList.add('ct-drag-active'); },
    onEnd: function(evt){
      tbody.classList.remove('ct-drag-active');
      if(evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) return;
      ct_reorderInTab(evt.oldIndex, evt.newIndex);
      CT.render();
    }
  });
}

function ct_updateFooter(){
  var footer = document.getElementById('ct-footer');
  var dfActs = document.getElementById('ct-footer-dafare-actions');
  var tmpActs = document.getElementById('ct-footer-temp-actions');
  if(!footer) return;
  if(_ctTab === 'fatti'){
    footer.style.display = 'none';
    return;
  }
  footer.style.display = 'flex';
  if(dfActs) dfActs.style.display = (_ctTab === 'dafare') ? 'flex' : 'none';
  if(tmpActs) tmpActs.style.display = (_ctTab === 'temp') ? 'flex' : 'none';
}

function ct_setTab(tab){
  _ctTab = tab;
  var btnDf = document.getElementById('ct-tab-dafare');
  var btnTp = document.getElementById('ct-tab-temp');
  var btnFt = document.getElementById('ct-tab-fatti');
  var inactive = { background:'transparent', color:'#555', border:'1px solid #2a2a2a' };
  function styleBtn(btn, active, bg, color){
    if(!btn) return;
    if(active){
      btn.style.background = bg;
      btn.style.color = color;
      btn.style.border = 'none';
    } else {
      btn.style.background = inactive.background;
      btn.style.color = inactive.color;
      btn.style.border = inactive.border;
    }
  }
  styleBtn(btnDf, tab === 'dafare', 'var(--accent)', '#111');
  styleBtn(btnTp, tab === 'temp', '#805ad5', '#fff');
  styleBtn(btnFt, tab === 'fatti', '#38a169', '#fff');
  ctUpdateSearchPlaceholder();
  CT.render();
  if(tab === 'fatti') ctReportDuplicatiFatti();
}

var CT = {
  COLORS: [
    {val:'',       label:'—',      bg:'#1e1e1e', dot:'#444',    text:'#666'   },
    {val:'rosso',  label:'Rosso',  bg:'#2a0808', dot:'#e53e3e', text:'#fc8181'},
    {val:'verde',  label:'Verde',  bg:'#081f08', dot:'#38a169', text:'#68d391'},
    {val:'blu',    label:'Blu',    bg:'#08082a', dot:'#3182ce', text:'#63b3ed'},
    {val:'grigio', label:'Grigio', bg:'#141414', dot:'#718096', text:'#a0aec0'},
    {val:'giallo', label:'Giallo', bg:'#1e1800', dot:'#d69e2e', text:'#f6e05e'},
    {val:'viola',  label:'Viola',  bg:'#14082a', dot:'#805ad5', text:'#b794f4'},
    {val:'arancio',label:'Arancio',bg:'#1e0e00', dot:'#dd6b20', text:'#f6ad55'}
  ],

  color: function(val){
    return CT.COLORS.find(function(c){ return c.val===val; }) || CT.COLORS[0];
  },

  save: function(){
    lsSet(CTK, ctRows);
    // Sync su Firebase per condividere tra dispositivi
    if(typeof _fbReady !== 'undefined' && _fbReady && _fbDb){
      _fbSyncingCt = true;
      try{ _fbDb.ref('cartellini').set(ctRows); }catch(e){ console.error('FB cartellini save:', e); }
      setTimeout(function(){ _fbSyncingCt = false; }, 500);
    }
  },

  // ── RENDER lista cartellini — formato tabella compatta ──────────
  render: function(){
    var list   = document.getElementById('ct-list');
    var empty  = document.getElementById('ct-empty');
    var footer = document.getElementById('ct-footer');
    if(!list) return;

    // Filtra per tab attiva
    var isFatti = (_ctTab === 'fatti');
    var isTemp = (_ctTab === 'temp');
    var isDafare = (_ctTab === 'dafare');
    if(isFatti && Date.now() - _ctLastDupFattiReportAt > 10000){
      _ctLastDupFattiReportAt = Date.now();
      setTimeout(ctReportDuplicatiFatti, 80);
    }

    // Aggiorna contatori nei tab
    var nDf = ctRows.filter(ct_isDafare).length;
    var nTemp = ctRows.filter(ct_isTemp).length;
    var nFt = ctRows.filter(ct_isFatto).length;
    var cDf = document.getElementById('ct-count-dafare');
    var cTp = document.getElementById('ct-count-temp');
    var cFt = document.getElementById('ct-count-fatti');
    if(cDf) cDf.textContent = nDf ? '('+nDf+')' : '';
    if(cTp) cTp.textContent = nTemp ? '('+nTemp+')' : '';
    if(cFt) cFt.textContent = nFt ? '('+nFt+')' : '';

    var realIndices = ct_buildRealIndices();
    var dupFattiByCode = {};
    if(isFatti){
      ctRows.forEach(function(r){
        if(!ct_isFatto(r)) return;
        var code = ctCodiceArticolo(r);
        if(!code) return;
        dupFattiByCode[code] = (dupFattiByCode[code] || 0) + 1;
      });
    }
    var dupDafareByCode = {};
    if(isDafare){
      ctRows.forEach(function(r){
        if(!ct_isDafare(r)) return;
        var code = ctCodiceArticolo(r);
        if(!code) return;
        dupDafareByCode[code] = (dupDafareByCode[code] || 0) + 1;
      });
    }
    var dupTempByCode = {};
    if(isTemp){
      ctRows.forEach(function(r){
        if(!ct_isTemp(r)) return;
        var code = ctCodiceArticolo(r);
        if(!code) return;
        dupTempByCode[code] = (dupTempByCode[code] || 0) + 1;
      });
    }
    var fattiCodes = {};
    var tempCodes = {};
    var dafareCodes = {};
    ctRows.forEach(function(r){
      var code = ctCodiceArticolo(r);
      if(!code) return;
      if(ct_isFatto(r)) fattiCodes[code] = true;
      if(ct_isTemp(r)) tempCodes[code] = true;
      if(ct_isDafare(r)) dafareCodes[code] = true;
    });
    var crossDafareTempCodes = {};
    Object.keys(dafareCodes).forEach(function(code){
      if(tempCodes[code]) crossDafareTempCodes[code] = true;
    });

    if(!realIndices.length){
      if(empty){
        empty.style.display = 'block';
        if(isFatti){
          empty.innerHTML = _ctFattiSearch
            ? '<div style="font-size:52px;margin-bottom:14px;opacity:.4;">🔍</div><div style="font-size:16px;font-weight:700;color:#444;margin-bottom:6px;">Nessun cartellino fatto trovato</div><div style="font-size:13px;color:#333;">Prova con codice articolo, descrizione o data.</div>'
            : '<div style="font-size:52px;margin-bottom:14px;opacity:.4;">✅</div><div style="font-size:16px;font-weight:700;color:#444;margin-bottom:6px;">Nessun cartellino fatto</div><div style="font-size:13px;color:#333;">Spunta un articolo per spostarlo qui.</div>';
        } else if(isTemp){
          empty.innerHTML = _ctFattiSearch
            ? '<div style="font-size:52px;margin-bottom:14px;opacity:.4;">🔍</div><div style="font-size:16px;font-weight:700;color:#444;margin-bottom:6px;">Nessun cartellino parcheggiato trovato</div><div style="font-size:13px;color:#333;">Prova con codice articolo, descrizione o data.</div>'
            : '<div style="font-size:52px;margin-bottom:14px;opacity:.4;">📦</div><div style="font-size:16px;font-weight:700;color:#444;margin-bottom:6px;">Nessun cartellino parcheggiato</div><div style="font-size:13px;color:#333;line-height:1.5;">Usa Parcheggia dalla tab Da fare<br>per liberare la lista di stampa.</div>';
        } else {
          empty.innerHTML = '<div style="font-size:52px;margin-bottom:14px;opacity:.4;">🏷️</div><div style="font-size:16px;font-weight:700;color:#444;margin-bottom:6px;">Nessun cartellino</div><div style="font-size:13px;color:#333;line-height:1.5;">Cerca un articolo in alto<br>oppure importa un file CSV.</div>';
        }
      }
      list.style.display  = 'none';
      ct_updateFooter();
      CT.updateDashboard();
      return;
    }

    if(empty)  empty.style.display  = 'none';
    list.style.display  = 'block';
    ct_updateFooter();

    var h = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    h += '<thead><tr style="background:#1a1a1a;position:sticky;top:110px;z-index:10;">';
    h += '<th style="padding:6px 4px;text-align:left;color:var(--accent);font-size:10px;">Prodotto</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:#888;font-size:10px;width:52px;">Cod.F</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:#888;font-size:10px;width:48px;">€ Vec</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:var(--accent);font-size:10px;width:54px;">€ Nuovo</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:#888;font-size:10px;width:32px;">Dim</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:#888;font-size:10px;width:40px;">Col</th>';
    h += '<th style="padding:6px 2px;text-align:center;color:#888;font-size:10px;width:36px;" title="Mostra nome articolo sul cartellino">Nome</th>';
    h += '<th style="padding:6px 0;width:48px;"></th>';
    h += '</tr></thead><tbody id="ct-sortable-tbody">';

    realIndices.forEach(function(realIdx){
      var r = ctRows[realIdx];
      var c = CT.color(r.giornalino||'');
      var promoOn = (r.barrato==='si' || r.promo==='si');
      var dupCode = ctCodiceArticolo(r);
      var dupCount = isFatti
        ? (dupFattiByCode[dupCode] || 0)
        : (isTemp ? (dupTempByCode[dupCode] || 0) : (dupDafareByCode[dupCode] || 0));
      var isDup = !!(dupCode && dupCount > 1);
      var rowStyle = 'border-bottom:1px solid #222;border-left:3px solid '+(isDup ? '#f6ad55' : c.dot)+';';
      if(isDup) rowStyle += 'background:rgba(246,173,85,.14);box-shadow:inset 0 0 0 1px rgba(246,173,85,.38);';
      var crossMeta = { crossActive: false, showInDafareBadge: false };
      if(!isDup && (isDafare || isTemp)){
        var codCross = ctCodiceArticolo(r);
        var peerOther = isDafare
          ? !!(codCross && (crossDafareTempCodes[codCross] || tempCodes[codCross]))
          : !!(codCross && (crossDafareTempCodes[codCross] || dafareCodes[codCross]));
        var peerFatti = !!(codCross && fattiCodes[codCross]);
        crossMeta = ct_crossTabRowStyle(rowStyle, codCross, peerOther, peerFatti);
        rowStyle = crossMeta.rowStyle;
      }

      var trClass = crossMeta.crossActive ? ' ct-row-cross-active' : '';
      h += '<tr data-real-idx="'+realIdx+'" class="'+trClass.trim()+'" style="'+rowStyle+'">';

      // Prodotto
      h += '<td style="padding:6px 4px;">';
      h += '<div class="ct-prod-name" onclick="this.classList.toggle(\'ct-expanded\')" style="font-size:12px;font-weight:700;color:#e8e8e8;line-height:1.2;">'+esc(r.desc||'—')+'</div>';
      if(r.codM) h += '<div style="font-size:9px;color:var(--accent);margin-top:1px;">'+esc(r.codM)+'</div>';
      if(isDup) h += '<div style="display:inline-block;margin-top:3px;padding:2px 6px;border-radius:999px;background:#f6ad55;color:#111;font-size:9px;font-weight:900;letter-spacing:.3px;">DUPLICATO x'+dupCount+'</div>';
      if(isTemp && crossMeta.showInDafareBadge) h += '<div style="display:inline-block;margin-top:3px;padding:2px 6px;border-radius:999px;background:#e53e3e;color:#fff;font-size:9px;font-weight:900;letter-spacing:.3px;">ANCHE IN DA FARE</div>';
      if(r.fatto) h += '<div style="font-size:9px;color:#38a169;margin-top:1px;">✅ '+esc(r.fattoData||'')+'</div>';
      h += '</td>';

      // Cod.F
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        h += '<input type="text" value="'+esc(r.codF||'')+'" placeholder="—"';
        h += ' onchange="ct_setCodF('+realIdx+',this.value)"';
        h += ' style="width:100%;padding:3px 2px;border:none;border-bottom:1px dashed #333;background:transparent;color:#fc8181;font-size:10px;text-align:center;outline:none;box-sizing:border-box;">';
      } else {
        h += '<span style="color:#fc8181;font-size:10px;">'+esc(r.codF||'—')+'</span>';
      }
      h += '</td>';

      // Prezzo vecchio
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        if(promoOn){
          h += '<input type="text" value="'+esc(r.prezzoOld||'')+'" placeholder="—"';
          h += ' onchange="ct_setPrezzoOld('+realIdx+',this.value)"';
          h += ' style="width:100%;padding:3px 2px;border:none;border-bottom:1px dashed #e53e3e44;background:transparent;color:#fc8181;font-size:10px;font-weight:700;text-align:center;text-decoration:line-through;outline:none;box-sizing:border-box;">';
        } else {
          h += '<button onclick="ct_togglePromo('+realIdx+')" style="border:none;background:transparent;color:#333;font-size:10px;cursor:pointer;padding:2px;">✂</button>';
        }
      } else {
        h += '<span style="color:#fc8181;font-size:10px;text-decoration:line-through;">'+esc(r.prezzoOld||'')+'</span>';
      }
      h += '</td>';

      // Prezzo nuovo
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        h += '<input type="text" value="'+esc(r.prezzo||'')+'" placeholder="€"';
        h += ' onchange="ct_setPrezzo('+realIdx+',this.value)"';
        h += ' style="width:100%;padding:3px 2px;border:none;border-bottom:1px solid var(--accent)44;background:transparent;color:var(--accent);font-size:12px;font-weight:900;text-align:center;outline:none;box-sizing:border-box;">';
      } else {
        h += '<span style="color:var(--accent);font-size:12px;font-weight:900;">'+esc(r.prezzo||'—')+'</span>';
      }
      h += '</td>';

      // Dimensione
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        h += '<select onchange="ct_setSize('+realIdx+',this.value)" style="width:100%;padding:1px;border:none;background:transparent;color:#888;font-size:9px;outline:none;-webkit-appearance:none;appearance:none;text-align:center;cursor:pointer;">';
        h += '<option value="small"'+(r.size==='small'?' selected':'')+'>P</option>';
        h += '<option value="large"'+(r.size==='large'?' selected':'')+'>G</option>';
        h += '</select>';
      } else {
        h += '<span style="color:#555;font-size:9px;">'+(r.size==='large'?'G':'P')+'</span>';
      }
      h += '</td>';

      // Colore
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        h += '<select onchange="ct_setColor('+realIdx+',this.value)" style="width:100%;padding:1px;border:none;background:'+c.bg+';color:'+c.dot+';font-size:9px;font-weight:800;outline:none;border-radius:4px;cursor:pointer;">';
        CT.COLORS.forEach(function(col){
          h += '<option value="'+col.val+'" style="background:#111;color:'+col.dot+';"'+((( r.giornalino||'')===col.val)?' selected':'')+'>'+col.label+'</option>';
        });
        h += '</select>';
      } else {
        h += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+c.dot+';"></span>';
      }
      h += '</td>';

      // Visibilità nome articolo sul cartellino (default: ON). Solo UI di stampa, non altera dati.
      var showNameOn = (r.showName !== false);
      h += '<td style="padding:2px;text-align:center;">';
      if(!isFatti){
        h += '<input type="checkbox"'+(showNameOn?' checked':'')+' onchange="ct_setShowName('+realIdx+',this.checked)" '
          +  'title="Mostra/nascondi il nome articolo sul cartellino" '
          +  'style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent);vertical-align:middle;">';
      } else {
        h += '<span style="color:'+(showNameOn?'#38a169':'#555')+';font-size:11px;">'+(showNameOn?'✓':'✕')+'</span>';
      }
      h += '</td>';

      // Azioni: parcheggio / ripristino / fatto + elimina
      h += '<td style="padding:2px;text-align:center;white-space:nowrap;">';
      if(isDafare){
        h += '<button onclick="ct_parkOne('+realIdx+')" title="Parcheggia in Temp" style="border:none;background:transparent;color:#805ad588;font-size:14px;cursor:pointer;padding:0 2px;touch-action:manipulation;">📦</button>';
        h += '<button onclick="ct_toggleFatto('+realIdx+')" title="Segna come fatto" style="border:none;background:transparent;color:#38a16966;font-size:16px;cursor:pointer;padding:0 3px;touch-action:manipulation;">✓</button>';
      } else if(isTemp){
        h += '<button onclick="ct_restoreOne('+realIdx+')" title="Ripristina in Da fare" style="border:none;background:transparent;color:#805ad588;font-size:14px;cursor:pointer;padding:0 3px;touch-action:manipulation;">↩</button>';
      } else {
        h += '<button onclick="ct_toggleFatto('+realIdx+')" title="Rimetti in Da fare" style="border:none;background:transparent;color:#d69e2e88;font-size:13px;cursor:pointer;padding:0 3px;touch-action:manipulation;">↩</button>';
      }
      h += '<button onclick="ct_del('+realIdx+')" style="border:none;background:transparent;color:#e53e3e66;font-size:14px;cursor:pointer;padding:0 2px;touch-action:manipulation;">✕</button>';
      h += '</td>';

      h += '</tr>';
    });

    h += '</tbody></table>';
    list.innerHTML = h;
    CT.updateDashboard();
    ct_initMobileReorder();
  },

  // ── Dashboard ───────────────────────────────────────────────────
  updateDashboard: function(){
    var dash = document.getElementById('ct-dashboard');
    if(!dash) return;

    var h = '<div style="flex-shrink:0;background:#1a1a1a;border-radius:10px;padding:6px 12px;border:1px solid #2a2a2a;text-align:center;min-width:56px;">'
          + '<div style="font-size:18px;font-weight:900;color:var(--accent);line-height:1;">'+ctRows.length+'</div>'
          + '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;">Totale</div>'
          + '</div>';

    var nTempDash = ctRows.filter(ct_isTemp).length;
    if(nTempDash){
      h += '<div style="flex-shrink:0;background:#14082a;border-radius:10px;padding:6px 12px;border:1px solid #805ad544;text-align:center;min-width:56px;">'
         + '<div style="font-size:18px;font-weight:900;color:#b794f4;line-height:1;">'+nTempDash+'</div>'
         + '<div style="font-size:9px;color:#b794f4;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;">Temp</div>'
         + '</div>';
    }

    CT.COLORS.slice(1).forEach(function(col){
      var count = ctRows.filter(function(r){ return (r.giornalino||'')===col.val; }).length;
      if(!count) return;
      h += '<div style="flex-shrink:0;background:'+col.bg+';border-radius:10px;padding:6px 12px;border:1px solid '+col.dot+'44;text-align:center;min-width:56px;">'
         + '<div style="font-size:18px;font-weight:900;color:'+col.dot+';line-height:1;">'+count+'</div>'
         + '<div style="font-size:9px;color:'+col.text+';text-transform:uppercase;letter-spacing:.5px;margin-top:1px;">'+col.label+'</div>'
         + '</div>';
    });

    var noColor = ctRows.filter(function(r){ return !(r.giornalino||''); }).length;
    if(noColor && ctRows.length){
      h += '<div style="flex-shrink:0;background:#1a1a1a;border-radius:10px;padding:6px 12px;border:1px solid #2a2a2a;text-align:center;min-width:56px;">'
         + '<div style="font-size:18px;font-weight:900;color:#555;line-height:1;">'+noColor+'</div>'
         + '<div style="font-size:9px;color:#444;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;">Nessuno</div>'
         + '</div>';
    }

    dash.innerHTML = h;
  }
};

// ── Azioni sulle righe ───────────────────────────────────────────────────────

function ct_setColor(i, val){
  if(!ctRows[i]) return;
  ctRows[i].giornalino = val;
  CT.save(); CT.render();
}

function ct_setCodF(i, val){
  if(!ctRows[i]) return;
  ctRows[i].codF = val.trim();
  CT.save();
  // Salva anche nel database se l'articolo esiste e non aveva codF
  if(ctRows[i].codM){
    for(var j = 0; j < rows.length; j++){
      if(rows[j] && rows[j].codM === ctRows[i].codM && !rows[j].codF && val.trim()){
        rows[j].codF = val.trim();
        lsSet(SK, rows);
        if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(j);
        break;
      }
    }
  }
}

function ct_setPrezzo(i, val){
  if(!ctRows[i]) return;
  var old = ctRows[i].prezzo;
  if(old && old!==val){
    if(!ctRows[i].priceHistory) ctRows[i].priceHistory=[];
    ctRows[i].priceHistory.unshift({prezzo:old, data:new Date().toLocaleDateString('it-IT')});
  }
  ctRows[i].prezzo = val;
  ctRows[i].size = (typeof autoSize==='function') ? autoSize(val) : 'small';
  CT.save(); CT.updateDashboard();
}

function ct_setPrezzoOld(i, val){
  if(!ctRows[i]) return;
  ctRows[i].prezzoOld = val;
  CT.save();
}

function ct_togglePromo(i){
  if(!ctRows[i]) return;
  var on = ctRows[i].barrato==='si' || ctRows[i].promo==='si';
  ctRows[i].barrato = on?'no':'si';
  ctRows[i].promo   = on?'no':'si';
  CT.save(); CT.render();
}

function ct_setSize(i, val){
  if(!ctRows[i]) return;
  ctRows[i].size = val;
  CT.save();
}

// Mostra/nascondi il NOME ARTICOLO sul cartellino stampato.
// È un flag SOLO di rendering: salvato per persistenza/sync, non altera prezzi/codici/qty/desc.
// Default: visibile (showName !== false ⇒ true). Se false ⇒ il <div class="tnm"> esce con display:none.
function ct_setShowName(i, val){
  // Indice difensivo: CT.render() passa già il realIdx (posizione reale in ctRows[],
  // non quella filtrata della tab "Da fare / Fatti"), MA una sync Firebase tra render e click
  // potrebbe rimescolare ctRows. Validiamo: numero, intero, in-range e oggetto valido.
  i = parseInt(i, 10);
  if(isNaN(i) || i < 0 || !ctRows || i >= ctRows.length) return;
  var row = ctRows[i];
  if(!row || typeof row !== 'object') return;
  row.showName = !!val;
  CT.save();
  // Se l'anteprima cartellini è aperta, rigenera l'HTML in tempo reale (senza chiudere/riaprire).
  var pov = document.getElementById('pov');
  if(pov && pov.classList.contains('open') && typeof buildTagsHTML === 'function'){
    var printable = ct_filterPrintable(ctRows);
    var html = buildTagsHTML(printable, false);
    var pc = document.getElementById('pc');
    if(pc) pc.innerHTML = html;
    var pa = document.getElementById('print-area');
    if(pa) pa.innerHTML = html;
    var pat1 = document.getElementById('print-area-t1');
    if(pat1) pat1.innerHTML = html;
  }
}

function ct_findDbIdxByCartellino(ct){
  if(!ct || !rows || !rows.length) return -1;
  var codM = String(ct.codM || '').trim();
  var codF = String(ct.codF || '').trim();
  if(!codM && !codF) return -1;
  for(var i = 0; i < rows.length; i++){
    if(!rows[i]) continue;
    if(codM && typeof codiciMagazzinoUguali === 'function' && codiciMagazzinoUguali(rows[i].codM, codM)) return i;
    if(codM && String(rows[i].codM || '').trim() === codM) return i;
    if(codF && String(rows[i].codF || '').trim() === codF) return i;
  }
  return -1;
}

/** Chiusura promo giornalino: salva storico [G], poi resetta prezzo/promo solo se salvataggio ok. */
function ct_closePromoOnDelete(ct, deferCommit){
  if(!ct || !ct.giornalino) return false; // sicurezza: non toccare righe non promo
  var dbIdx = ct_findDbIdxByCartellino(ct);
  if(dbIdx < 0 || !rows[dbIdx]) return false;
  var r = rows[dbIdx];
  var now = new Date();
  var promoPrezzo = String(ct.prezzo || r.prezzo || '').trim();
  var commitNow = !deferCommit;
  var oldPrezzo = r.prezzo;
  var oldPrezzoOld = r.prezzoOld;
  var oldData = r.data;
  var oldIsPromo = r.isPromo;
  var oldPromoTipo = r.promoTipo;
  if(!r.priceHistory) r.priceHistory = [];
  var histEntry = {
    prezzo: promoPrezzo || oldPrezzo || '',
    data: now.toISOString(),
    tipo: 'G',
    nota: 'Fine Promozione Giornalino'
  };
  r.priceHistory.unshift(histEntry);
  if(r.priceHistory.length > 30) r.priceHistory.length = 30;

  // Primo salvataggio: storico promo. Se fallisce, non toccare il prezzo.
  if(commitNow){
    try{
      lsSet(SK, rows);
    }catch(e){
      r.priceHistory.shift();
      return false;
    }
  }

  if(promoPrezzo) r.prezzoOld = promoPrezzo;
  r.prezzo = '0,00';
  r.data = now.toLocaleDateString('it-IT');
  r.isPromo = false;
  r.promoTipo = '';

  // Secondo salvataggio: reset promo terminata.
  if(commitNow){
    try{
      if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
      if(typeof touchRowPriceUpdate === 'function') touchRowPriceUpdate(r);
      lsSet(SK, rows);
    }catch(e2){
      // rollback prudente
      r.prezzo = oldPrezzo;
      r.prezzoOld = oldPrezzoOld;
      r.data = oldData;
      r.isPromo = oldIsPromo;
      r.promoTipo = oldPromoTipo;
      return false;
    }
  }

  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
  return true;
}

function ct_del(i){
  if(!ctRows[i]) return;
  var removed_row = ctRows.splice(i,1)[0];
  var promoChiusa = ct_closePromoOnDelete(removed_row);
  cestino.unshift(Object.assign({}, removed_row, {deletedAt:new Date().toLocaleString('it-IT')}));
  lsSet(CK, cestino);
  if(promoChiusa) lsSet(SK, rows);
  CT.save(); CT.render();
  updateBadge && updateBadge();
  showToastGen('red', promoChiusa ? '🗑️ Promo [G] chiusa e cartellino rimosso' : '🗑️ Rimosso dai cartellini');
}

function ct_toggleFatto(i){
  if(!ctRows[i]) return;
  var era = !!ctRows[i].fatto;
  ctRows[i].fatto = !era;
  ctRows[i].fattoData = !era ? new Date().toLocaleDateString('it-IT') : '';
  if(!era) ctRows[i].temp = false;
  else ctRows[i].temp = false;
  CT.save(); CT.render();
  showToastGen(!era ? 'green' : 'yellow', !era ? '✅ Cartellino fatto!' : '↩ Rimesso in Da fare');
}

function ct_parkOne(i){
  i = parseInt(i, 10);
  if(isNaN(i) || i < 0 || !ctRows[i] || !ct_isDafare(ctRows[i])) return;
  ctRows[i].temp = true;
  ct_bringToFront(i, ct_isTemp);
  CT.save(); CT.render();
  showToastGen('yellow', '📦 Spostato in Temp');
}

function ct_restoreOne(i){
  i = parseInt(i, 10);
  if(isNaN(i) || i < 0 || !ctRows[i] || !ct_isTemp(ctRows[i])) return;
  ctRows[i].temp = false;
  ct_bringToFront(i, ct_isDafare);
  CT.save(); CT.render();
  showToastGen('green', '↩ Ripristinato in Da fare');
}

function ct_parkAll(){
  var n = ctRows.filter(ct_isDafare).length;
  if(!n){ showToastGen('yellow', 'Nessun cartellino da parcheggiare'); return; }
  showConfirm('Parcheggiare tutti i '+n+' cartellini in Temp?', function(){
    ctRows.forEach(function(r){ if(ct_isDafare(r)) r.temp = true; });
    CT.save(); CT.render();
    showToastGen('yellow', '📦 '+n+' cartellini parcheggiati in Temp');
  });
}

function ct_restoreAll(){
  var n = ctRows.filter(ct_isTemp).length;
  if(!n){ showToastGen('yellow', 'Nessun cartellino in Temp'); return; }
  showConfirm('Ripristinare tutti i '+n+' cartellini in Da fare?', function(){
    ctRows.forEach(function(r){ if(ct_isTemp(r)) r.temp = false; });
    CT.save(); CT.render();
    showToastGen('green', '↩ '+n+' cartellini ripristinati in Da fare');
  });
}

function ct_svuota(){
  showConfirm('Svuotare tutti i cartellini?', function(){
    var promoChiuse = 0;
    ctRows.forEach(function(r){
      if(ct_closePromoOnDelete(r, true)) promoChiuse++;
      cestino.unshift(Object.assign({},r,{deletedAt:new Date().toLocaleString('it-IT')}));
    });
    ctRows = [];
    lsSet(CK, cestino);
    if(promoChiuse) lsSet(SK, rows);
    CT.save(); CT.render();
    updateBadge && updateBadge();
    showToastGen('green', promoChiuse ? '✅ Lista svuotata · promo [G] chiuse: '+promoChiuse : '✅ Lista svuotata');
  });
}

function ct_genAnteprima(){
  if(!ctRows.length){ showToastGen('red','⚠️ Nessun cartellino'); return; }
  var printableRows = ct_filterPrintable(ctRows);
  if(!printableRows.length){
    var nTemp = ctRows.filter(ct_isTemp).length;
    if(nTemp){
      showToastGen('yellow','ℹ️ Tutti i cartellini attivi sono parcheggiati in Temp');
    } else {
      showToastGen('yellow','ℹ️ Tutti i cartellini sono segnati come fatti');
    }
    return;
  }
  // Carica e applica le impostazioni editor
  var savedEd = lsGet(window.AppKeys.EDITOR, null);
  if(savedEd && typeof editorSettings !== 'undefined') Object.assign(editorSettings, savedEd);
  if(typeof applyEditorCSS==='function') applyEditorCSS();
  // Genera HTML direttamente da ctRows SENZA toccare rows/save
  var html = buildTagsHTML(printableRows, false);
  // Popola print-area per la stampa
  var printArea = document.getElementById('print-area');
  if(printArea) printArea.innerHTML = html;
  var t1area = document.getElementById('print-area-t1');
  if(t1area) t1area.innerHTML = html;
  // Popola anteprima overlay
  var pc = document.getElementById('pc');
  if(pc) pc.innerHTML = html;
  var pov = document.getElementById('pov');
  if(pov){ pov.classList.add('open'); pov.scrollTop = 0; }
  if(typeof _scalePrevContainer==='function') _scalePrevContainer();
}

function ct_toggleCsv(){
  var p = document.getElementById('ct-csv-panel');
  var b = document.getElementById('ct-csv-btn');
  if(!p) return;
  var open = p.style.display!=='none';
  p.style.display = open ? 'none' : 'block';
  if(b){ b.style.borderColor = open?'#2a2a2a':'var(--accent)'; b.style.color = open?'#555':'var(--accent)'; }
}

// ── Ricerca articoli dal database rows[] ─────────────────────────────────────
var _ctSearchTimer = null;

function ct_searchInput(val){
  clearTimeout(_ctSearchTimer);
  var res = document.getElementById('ct-search-results');
  if(!res) return;
  val = (val||'').trim();
  if(_ctTab === 'fatti' || _ctTab === 'temp'){
    _ctFattiSearch = val;
    res.style.display = 'none';
    res.innerHTML = '';
    CT.render();
    return;
  }
  if(val.length<2){ res.style.display='none'; res.innerHTML=''; return; }
  _ctSearchTimer = setTimeout(function(){ ct_doSearch(val); }, 280);
}

function ct_doSearch(q){
  var res = document.getElementById('ct-search-results');
  if(!res) return;

  // rows[] è il database Firebase — deve essere caricato
  if(!rows || !rows.length){
    res.innerHTML='<div style="padding:14px;color:#555;text-align:center;font-size:13px;">⏳ Database non caricato — apri prima la tab Inventario</div>';
    res.style.display='block'; return;
  }

  var qn = q.toLowerCase();
  var matches = [];
  for(var i=0; i<rows.length; i++){
    var r = rows[i];
    if(!r) continue;
    var text = [(r.desc||''),(r.codF||''),(r.codM||'')].join(' ').toLowerCase();
    if(text.indexOf(qn)>=0){ matches.push({r:r,i:i}); if(matches.length>=25) break; }
  }

  if(!matches.length){
    res.innerHTML='<div style="padding:14px;color:#555;text-align:center;font-size:13px;">Nessun risultato per "<b>'+esc(q)+'</b>"</div>';
    res.style.display='block'; return;
  }

  var h='';
  matches.forEach(function(m){
    var r=m.r; var mag=magazzino[m.i]||{};
    h+='<div onclick="ct_addFromSearch('+m.i+')"'
      +' style="padding:11px 14px;border-bottom:1px solid #1e1e1e;cursor:pointer;display:flex;gap:10px;align-items:center;touch-action:manipulation;"'
      +' onpointerdown="this.style.background=\'#252525\'" onpointerup="this.style.background=\'\'" onpointerleave="this.style.background=\'\'">';
    h+='<div style="flex:1;min-width:0;">';
    h+='<div style="font-size:14px;font-weight:700;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(r.desc||'—')+'</div>';
    h+='<div style="font-size:11px;color:#555;margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;">';
    if(r.codF) h+='<span style="color:#fc8181;">F: '+esc(r.codF)+'</span>';
    if(r.codM) h+='<span style="color:var(--accent);">M: '+esc(r.codM)+'</span>';
    if(mag.specs) h+='<span style="color:#2dd4bf;">'+esc(mag.specs.substring(0,35))+'</span>';
    h+='</div></div>';
    if(r.prezzo) h+='<div style="font-size:16px;font-weight:900;color:var(--accent);flex-shrink:0;">€'+esc(r.prezzo)+'</div>';
    h+='<div style="font-size:20px;color:#555;flex-shrink:0;">＋</div>';
    h+='</div>';
  });

  res.innerHTML=h; res.style.display='block';
}

function ct_addFromSearch(idx){
  var r = rows[idx]; // cerca nel DATABASE, non nei cartellini
  if(!r){ showToastGen('red','❌ Articolo non trovato'); return; }

  var newRow = {
    data:     new Date().toLocaleDateString('it-IT'),
    desc:     r.desc  || '',
    codF:     r.codF  || '',
    codM:     r.codM  || '',
    prezzoOld:'',
    prezzo:   r.prezzo || '',
    size:     (typeof autoSize==='function') ? autoSize(r.prezzo||'0') : 'small',
    note:     '',
    giornalino: '',
    barrato:  'no',
    promo:    'no',
    priceHistory: []
  };

  if(!ctConfirmAddDuplicate(newRow)) return;
  ctWarnDoneHistory(newRow);
  ctRows.push(newRow);
  CT.save(); CT.render();
  ct_closeSearch();
  showToastGen('green','✅ '+esc(r.desc||'Articolo')+' aggiunto');
}

function ct_closeSearch(){
  var inp=document.getElementById('ct-search');
  var res=document.getElementById('ct-search-results');
  if(inp) inp.value='';
  if(res){ res.style.display='none'; res.innerHTML=''; }
}

// Chiudi dropdown click fuori
document.addEventListener('click', function(e){
  var res=document.getElementById('ct-search-results');
  if(!res||res.style.display==='none') return;
  var inp=document.getElementById('ct-search');
  if(inp&&inp.contains(e.target)) return;
  if(res.contains(e.target)) return;
  res.style.display='none';
});

// ── Integrazione con import CSV ──────────────────────────────────────────────
// Override di confirmImp: il CSV aggiunge ai cartellini (ctRows)
// e aggiorna SOLO il codF nel database se mancava (mai sovrascrive desc/prezzo)
var confirmImp = (function(_ci_orig){
  return function(){
    // Formato nuovo con pendingImportDB
    if(typeof pendingImportDB !== 'undefined' && pendingImportDB && pendingImportDB.length){
      var aggiornatiCodF = 0;
      var prezziGiornalino = 0;

      var rowsToAdd = [];
      pendingImportDB.forEach(function(r){
        var coloreValido = ['rosso','verde','blu','giallo','viola','arancio','grigio'];
        var colore = r.giornalino && coloreValido.indexOf(r.giornalino) >= 0 ? r.giornalino : '';

        // Cerca l'articolo nel database per codM
        var dbIdx = -1;
        var dbRow = null;
        if(r.codM){
          for(var i = 0; i < rows.length; i++){
            if(rows[i] && rows[i].codM === r.codM){
              dbIdx = i; dbRow = rows[i]; break;
            }
          }
        }

        // Usa il nome dal DATABASE (non dal CSV) se l'articolo esiste
        var descFinale = (dbRow && dbRow.desc) ? dbRow.desc : (r.desc || '');
        // Prezzo: usa quello del CSV per il cartellino
        var prezzoCartellino = r.pv || '';
        // Prezzo vecchio: se il database ha un prezzo diverso, quello diventa il vecchio
        var prezzoVecchio = '';
        if(dbRow && dbRow.prezzo && prezzoCartellino && dbRow.prezzo !== prezzoCartellino){
          prezzoVecchio = dbRow.prezzo;
          prezziGiornalino++;
        }

        // Prepara il cartellino con il NOME del database
        rowsToAdd.push({
          data: new Date().toLocaleDateString('it-IT'),
          desc: descFinale,
          codF: r.codF || '',
          codM: r.codM || '',
          prezzoOld: prezzoVecchio,
          prezzo: prezzoCartellino,
          size: (typeof autoSize === 'function') ? autoSize(prezzoCartellino || '0') : 'small',
          note: '',
          giornalino: colore,
          barrato: prezzoVecchio ? 'si' : 'no',
          promo: prezzoVecchio ? 'si' : 'no',
          priceHistory: []
        });

        // Aggiorna il database SOLO: codF se mancava
        if(dbIdx >= 0 && dbRow){
          var changed = false;
          // CodF: salva se il prodotto non ce l'aveva
          if(r.codF && !dbRow.codF){
            dbRow.codF = r.codF;
            changed = true;
            aggiornatiCodF++;
          }
          // Salva il prezzo giornalino come campo separato (non sovrascrive prezzo principale)
          if(prezzoCartellino){
            var mag = magazzino[dbIdx] || {};
            mag.prezzoGiornalino = prezzoCartellino;
            mag.prezzoGiornalinoData = new Date().toLocaleDateString('it-IT');
            magazzino[dbIdx] = mag;
            changed = true;
          }
          if(changed){
            lsSet(SK, rows);
            lsSet(MAGK, magazzino);
            if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
          }
        }
      });
      var acceptedRows = ctPrepareImportRows(rowsToAdd);
      acceptedRows.forEach(function(r){ ctRows.push(r); });

      CT.save(); CT.render();
      var msg = '✅ ' + acceptedRows.length + ' cartellini importati';
      if(acceptedRows.length !== rowsToAdd.length) msg += ' | ' + (rowsToAdd.length - acceptedRows.length) + ' duplicati saltati';
      if(aggiornatiCodF > 0) msg += ' | ' + aggiornatiCodF + ' cod.forn. aggiunti';
      if(prezziGiornalino > 0) msg += ' | ' + prezziGiornalino + ' con prezzo diverso';
      showToastGen('green', msg);
      cancelImp();
      return;
    }

    // Vecchio formato: rows = cartellini puri
    if(typeof pendingImport !== 'undefined' && pendingImport && pendingImport.length){
      var acceptedOld = ctPrepareImportRows(pendingImport.map(function(r){ return Object.assign({}, r); }));
      acceptedOld.forEach(function(r){
        ctRows.push(Object.assign({}, r));
      });
      CT.save(); CT.render();
      showToastGen('green', '✅ ' + acceptedOld.length + ' cartellini importati' + (acceptedOld.length !== pendingImport.length ? ' | ' + (pendingImport.length - acceptedOld.length) + ' duplicati saltati' : ''));
      cancelImp();
      return;
    }

    showToastGen('red', '⚠️ Nessun dato da importare');
  };
})(confirmImp);


// ── Aggiorna CT quando si apre la tab t1 ─────────────────────────────────────
document.addEventListener('click', function(e){
  var btn = e.target.closest('[onclick]');
  if(!btn) return;
  var oc = btn.getAttribute('onclick')||'';
  if(oc.indexOf("'t1'")>=0||oc.indexOf('"t1"')>=0){
    setTimeout(function(){ CT.render(); }, 60);
  }
}, true);

// Render iniziale
setTimeout(function(){ ctUpdateSearchPlaceholder(); CT.render(); }, 350);


// ══ SYNC CARTELLINI → DATABASE ═══════════════════════════════════════════════
// Aggiorna il database con i prezzi dei cartellini (ctRows)
// codF, prezzo (con storico), prezzoAcquisto, qty, unit
function ct_syncDB(){
  if(!ctRows || !ctRows.length){
    showToastGen('red','⚠️ Nessun cartellino da sincronizzare');
    return;
  }
  var oggi = new Date().toLocaleDateString('it-IT');
  var stats = { prezzi:0, codF:0, nuovi:0, promo:0, qty:0 };
  var daFareRows = (ctRows || []).filter(function(ct){ return ct && !ct.fatto; });
  var promoRowsAll = (ctRows || []).filter(function(ct){ return ct && !!ct.giornalino; });
  var promoAlignedByIdx = {};

  daFareRows.forEach(function(ct){
    if(!ct.codM && !ct.codF) return;
    var prezzo = ct.prezzo || '';

    // Cerca nel database
    var dbIdx = ct_findDbIdxByCartellino(ct);

    if(dbIdx >= 0){
      var r = rows[dbIdx];
      var changed = false;
      var productTouched = false;
      var hasPromoColor = !!ct.giornalino;

      // Flag promo giornalino [G]: SOLO se cartellino con colore attivo.
      if(hasPromoColor && (r.isPromo !== true || String(r.promoTipo || '') !== 'G')){
        r.isPromo = true;
        r.promoTipo = 'G';
        changed = true;
        productTouched = true;
        stats.promo++;
        promoAlignedByIdx[String(dbIdx)] = true;
      }

      // Codice fornitore
      if(ct.codF && ct.codF !== r.codF){
        r.codF = ct.codF;
        changed = true;
        stats.codF++;
      }

      // Quantità da cartellino -> magazzino (se valorizzata)
      if(ct.qty !== undefined && ct.qty !== null && String(ct.qty).trim() !== ''){
        if(!magazzino[dbIdx]) magazzino[dbIdx] = {};
        var q = parseFloat(ct.qty);
        if(!isNaN(q) && String(magazzino[dbIdx].qty) !== String(q)){
          magazzino[dbIdx].qty = q;
          magazzino[dbIdx]._updatedAt = Date.now();
          changed = true;
          productTouched = true;
          stats.qty++;
        }
      }

      // Prezzo con storico
      if(prezzo && prezzo !== r.prezzo){
        if(r.prezzo){
          r.prezzoOld = r.prezzo;
          if(!r.priceHistory) r.priceHistory = [];
          r.priceHistory.unshift({ prezzo: r.prezzo, data: r.data || '' });
          if(r.priceHistory.length > 5) r.priceHistory.length = 5;
        }
        r.prezzo = prezzo;
        r.data = oggi;
        r.size = (typeof autoSize === 'function') ? autoSize(prezzo) : r.size;
        changed = true;
        productTouched = true;
        if(typeof touchRowPriceUpdate === 'function') touchRowPriceUpdate(r);
        stats.prezzi++;
      }

      if(changed){
        r._updatedAt = Date.now();
        if(productTouched && typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
        if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
      }
    } else if(ct.codM){
      if(typeof findDuplicateCodMagazzino === 'function'){
        var dupSync = findDuplicateCodMagazzino(ct.codM, -1);
        if(dupSync){
          if(typeof showCodiceMagazzinoDuplicateError === 'function') showCodiceMagazzinoDuplicateError(ct.codM, dupSync.desc);
          else showToastGen('red', "Errore: Il codice " + String(ct.codM).trim() + " è già in uso per l'articolo " + (dupSync.desc || '—'));
          return;
        }
      }
      // Nuovo articolo solo se il codice magazzino non esiste già (match intelligente).
      var newRow = {
        data: oggi,
        desc: ct.desc || '',
        codF: ct.codF || '',
        codM: ct.codM || '',
        prezzoOld: '',
        prezzo: prezzo || '',
        size: (typeof autoSize === 'function') ? autoSize(prezzo || '0') : 'small',
        note: ct.note || '',
        priceHistory: [],
        isPromo: !!ct.giornalino,
        promoTipo: ct.giornalino ? 'G' : '',
        createdAt: Date.now(),
        _updatedAt: Date.now()
      };
      rows.push(newRow);
      var newIdx = rows.length - 1;
      if(!magazzino[newIdx]) magazzino[newIdx] = {};
      magazzino[newIdx]._updatedAt = Date.now();
      if(ct.qty !== undefined && ct.qty !== null && String(ct.qty).trim() !== ''){
        var nq = parseFloat(ct.qty);
        if(!isNaN(nq)){ magazzino[newIdx].qty = nq; stats.qty++; }
      }
      stats.nuovi++;
      if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(newIdx);
    }
  });

  // Riallinea i flag promo [G] anche per cartellini colorati già "fatti":
  // non tocca prezzi/quantità e non crea/rimuove articoli.
  promoRowsAll.forEach(function(ct){
    if(!ct.codM && !ct.codF) return;
    var dbIdx = ct_findDbIdxByCartellino(ct);
    if(dbIdx < 0 || !rows[dbIdx]) return;
    if(promoAlignedByIdx[String(dbIdx)]) return;
    var r = rows[dbIdx];
    if(r.isPromo === true && String(r.promoTipo || '') === 'G') return;
    r.isPromo = true;
    r.promoTipo = 'G';
    r._updatedAt = Date.now();
    if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
    stats.promo++;
    if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
  });

  if(stats.prezzi || stats.codF || stats.promo || stats.nuovi || stats.qty){
    lsSet(SK, rows);
    lsSet(MAGK, magazzino);
    var parts = [];
    if(stats.prezzi) parts.push(stats.prezzi + ' prezzi');
    if(stats.codF) parts.push(stats.codF + ' cod.forn.');
    if(stats.promo) parts.push(stats.promo + ' promo [G]');
    if(stats.qty) parts.push(stats.qty + ' quantità');
    if(stats.nuovi) parts.push(stats.nuovi + ' nuovi');
    showToastGen('green', '✅ Database aggiornato: ' + parts.join(' · '));
  } else {
    showToastGen('yellow', 'Nessuna modifica — i dati erano già aggiornati');
  }
}


// ══ SYNC CARTELLINI DA FIREBASE (real-time) ══════════════════════════════════
// Ascolta cambiamenti su Firebase e aggiorna ctRows su tutti i dispositivi

function _initCartelliniSync(){
  if(typeof _fbReady === 'undefined' || !_fbReady || !_fbDb) return;

  // Carica iniziale da Firebase (sovrascrive localStorage se Firebase ha dati)
  _fbDb.ref('cartellini').once('value', function(snap){
    var d = snap.val();
    if(d && Array.isArray(d) && d.length){
      ctRows = d;
      lsSet(CTK, ctRows);
      CT.render();
    } else if(ctRows.length){
      // Firebase vuoto ma localStorage ha dati → carica su Firebase
      _fbDb.ref('cartellini').set(ctRows);
    }
  });

  // Listener real-time
  _fbDb.ref('cartellini').on('value', function(snap){
    if(_fbSyncingCt) return;
    var d = snap.val();
    if(!d) d = [];
    if(!Array.isArray(d)) d = Object.values(d).filter(function(x){ return x != null; });
    if(JSON.stringify(d) === JSON.stringify(ctRows)) return;
    _fbSyncingCt = true;
    ctRows = d;
    lsSet(CTK, ctRows);
    // Aggiorna UI se tab cartellini è visibile
    var t1 = document.getElementById('t1');
    if(t1 && t1.classList.contains('active')){
      CT.render();
      if(typeof genTags === 'function') genTags();
    }
    setTimeout(function(){ _fbSyncingCt = false; }, 300);
  });
}

// Avvia sync dopo che Firebase è pronto
(function(){
  function _waitAndInit(){
    if(typeof _fbReady !== 'undefined' && _fbReady && _fbDb){
      _initCartelliniSync();
    } else {
      setTimeout(_waitAndInit, 500);
    }
  }
  setTimeout(_waitAndInit, 1000);
})();
