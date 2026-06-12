// ordini.dao-render.js — renderer condiviso vista "Da ordinare" / Ordini fornitore

/** True se la ricerca (#dao-search-input) ha testo nel wrap visibile (congela re-render automatico). */
function daoSearchFieldActive(){
  var inp = typeof daoQueryInActiveWrap === 'function'
    ? daoQueryInActiveWrap('#dao-search-input')
    : document.getElementById('dao-search-input');
  if(!inp) return false;
  return String(inp.value || '').trim().length > 0;
}
if(typeof window !== 'undefined') window.daoSearchFieldActive = daoSearchFieldActive;

var _daoFornEditingCol = null;
var _daoNotaSheetOpen = false;

function daoNotaSheetOpen(){
  return !!_daoNotaSheetOpen;
}
if(typeof window !== 'undefined') window.daoNotaSheetOpen = daoNotaSheetOpen;

function daoCloseQuickNotaSheet(){
  _daoNotaSheetOpen = false;
  var bd = document.getElementById('dao-nota-sheet-backdrop');
  var box = document.getElementById('dao-nota-sheet');
  if(bd) bd.remove();
  if(box) box.remove();
}

function daoShowQuickNotaSheet(cfg){
  cfg = cfg || {};
  daoCloseQuickNotaSheet();
  _daoNotaSheetOpen = true;

  var bd = document.createElement('div');
  bd.id = 'dao-nota-sheet-backdrop';
  bd.className = 'dao-nota-sheet-backdrop';
  var box = document.createElement('div');
  box.id = 'dao-nota-sheet';
  box.className = 'dao-nota-sheet';
  box.innerHTML =
    '<div class="dao-nota-sheet-title">' + esc(cfg.title || 'Nota') + '</div>' +
    '<textarea id="dao-nota-sheet-input" class="dao-nota-sheet-input" rows="3" placeholder="' + esc(cfg.placeholder || '') + '"></textarea>' +
    '<div class="dao-nota-sheet-actions">' +
    '<button type="button" class="dao-nota-sheet-btn dao-nota-sheet-btn--ghost" id="dao-nota-sheet-cancel">Annulla</button>' +
    '<button type="button" class="dao-nota-sheet-btn dao-nota-sheet-btn--ok" id="dao-nota-sheet-save">Salva</button>' +
    '</div>';

  function commit(){
    var inp = document.getElementById('dao-nota-sheet-input');
    var val = inp ? inp.value : '';
    daoCloseQuickNotaSheet();
    if(typeof cfg.onSave === 'function') cfg.onSave(val);
  }
  function cancel(){
    daoCloseQuickNotaSheet();
    if(typeof cfg.onCancel === 'function') cfg.onCancel();
  }

  bd.onclick = function(e){ if(e.target === bd) cancel(); };
  document.body.appendChild(bd);
  document.body.appendChild(box);

  var inp = document.getElementById('dao-nota-sheet-input');
  if(inp){
    inp.value = cfg.value != null ? String(cfg.value) : '';
    inp.onkeydown = function(e){
      if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); commit(); }
    };
    setTimeout(function(){ inp.focus(); inp.select(); }, 50);
  }
  var saveBtn = document.getElementById('dao-nota-sheet-save');
  var cancelBtn = document.getElementById('dao-nota-sheet-cancel');
  if(saveBtn) saveBtn.onclick = commit;
  if(cancelBtn) cancelBtn.onclick = cancel;
}
if(typeof window !== 'undefined') window.daoShowQuickNotaSheet = daoShowQuickNotaSheet;

function daoFornDomSuffix(col){
  return String(col || '').replace(/^#/, '').replace(/[^a-fA-F0-9]/g, '');
}

function daoFornNameEditing(){
  return !!_daoFornEditingCol;
}
if(typeof window !== 'undefined') window.daoFornNameEditing = daoFornNameEditing;

function daoHtmlFornHeaderNote(col, fornNoteMap){
  var nota = '';
  if(typeof ctLookupFornNotaInMap === 'function'){
    nota = ctLookupFornNotaInMap(fornNoteMap, col);
  }
  if(!nota && typeof ctGetFornNota === 'function') nota = ctGetFornNota(col);
  if(!nota) return '';
  return '<div class="dao-forn-note" id="dao-forn-note-' + daoFornDomSuffix(col) + '" title="' + esc(nota) + '">' + esc(nota) + '</div>';
}

function daoHtmlFornTitleBlock(col, fornNome, titoloSlot, fornNoteMap){
  var suf = daoFornDomSuffix(col);
  var colEsc = String(col || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var displayName = fornNome || titoloSlot;
  var h = '';
  h += '<div class="dao-forn-title-area">';
  h += '<div class="dao-forn-title-row">';
  h += '<div class="dao-forn-title-wrap" id="dao-forn-view-' + suf + '">';
  h += '<span class="dao-forn-title" id="dao-forn-title-' + suf + '">' + esc(displayName) + '</span>';
  h += '<button type="button" class="dao-forn-nota-btn" onclick="event.stopPropagation();daoEditFornNota(\'' + colEsc + '\')" title="Nota bancone">\uD83D\uDCDD</button>';
  h += '<button type="button" class="dao-forn-edit-btn" onclick="event.stopPropagation();daoStartFornEdit(\'' + colEsc + '\')" title="Rinomina fornitore">\u270F\uFE0F</button>';
  h += '</div>';
  h += '<div class="dao-forn-edit-wrap" id="dao-forn-edit-' + suf + '" style="display:none">';
  h += '<input class="ord-dao-forn-inp ord-dao-forn-inp--title" id="dao-forn-inp-' + suf + '" value="' + esc(fornNome) + '" placeholder="' + esc(titoloSlot) + '" title="Nome fornitore" ';
  h += 'onkeydown="if(event.key===\'Enter\'){event.preventDefault();daoCommitFornNome(\'' + colEsc + '\');}if(event.key===\'Escape\'){event.preventDefault();daoCancelFornEdit(\'' + colEsc + '\');}">';
  h += '<button type="button" class="dao-forn-save-btn" onclick="daoCommitFornNome(\'' + colEsc + '\')">Salva</button>';
  h += '<button type="button" class="dao-forn-cancel-btn" onclick="daoCancelFornEdit(\'' + colEsc + '\')">Annulla</button>';
  h += '</div></div>';
  h += daoHtmlFornHeaderNote(col, fornNoteMap);
  h += '</div>';
  return h;
}

function daoStartFornEdit(col){
  var suf = daoFornDomSuffix(col);
  var ck = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(col) || col) : col;
  _daoFornEditingCol = ck;
  var view = document.getElementById('dao-forn-view-' + suf);
  var edit = document.getElementById('dao-forn-edit-' + suf);
  if(view) view.style.display = 'none';
  if(edit) edit.style.display = 'flex';
  var inp = document.getElementById('dao-forn-inp-' + suf);
  if(inp){ inp.focus(); inp.select(); }
}
if(typeof window !== 'undefined') window.daoStartFornEdit = daoStartFornEdit;

function daoCommitFornNome(col){
  var suf = daoFornDomSuffix(col);
  var inp = document.getElementById('dao-forn-inp-' + suf);
  var val = inp ? inp.value : '';
  if(typeof ctSaveFornNome === 'function') ctSaveFornNome(col, val);
  _daoFornEditingCol = null;
  if(typeof renderOrdFor === 'function') renderOrdFor(true);
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView(true);
}
if(typeof window !== 'undefined') window.daoCommitFornNome = daoCommitFornNome;

function daoCancelFornEdit(col){
  var suf = daoFornDomSuffix(col);
  var forniMap = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
  var ck = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(col) || col) : col;
  var fornNome = (forniMap[ck] && String(forniMap[ck]).trim()) ? String(forniMap[ck]).trim() : '';
  var titoloSlot = typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(col) : col;
  var titleSpan = document.getElementById('dao-forn-title-' + suf);
  var inp = document.getElementById('dao-forn-inp-' + suf);
  var view = document.getElementById('dao-forn-view-' + suf);
  var edit = document.getElementById('dao-forn-edit-' + suf);
  if(inp) inp.value = fornNome;
  if(titleSpan) titleSpan.textContent = fornNome || titoloSlot;
  if(view) view.style.display = 'flex';
  if(edit) edit.style.display = 'none';
  _daoFornEditingCol = null;
}
if(typeof window !== 'undefined') window.daoCancelFornEdit = daoCancelFornEdit;

/** ID DOM stabile per toggle expand riga. */
function daoRowDomId(entry){
  var raw = String(entry && entry.cartId != null ? entry.cartId : '') + '-' + String(entry && entry.idx != null ? entry.idx : '');
  return 'dao-row-' + raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Meta compatta inline: " · codM · codF · cart" */
function daoFormatMetaInline(entry, it, codM){
  var parts = [];
  if(codM) parts.push(String(codM));
  if(it.codF) parts.push(String(it.codF));
  var cart = String(entry.cartNome || '').trim();
  if(cart){
    if(cart.length > 12) cart = cart.slice(0, 12) + '\u2026';
    parts.push(cart);
  }
  return parts.length ? (' \u00b7 ' + parts.join(' \u00b7 ')) : '';
}

/** Meta completa per riga espansa. */
function daoFormatMetaFull(entry, it, codM){
  var parts = [];
  if(codM) parts.push('<b>' + esc(codM) + '</b>');
  if(it.codF) parts.push('<b>' + esc(it.codF) + '</b>');
  if(entry.cartNome) parts.push('Cart: <b>' + esc(entry.cartNome) + '</b>');
  return parts.join(' \u00b7 ');
}

function daoToggleRowExpand(rowId){
  var row = document.getElementById(rowId);
  if(!row) return;
  row.classList.toggle('dao-row--expanded');
}
if(typeof window !== 'undefined') window.daoToggleRowExpand = daoToggleRowExpand;

function _daoEscCartId(cartId){
  return String(cartId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function _daoItemNotaText(it){
  if(!it) return '';
  var n = it.nota != null ? it.nota : it.note;
  return (n && String(n).trim()) ? String(n).trim() : '';
}

/** Singola riga articolo compatta (CSS Grid, ~34px). */
function daoHtmlRigaCompatta(entry, col, titoloSlot){
  var it = entry.it;
  var itemNota = _daoItemNotaText(it);
  var hasNota = !!itemNota;
  var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7, '0') : it.codM) : '';
  var sub = (parsePriceIT(it.prezzoUnit) * (parseFloat(it.qty) || 0)).toFixed(2);
  var showFornRow = it._ordFornitoreNome && String(it._ordFornitoreNome).trim() &&
    String(it._ordFornitoreNome).trim() !== String(titoloSlot).trim();
  var allowDec = (typeof itemUnitAllowsDecimalQty === 'function') ? itemUnitAllowsDecimalQty(it.unit) : false;
  var qVal = parseFloat(it.qty) || 0;
  var step = allowDec ? 'any' : '1';
  var minV = allowDec ? '0.1' : '1';
  var rowId = daoRowDomId(entry);
  var metaInline = daoFormatMetaInline(entry, it, codM);
  var metaFull = daoFormatMetaFull(entry, it, codM);
  var cartIdEsc = _daoEscCartId(entry.cartId);
  var rowCls = 'dao-row dao-row--compact ord-dao-row ord-dao-row--forn' + (hasNota ? ' dao-row--has-nota' : '');
  var searchHay = typeof _daoEntrySearchHay === 'function' ? _daoEntrySearchHay(entry, col) : '';

  var h = '';
  h += '<div class="' + rowCls + '" id="' + esc(rowId) + '" style="border-left:3px solid ' + col + '99"';
  if(searchHay) h += ' data-dao-search="' + esc(searchHay) + '"';
  h += '>';
  h += '<div class="dao-cell dao-cell-desc" onclick="daoToggleRowExpand(\'' + esc(rowId) + '\')">';
  h += '<div class="dao-desc-primary">';
  h += '<span class="dao-desc-name">' + esc(it.desc || '\u2014') + '</span>';
  if(metaInline) h += '<span class="dao-desc-meta">' + esc(metaInline) + '</span>';
  h += '</div>';
  if(hasNota) h += '<div class="dao-item-nota" title="' + esc(itemNota) + '">' + esc(itemNota) + '</div>';
  h += '<div class="dao-desc-secondary">';
  if(metaFull) h += '<div class="dao-desc-meta-full">' + metaFull + '</div>';
  if(showFornRow) h += '<div class="dao-forn-alt dao-forn-alt--expand">Fornitore: ' + esc(it._ordFornitoreNome) + '</div>';
  h += '</div>';
  h += '</div>';
  h += '<div class="dao-cell dao-cell-qty" onclick="event.stopPropagation()">';
  h += '<button type="button" class="dao-item-nota-btn" onclick="event.stopPropagation();daoEditItemNota(\'' + cartIdEsc + '\',' + entry.idx + ')" title="Nota articolo">\uD83D\uDCDD</button>';
  h += '<div class="ord-dao-qty-wrap">';
  h += '<input type="number" class="ord-dao-qty-inp" min="' + minV + '" step="' + step + '" value="' + qVal + '" inputmode="decimal" ';
  h += 'title="Quantit\u00e0 da ordinare" ';
  h += 'oninput="daoSetDaOrdQtyInput(\'' + cartIdEsc + '\',' + entry.idx + ',this)" ';
  h += 'onchange="daoSetDaOrdQtyCommit(\'' + cartIdEsc + '\',' + entry.idx + ',this)" />';
  h += '<span class="ord-dao-qty-um">' + esc(it.unit || 'pz') + '</span>';
  h += '</div></div>';
  h += '<div class="dao-cell dao-cell-sub"><span class="ord-dao-sub">\u20ac' + sub + '</span></div>';
  h += '<div class="dao-cell dao-cell-act" onclick="event.stopPropagation()">';
  h += '<button type="button" class="dao-btn-cestino" onclick="daoRipulisciVoceDaOrdinare(\'' + cartIdEsc + '\',' + entry.idx + ')" title="Togli da da ordinare">\uD83D\uDDD1\uFE0F</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

/** Etichetta giorno per separatore (Oggi / Ieri / "10 giugno"). */
function daoDayLabel(dayKey){
  if(!dayKey || dayKey === 'senza-data') return 'Precedenti';
  var d = new Date(dayKey + 'T00:00:00');
  if(isNaN(d.getTime())) return dayKey;
  var oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  var ieri = new Date(oggi);
  ieri.setDate(ieri.getDate() - 1);
  if(d.getTime() === oggi.getTime()) return 'Oggi';
  if(d.getTime() === ieri.getTime()) return 'Ieri';
  var opts = { day: 'numeric', month: 'long' };
  if(d.getFullYear() !== oggi.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('it-IT', opts);
}

/** Raggruppa entry per dayKey, ordina gruppi desc e righe per sortAt desc. */
function daoGroupEntriesByDay(items){
  var groups = {};
  (items || []).forEach(function(entry){
    var dk = entry.dayKey || 'senza-data';
    if(!groups[dk]) groups[dk] = [];
    groups[dk].push(entry);
  });
  var keys = Object.keys(groups).sort(function(a, b){
    if(a === 'senza-data') return 1;
    if(b === 'senza-data') return -1;
    return a < b ? 1 : (a > b ? -1 : 0);
  });
  return keys.map(function(dk, gi){
    var entries = groups[dk].slice().sort(function(a, b){
      var sa = String(a.sortAt || '');
      var sb = String(b.sortAt || '');
      return sb.localeCompare(sa);
    });
    return { dayKey: dk, label: daoDayLabel(dk), entries: entries, isFirst: gi === 0 };
  });
}

function daoHtmlDaySep(label, isFirst){
  var cls = 'dao-day-sep' + (isFirst ? ' dao-day-sep--first' : '');
  return '<div class="' + cls + '">' + esc(label) + '</div>';
}

function daoHtmlGruppoItemsByDay(col, items, titoloSlot){
  var h = '';
  var dayGroups = daoGroupEntriesByDay(items);
  dayGroups.forEach(function(g){
    h += daoHtmlDaySep(g.label, g.isFirst);
    g.entries.forEach(function(entry){
      h += daoHtmlRigaCompatta(entry, col, titoloSlot);
    });
  });
  return h;
}

/** Blocco fornitore: header + righe. opts.mode: 'ordini-tab' | 'ordfor-tab' */
function daoHtmlGruppoFornitore(col, items, forniMap, opts){
  opts = opts || {};
  var fornNome = (forniMap[col] && String(forniMap[col]).trim()) ? String(forniMap[col]).trim() : '';
  var titoloSlot = typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(col) : col;
  var mode = opts.mode || 'ordfor-tab';
  var fornNoteMap = opts.forniNoteMap || {};

  var h = '';
  h += '<div class="ord-dao-group" style="border-color:' + col + '55">';
  h += '<div class="ord-dao-header" data-forn-col="' + esc(col) + '" style="border-color:' + col + '">';
  h += '<span class="ord-dao-dot" style="background:' + col + '" title="' + esc(titoloSlot) + '"></span>';
  h += daoHtmlFornTitleBlock(col, fornNome, titoloSlot, fornNoteMap);
  h += '<span class="ord-dao-count">' + items.length + ' art.</span>';

  if(mode === 'ordini-tab'){
    h += '<button type="button" onclick="daoArchiviaColoreGruppo(\'' + col + '\')" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #38a16944;background:#38a16922;color:#68d391;font-size:10px;font-weight:800;cursor:pointer;">Archivia ordinato</button>';
  } else {
    h += '<button type="button" onclick="daoInviaEArchiviaGruppo(\'' + col + '\')" title="Genera PDF, archivia e svuota la lista" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #3182ce66;background:#3182ce22;color:#90cdf4;font-size:10px;font-weight:800;cursor:pointer;">\uD83D\uDCC4 Invia & Archivia</button>';
    h += '<button type="button" onclick="daoArchiviaColoreGruppo(\'' + col + '\')" title="Archivia senza generare PDF" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #38a16944;background:#38a16922;color:#68d391;font-size:10px;font-weight:800;cursor:pointer;">Archivia</button>';
  }
  h += '</div>';

  if(!items.length){
    h += '<div class="ord-dao-empty-msg">Nessun articolo per questo fornitore.</div>';
    h += '</div>';
    return h;
  }

  h += '<div class="dao-table">';
  h += '<div class="dao-table-head">';
  h += '<span>Prodotto</span><span>Qt\u00e0</span><span>\u20ac</span><span></span>';
  h += '</div>';
  h += daoHtmlGruppoItemsByDay(col, items, titoloSlot);
  h += '</div>';
  h += '</div>';
  return h;
}

/**
 * Renderer unificato.
 * cfg: {
 *   wrapId, activeFilter, filterCfg: { fnFilter, fnReset, showStoricoBtn },
 *   mode: 'ordini-tab' | 'ordfor-tab',
 *   showArchiveSearch: boolean,
 *   forceRender: boolean
 * }
 */
function daoRenderFornitoreView(cfg){
  cfg = cfg || {};
  if(!cfg.forceRender && typeof daoSearchFieldActive === 'function' && daoSearchFieldActive()) return;
  if(!cfg.forceRender && typeof daoFornNameEditing === 'function' && daoFornNameEditing()) return;
  if(!cfg.forceRender && typeof daoNotaSheetOpen === 'function' && daoNotaSheetOpen()) return;

  var wrap = document.getElementById(cfg.wrapId);
  if(!wrap) return;

  try {
    var byColor = typeof daoCollectDaOrdinareByColor === 'function' ? daoCollectDaOrdinareByColor() : {};
    var forniMap = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
    var forniNoteMap = typeof ctGetForniNote === 'function' ? ctGetForniNote() : {};
    var h = '';

    if(typeof daoHtmlSearchBar === 'function'){
      h += daoHtmlSearchBar();
    }

    if(typeof ctHtmlBarraFiltriFornitore === 'function'){
      h += ctHtmlBarraFiltriFornitore(byColor, cfg.activeFilter || null, cfg.filterCfg || {});
    }

    if(!Object.keys(byColor).length){
      h += '<div style="text-align:center;padding:28px;color:#555">' +
        'Nessun articolo da ordinare.<br><small>Usa il tasto ORDINA nelle card del carrello.</small></div>';
      h += typeof daoHtmlBloccoStoricoRecente === 'function' ? daoHtmlBloccoStoricoRecente() : '';
      wrap.innerHTML = h;
      if(typeof daoSearchReapplyAfterRender === 'function') daoSearchReapplyAfterRender();
      return;
    }

    var coloriDaMostrare = cfg.activeFilter ? [cfg.activeFilter] : (
      typeof _daoSortedKeysForDisplay === 'function' ? _daoSortedKeysForDisplay(byColor) : Object.keys(byColor)
    );

    coloriDaMostrare.forEach(function(col){
      h += daoHtmlGruppoFornitore(col, byColor[col] || [], forniMap, { mode: cfg.mode || 'ordfor-tab', forniNoteMap: forniNoteMap });
    });

    h += typeof daoHtmlBloccoStoricoRecente === 'function' ? daoHtmlBloccoStoricoRecente() : '';
    wrap.innerHTML = h;
    if(typeof daoSearchReapplyAfterRender === 'function') daoSearchReapplyAfterRender();
  } catch(e){
    console.error('[DaoRender] errore:', e);
    var safeByColor = {};
    try{ safeByColor = daoCollectDaOrdinareByColor(); }catch(e2){ safeByColor = {}; }
    var safe = '';
    safe += '<div style="padding:10px 12px;border:1px solid #e53e3e44;border-radius:10px;background:#2a0808;color:#fc8181;font-size:12px;margin-bottom:10px;">';
    safe += 'Errore nel caricamento fornitori. Puoi comunque ricreare i fornitori con il tasto +.</div>';
    try{
      if(typeof ctHtmlBarraFiltriFornitore === 'function'){
        safe += ctHtmlBarraFiltriFornitore(safeByColor, cfg.activeFilter || null, cfg.filterCfg || {});
      } else {
        safe += '<button type="button" class="ord-forn-filt-add" onclick="ctApriAggiungiFornitore()" title="Nuovo fornitore">＋</button>';
      }
    }catch(e3){
      safe += '<button type="button" class="ord-forn-filt-add" onclick="ctApriAggiungiFornitore()" title="Nuovo fornitore">＋</button>';
    }
    try{ safe += daoHtmlBloccoStoricoRecente(); }catch(e4){}
    wrap.innerHTML = safe;
  }
}
if(typeof window !== 'undefined') window.daoRenderFornitoreView = daoRenderFornitoreView;

