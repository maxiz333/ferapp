// =============================================================================
//  TAB ORDINI PER COLORE/FORNITORE — #t-ordfor
// =============================================================================

var ORD_FORN_STOR_K = window.AppKeys.ORD_FORN_STORICO;
var ORD_FORN_COLD_K = window.AppKeys.ORD_FORN_STORICO_COLD;
// Limite numerico per fornitore visibile in locale (regola dei 5).
// Tutto ciò che eccede vive solo su Firebase (archivio completo).
var DAO_STORICO_PER_FORN_MAX = 5;
// Mantenuto per compatibilità: le voci più vecchie del taglio venivano
// spostate nel cold archive locale; ora questa logica è disattivata
// (resta solo per non rompere eventuali riferimenti esterni).
var DAO_STORICO_MAX_GG = 30;
// Nodo Firebase dell'archivio completo (sostituisce il vecchio cold locale)
var DAO_FB_ARCHIVIO_PATH = 'shared/archivio_ordini_completo';
// Flag di migrazione una-tantum del vecchio cold locale verso Firebase
var DAO_MIGR_FLAG_K = 'cp4_dao_archivio_migrato_v1';
var FORNITORI_SETTINGS_K = window.AppKeys.SETTINGS_FORNITORI;
if(!FORNITORI_SETTINGS_K) window.AppKeys.SETTINGS_FORNITORI = 'cp4_settings_fornitori';
FORNITORI_SETTINGS_K = window.AppKeys.SETTINGS_FORNITORI;
if(typeof window.fornitoriSettings === 'undefined' || window.fornitoriSettings === null){
  window.fornitoriSettings = lsGet(FORNITORI_SETTINGS_K, []) || [];
}
if(!Array.isArray(window.fornitoriSettings)) window.fornitoriSettings = [];

/** Slot colore fissi (filtri e menu carrello) — stesso ordine ovunque. */
var CT_FORN_CANON_HEX = ['#e53e3e', '#38a169', '#3182ce', '#e2c400'];
var CT_FORN_HEX_FALLBACK = {
  '#e53e3e': 'Rosso', '#38a169': 'Verde', '#3182ce': 'Blu', '#e2c400': 'Giallo',
  '#888888': 'Senza colore'
};

function ctNormalizeHex(c){
  if(c == null || c === '') return '';
  var s = String(c).trim();
  if(s.charAt(0) !== '#') s = '#' + s.replace(/^#+/, '');
  if(/^#([0-9a-fA-F]{3})$/.test(s)){
    var x = s.slice(1);
    s = '#' + x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
  }
  if(!/^#([0-9a-fA-F]{6})$/.test(s)) return '';
  return s.toLowerCase();
}

/** Slot colore per filtri e popup ORDINA: canon + anagrafica + eventuali hex già usati negli articoli. */
function ctOrderedFilterColors(byColor){
  byColor = byColor || {};
  var seen = {};
  var list = [];
  function add(h){
    h = ctNormalizeHex(h);
    if(!h || seen[h]) return;
    seen[h] = true;
    list.push(h);
  }
  CT_FORN_CANON_HEX.forEach(function(h){ add(h); });
  (window.fornitoriSettings || []).forEach(function(f){
    if(f && f.colore) add(f.colore);
  });
  Object.keys(byColor).forEach(function(h){ add(h); });
  return list.sort(function(a, b){
    var ia = CT_FORN_CANON_HEX.indexOf(a), ib = CT_FORN_CANON_HEX.indexOf(b);
    if(ia !== -1 && ib !== -1) return ia - ib;
    if(ia !== -1) return -1;
    if(ib !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
}

/** Lista hex per il popup "Ordina" sulle card (ordine script: ui-card prima di questo file → funzione usata da ui-card se presente). */
function ctHexSlotsOrdineFornitore(){
  var byColor = typeof daoCollectDaOrdinareByColor === 'function' ? daoCollectDaOrdinareByColor() : {};
  return ctOrderedFilterColors(byColor);
}

function ctForniColoreKey(){
  if(typeof CT_FORN_KEY !== 'undefined' && CT_FORN_KEY) return CT_FORN_KEY;
  if(window.AppKeys && window.AppKeys.FORNI_COLORE) return window.AppKeys.FORNI_COLORE;
  return 'cp4_forniColore';
}
function ctGetForniColore(){
  var saved = {};
  try{ saved = lsGet(ctForniColoreKey(), {}) || {}; }catch(e){ saved = {}; }
  if((!saved || !Object.keys(saved).length) && typeof window.forniColore === 'object' && window.forniColore){
    saved = window.forniColore;
  }
  return saved || {};
}
function ctSaveForniColore(map){
  map = map || {};
  lsSet(ctForniColoreKey(), map);
  if(typeof window !== 'undefined') window.forniColore = map;
}

/** Chiave Firebase/localStorage per note fornitore: hex senza # (RTDB vieta # nelle chiavi). */
function ctFornNotaDbKey(colore){
  var hex = ctNormalizeHex(colore);
  if(hex) return hex.replace(/^#/, '');
  return String(colore || '').replace(/^#/, '').toLowerCase();
}
function _ctSanitizeForniNoteMap(raw){
  raw = raw || {};
  var out = {};
  Object.keys(raw).forEach(function(k){
    var val = raw[k];
    if(val == null) return;
    var t = String(val).trim();
    if(!t) return;
    var dbKey = String(k).replace(/^#/, '').toLowerCase();
    if(!/^[0-9a-f]{6}$/.test(dbKey)) return;
    if(!out[dbKey]) out[dbKey] = t;
  });
  return out;
}
function ctLookupFornNotaInMap(map, colore){
  map = map || {};
  var dbKey = ctFornNotaDbKey(colore);
  var hexKey = ctNormalizeHex(colore);
  var n = map[dbKey];
  if(!n && hexKey && map[hexKey]) n = map[hexKey];
  if(!n && dbKey && map['#' + dbKey]) n = map['#' + dbKey];
  return (n && String(n).trim()) ? String(n).trim() : '';
}

function ctForniNoteKey(){
  if(window.AppKeys && window.AppKeys.FORNI_NOTE) return window.AppKeys.FORNI_NOTE;
  return 'cp4_forniNote';
}
function ctGetForniNote(){
  var saved = {};
  try{ saved = lsGet(ctForniNoteKey(), {}) || {}; }catch(e){ saved = {}; }
  if((!saved || !Object.keys(saved).length) && typeof window.forniNote === 'object' && window.forniNote){
    saved = window.forniNote;
  }
  return _ctSanitizeForniNoteMap(saved);
}
function ctSaveForniNote(map){
  map = _ctSanitizeForniNoteMap(map || {});
  lsSet(ctForniNoteKey(), map);
  if(typeof window !== 'undefined') window.forniNote = map;
}
function ctGetFornNota(colore){
  return ctLookupFornNotaInMap(ctGetForniNote(), colore);
}
function ctSaveFornNota(colore, testo){
  var dbKey = ctFornNotaDbKey(colore);
  var hexKey = ctNormalizeHex(colore);
  var map = ctGetForniNote();
  var t = (testo && String(testo).trim()) ? String(testo).trim() : '';
  if(t) map[dbKey] = t;
  else delete map[dbKey];
  if(hexKey) delete map[hexKey];
  if(dbKey) delete map['#' + dbKey];
  ctSaveForniNote(map);
}

(function _ctMigrateForniNoteKeysOnce(){
  try{
    var raw = lsGet(ctForniNoteKey(), null);
    if(!raw || typeof raw !== 'object') return;
    var hasLegacy = Object.keys(raw).some(function(k){ return k.charAt(0) === '#'; });
    if(!hasLegacy) return;
    ctSaveForniNote(_ctSanitizeForniNoteMap(raw));
  }catch(e){}
})();

/** Nome fornitore salvato per lo slot colore; altrimenti etichetta di default. */
function ctEtichettaFornitore(hex){
  var m = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
  var hn = ctNormalizeHex(hex) || hex;
  var custom = (m && m[hn]) || (m && m[hex]);
  if(custom && String(custom).trim()) return String(custom).trim();
  var fs = window.fornitoriSettings || [];
  for(var i = 0; i < fs.length; i++){
    var f = fs[i];
    if(!f || !f.colore) continue;
    if(ctNormalizeHex(f.colore) === hn) return String(f.nome || '').trim();
  }
  return CT_FORN_HEX_FALLBACK[hex] || CT_FORN_HEX_FALLBACK[hn] || hex || '';
}

function _daoSortedKeysForDisplay(byColor){
  var keys = Object.keys(byColor || {});
  return keys.sort(function(a, b){
    var ia = CT_FORN_CANON_HEX.indexOf(a), ib = CT_FORN_CANON_HEX.indexOf(b);
    if(ia !== -1 && ib !== -1) return ia - ib;
    if(ia !== -1) return -1;
    if(ib !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
}

/**
 * Barra filtri: Tutti + 4 fornitori (conteggi da byColor).
 * cfg: { fnFilter, fnReset, showStoricoBtn } nomi funzione globali per click.
 *      showStoricoBtn=true → mostra anche un'icona 📜 a destra di ogni slot
 *      che apre il popup "ultimi 5 ordini" per quel fornitore.
 */
function ctHtmlBarraFiltriFornitore(byColor, activeFilter, cfg){
  cfg = cfg || {};
  var fnFilter = cfg.fnFilter || 'ordForFilterColor';
  var fnReset = cfg.fnReset || 'ordForResetFiltri';
  var showStoricoBtn = !!cfg.showStoricoBtn;
  var allOn = !activeFilter;
  var h = '';
  h += '<div class="ord-forn-filter-row">';
  h += '<button type="button" class="ord-forn-filt-tutti' + (allOn ? ' ord-forn-filt-tutti--on' : '') + '" onclick="' + fnReset + '()">Tutti</button>';
  ctOrderedFilterColors(byColor).forEach(function(col){
    var cnt = (byColor && byColor[col]) ? byColor[col].length : 0;
    var nome = ctEtichettaFornitore(col);
    var isOn = activeFilter === col;
    var st = isOn
      ? 'border-color:' + col + ';background:' + col + '33;color:' + col + ';box-shadow:0 0 0 1px ' + col + '55;'
      : 'border-color:' + col + '44;background:' + col + '14;color:#ccc;';
    h += '<button type="button" class="ord-forn-filt-slot" style="' + st + '" onclick="' + fnFilter + '(\'' + col + '\')">';
    h += '<span class="ord-forn-filt-dot" style="background:' + col + '"></span>';
    h += '<span class="ord-forn-filt-lbl">' + esc(nome) + '</span>';
    h += '<span class="ord-forn-filt-n">(' + cnt + ')</span>';
    if(showStoricoBtn){
      // <span> con stopPropagation per non far scattare il filtro
      h += '<span class="ord-forn-filt-storico" title="Ultimi ordini per ' + esc(nome) + '" ';
      h += 'onclick="event.stopPropagation();daoApriPopupStoricoFornitore(\'' + col + '\')" ';
      h += 'style="margin-left:4px;padding:1px 4px;border-radius:6px;font-size:11px;line-height:1;background:rgba(255,255,255,.06);">📜</span>';
    }
    h += '</button>';
  });
  h += '<button type="button" class="ord-forn-filt-add" onclick="ctApriAggiungiFornitore()" title="Nuovo fornitore">＋</button>';
  h += '</div>';
  return h;
}

var CT_FORN_QUICK_HEX = ['#9f7aea', '#dd6b20', '#00b5d8', '#d53f8c', '#718096', '#276749'];

function ctApriAggiungiFornitore(){
  var ex = document.getElementById('ct-forn-add-modal');
  if(ex){ ex.remove(); return; }
  var bd = document.createElement('div');
  bd.id = 'ct-forn-add-backdrop';
  bd.className = 'ct-forn-add-backdrop';
  var box = document.createElement('div');
  box.id = 'ct-forn-add-modal';
  box.className = 'ct-forn-add-modal';
  box.innerHTML =
    '<div class="ct-forn-add-title">Nuovo fornitore</div>' +
    '<label class="ct-forn-add-lbl">Nome</label>' +
    '<input type="text" id="ct-forn-add-nome" class="ct-forn-add-inp" placeholder="es. Sabart" autocomplete="off">' +
    '<label class="ct-forn-add-lbl">Colore</label>' +
    '<div class="ct-forn-add-color-row">' +
    '<input type="color" id="ct-forn-add-color" class="ct-forn-add-color-native" value="#3182ce">' +
    '<span class="ct-forn-add-hint">Scegli dalla ruota o dai campioni</span></div>' +
    '<div class="ct-forn-add-swatches" id="ct-forn-add-swatches"></div>' +
    '<div class="ct-forn-add-actions">' +
    '<button type="button" class="ct-forn-add-btn ct-forn-add-btn--ghost" onclick="ctChiudiAggiungiFornitore()">Annulla</button>' +
    '<button type="button" class="ct-forn-add-btn ct-forn-add-btn--ok" onclick="ctSalvaNuovoFornitore()">Salva</button>' +
    '</div>';
  bd.onclick = function(e){ if(e.target === bd) ctChiudiAggiungiFornitore(); };
  document.body.appendChild(bd);
  document.body.appendChild(box);
  var sw = document.getElementById('ct-forn-add-swatches');
  var chips = CT_FORN_CANON_HEX.concat(CT_FORN_QUICK_HEX);
  var colorInp = document.getElementById('ct-forn-add-color');
  chips.forEach(function(hex){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ct-forn-add-chip';
    b.style.background = hex;
    b.title = hex;
    b.onclick = function(){ colorInp.value = hex; };
    sw.appendChild(b);
  });
  setTimeout(function(){
    var n = document.getElementById('ct-forn-add-nome');
    if(n) n.focus();
  }, 50);
}

function ctChiudiAggiungiFornitore(){
  var bd = document.getElementById('ct-forn-add-backdrop');
  var box = document.getElementById('ct-forn-add-modal');
  if(bd) bd.remove();
  if(box) box.remove();
}

function ctSalvaNuovoFornitore(){
  var nomeEl = document.getElementById('ct-forn-add-nome');
  var colEl = document.getElementById('ct-forn-add-color');
  var nome = nomeEl ? String(nomeEl.value || '').trim() : '';
  var colore = colEl ? ctNormalizeHex(colEl.value) : '';
  if(!nome){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Inserisci il nome fornitore');
    return;
  }
  if(!colore){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Scegli un colore valido');
    return;
  }
  var list = Array.isArray(window.fornitoriSettings) ? window.fornitoriSettings.slice() : [];
  var idx = -1;
  for(var i = 0; i < list.length; i++){
    if(list[i] && ctNormalizeHex(list[i].colore) === colore){ idx = i; break; }
  }
  var entry = { id: 'forn_' + Date.now(), nome: nome, colore: colore };
  if(idx >= 0){
    entry.id = list[idx].id || entry.id;
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  window.fornitoriSettings = list;
  lsSet(FORNITORI_SETTINGS_K, list);
  var map = ctGetForniColore();
  map[colore] = nome;
  ctSaveForniColore(map);
  daoPropagaNomeFornitoreSuArticoli(colore, nome);
  ctChiudiAggiungiFornitore();
  if(typeof saveCarrelli === 'function') saveCarrelli();
  if(typeof saveOrdini === 'function') saveOrdini();
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
  if(typeof showToastGen === 'function') showToastGen('green', 'Fornitore salvato');
}

/** Carrello attivo o nel cestino (dopo "Elimina carrello" gli articoli da ordinare restano qui). */
function _daoResolveCart(cartId){
  var c = (typeof carrelli !== 'undefined' && carrelli) ? carrelli.find(function(x){ return x.id === cartId; }) : null;
  if(c) return { cart: c, inCestino: false };
  var cc = typeof carrelliCestino !== 'undefined' ? carrelliCestino : [];
  c = cc.find(function(x){ return x.id === cartId; });
  if(c) return { cart: c, inCestino: true };
  return null;
}
function _daoResolveOrdine(ordId){
  var o = (typeof ordini !== 'undefined' && ordini) ? ordini.find(function(x){ return x && x.id === ordId; }) : null;
  return o ? { ordine: o } : null;
}
function _daoPersistCartRef(res){
  if(!res || !res.cart) return;
  if(res.inCestino){
    if(typeof lsSet === 'function' && typeof CART_CK !== 'undefined') lsSet(CART_CK, carrelliCestino);
  } else if(typeof saveCarrelli === 'function'){
    saveCarrelli();
  }
}
function _daoColorFromItem(it){
  if(!it) return '';
  var col = ctNormalizeHex(it._ordColore);
  if(col) return col;
  var nome = String(it._ordFornitoreNome || it.fornitore || '').trim().toLowerCase();
  if(!nome) return '';
  var map = ctGetForniColore();
  var keys = Object.keys(map || {});
  for(var i = 0; i < keys.length; i++){
    if(String(map[keys[i]] || '').trim().toLowerCase() === nome) return ctNormalizeHex(keys[i]) || keys[i];
  }
  var fs = window.fornitoriSettings || [];
  for(var j = 0; j < fs.length; j++){
    if(fs[j] && String(fs[j].nome || '').trim().toLowerCase() === nome) return ctNormalizeHex(fs[j].colore) || fs[j].colore;
  }
  return '#888888';
}

var _daoOrdQtyTimer = null;
function daoSetDaOrdQtyInput(cartId, idx, el){
  clearTimeout(_daoOrdQtyTimer);
  _daoOrdQtyTimer = setTimeout(function(){ daoSetDaOrdQty(cartId, idx, el && el.value); }, 350);
}
function daoSetDaOrdQtyCommit(cartId, idx, el){
  clearTimeout(_daoOrdQtyTimer);
  daoSetDaOrdQty(cartId, idx, el && el.value);
}

function daoSetDaOrdQty(cartId, idx, val){
  var res = _daoResolveCart(cartId);
  var ordRes = null;
  if(!res && String(cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(cartId).slice(4));
  if((!res || !res.cart.items[idx]) && (!ordRes || !ordRes.ordine.items[idx])) return;
  var cart = res ? res.cart : null;
  var it = res ? cart.items[idx] : ordRes.ordine.items[idx];
  if(!it.daOrdinare) return;
  var allowDec = (typeof itemUnitAllowsDecimalQty === 'function') ? itemUnitAllowsDecimalQty(it.unit) : false;
  var parsed = parseFloat(val);
  if(!isFinite(parsed) || parsed <= 0) parsed = allowDec ? 0.1 : 1;
  if(allowDec){
    it.qty = Math.max(0.1, Math.round(parsed * 1000) / 1000);
  } else {
    it.qty = Math.max(1, Math.round(parsed));
  }
  if(typeof _cartRicalcolaPrezzoVendita === 'function') _cartRicalcolaPrezzoVendita(it);
  if(res){
    if(typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(cart);
    _daoPersistCartRef(res);
  } else if(typeof saveOrdini === 'function'){
    saveOrdini();
  }
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdini === 'function') renderOrdini();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
}

/** Articoli "da ordinare" raggruppati per colore (con cartId + idx per azioni). Include carrelli nel cestino. */
function _daoNormalizeKeyToken(v){
  return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
}
function _daoProdKeyFromItem(it){
  if(!it) return '';
  if(it.rowIdx != null && String(it.rowIdx).trim() !== '') return 'ri:' + _daoNormalizeKeyToken(it.rowIdx);
  if(it.codM) return 'cm:' + _daoNormalizeKeyToken(it.codM);
  if(it.codF) return 'cf:' + _daoNormalizeKeyToken(it.codF);
  return 'ds:' + _daoNormalizeKeyToken(it.desc || '');
}
function _daoSumQty(a, b){
  var na = parseFloat(a);
  var nb = parseFloat(b);
  if(!isFinite(na)) na = 0;
  if(!isFinite(nb)) nb = 0;
  return Math.round((na + nb) * 1000) / 1000;
}
function _daoIsOrderMirrorOfLinkedCart(refId, idx, it, prodKey){
  if(String(refId || '').indexOf('ord:') !== 0) return false;
  var ordId = String(refId).slice(4);
  if(!ordId) return false;
  var col = _daoColorFromItem(it);
  var lists = [
    (typeof carrelli !== 'undefined' ? carrelli : []),
    (typeof carrelliCestino !== 'undefined' ? carrelliCestino : [])
  ];
  for(var li = 0; li < lists.length; li++){
    var list = lists[li] || [];
    for(var ci = 0; ci < list.length; ci++){
      var c = list[ci];
      if(!c || (c.ordId !== ordId && c.bozzaOrdId !== ordId)) continue;
      var mirror = (c.items || [])[idx];
      if(!mirror || !mirror.daOrdinare) continue;
      if(_daoProdKeyFromItem(mirror) !== prodKey) continue;
      var mirrorCol = _daoColorFromItem(mirror);
      if(mirrorCol && col && mirrorCol !== col) continue;
      return true;
    }
  }
  return false;
}
function daoCollectDaOrdinareByColor(){
  var byColor = {};
  var upsertMap = {};
  function addEntry(it, idx, refId, cartNome){
    if(!it || !it.daOrdinare) return;
    var col = _daoColorFromItem(it);
    if(!col) return;
    var prodKey = _daoProdKeyFromItem(it);
    if(!prodKey) return;
    // Evita il doppione "specchio" carrello↔ordine dello stesso flusso.
    if(_daoIsOrderMirrorOfLinkedCart(refId, idx, it, prodKey)) return;
    var sortAt = _daoEntrySortAt(it, refId);
    var dayKey = _daoDayKeyFromSortAt(sortAt);
    var dedupKey = col + '|' + prodKey + '|' + dayKey;
    if(!upsertMap[col]) upsertMap[col] = {};
    if(!byColor[col]) byColor[col] = [];
    var existing = upsertMap[col][dedupKey];
    if(!existing){
      var copy = JSON.parse(JSON.stringify(it));
      copy.qty = _daoSumQty(0, copy.qty);
      var entry = { it: copy, cartNome: cartNome || '', cartId: refId, idx: idx, sortAt: sortAt, dayKey: dayKey };
      upsertMap[col][dedupKey] = entry;
      byColor[col].push(entry);
      return;
    }
    existing.it.qty = _daoSumQty(existing.it.qty, it.qty);
    if(!existing.it.codM && it.codM) existing.it.codM = it.codM;
    if(!existing.it.codF && it.codF) existing.it.codF = it.codF;
    if(!existing.it.nota && it.nota) existing.it.nota = it.nota;
    if(!existing.it._ordFornitoreNome && it._ordFornitoreNome) existing.it._ordFornitoreNome = it._ordFornitoreNome;
    if(it._daOrdinareAt && (!existing.sortAt || String(it._daOrdinareAt) > String(existing.sortAt))){
      existing.sortAt = it._daOrdinareAt;
      existing.it._daOrdinareAt = it._daOrdinareAt;
    }
    // Preferisci riferimento carrello (azioni più coerenti) rispetto a riferimento ordine.
    if(String(existing.cartId || '').indexOf('ord:') === 0 && String(refId || '').indexOf('ord:') !== 0){
      existing.cartId = refId;
      existing.idx = idx;
      existing.cartNome = cartNome || existing.cartNome;
    }
  }
  function scanList(list){
    (list||[]).forEach(function(cart){
      (cart.items||[]).forEach(function(it, idx){
        addEntry(it, idx, cart.id, cart.nome || '');
      });
    });
  }
  scanList(typeof carrelli !== 'undefined' ? carrelli : []);
  scanList(typeof carrelliCestino !== 'undefined' ? carrelliCestino : []);
  (typeof ordini !== 'undefined' ? ordini : []).forEach(function(ord){
    (ord.items||[]).forEach(function(it, idx){
      addEntry(it, idx, 'ord:' + ord.id, ord.nome || ord.cliente || 'Ordine');
    });
  });
  return byColor;
}

function daoPropagaNomeFornitoreSuArticoli(colore, nome){
  var n = (nome && String(nome).trim()) ? String(nome).trim() : '';
  var cNorm = ctNormalizeHex(colore) || colore;
  function matchCol(c){
    return ctNormalizeHex(c) === cNorm || c === colore || c === cNorm;
  }
  function scanCartItems(cart){
    (cart.items||[]).forEach(function(it){
      if(it.daOrdinare && matchCol(it._ordColore)){
        if(n) it._ordFornitoreNome = n;
        else delete it._ordFornitoreNome;
      }
    });
  }
  (typeof carrelli !== 'undefined' ? carrelli : []).forEach(scanCartItems);
  (typeof carrelliCestino !== 'undefined' ? carrelliCestino : []).forEach(scanCartItems);
  if(typeof ordini !== 'undefined' && ordini){
    ordini.forEach(function(ord){
      (ord.items||[]).forEach(function(it){
        if(it.daOrdinare && matchCol(it._ordColore)){
          if(n) it._ordFornitoreNome = n;
          else delete it._ordFornitoreNome;
        }
      });
    });
  }
  if(typeof lsSet === 'function' && typeof CART_CK !== 'undefined' && typeof carrelliCestino !== 'undefined'){
    lsSet(CART_CK, carrelliCestino);
  }
}

function _daoClearFlagsOnItem(it){
  if(!it) return;
  it.daOrdinare = false;
  delete it._ordColore;
  delete it._ordFornitoreNome;
  delete it._daOrdinareAt;
}

function _daoTouchDaOrdinareAt(it){
  if(it) it._daOrdinareAt = new Date().toISOString();
}
if(typeof window !== 'undefined') window._daoTouchDaOrdinareAt = _daoTouchDaOrdinareAt;

function _daoClearDaOrdinareAt(it){
  if(it) delete it._daOrdinareAt;
}
if(typeof window !== 'undefined') window._daoClearDaOrdinareAt = _daoClearDaOrdinareAt;

function _daoPad2(n){
  return String(n).padStart(2, '0');
}

function _daoDayKeyFromSortAt(iso){
  if(!iso) return 'senza-data';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return 'senza-data';
  return d.getFullYear() + '-' + _daoPad2(d.getMonth() + 1) + '-' + _daoPad2(d.getDate());
}

function _daoEntrySortAt(it, refId){
  if(it && it._daOrdinareAt) return it._daOrdinareAt;
  var res = _daoResolveCart(refId);
  if(res && res.cart){
    if(typeof ctCartActivityIso === 'function'){
      var act = ctCartActivityIso(res.cart);
      if(act) return act;
    }
  }
  if(String(refId || '').indexOf('ord:') === 0){
    var ordId = String(refId).slice(4);
    var ordRes = _daoResolveOrdine(ordId);
    if(ordRes && ordRes.ordine){
      var o = ordRes.ordine;
      if(o.createdAt) return String(o.createdAt);
      if(o.dataISO) return String(o.dataISO);
    }
  }
  return '';
}

function _daoFindItemInList(items, idx, prodKey){
  if(!items || !items.length || !prodKey) return null;
  if(idx >= 0 && idx < items.length){
    var atIdx = items[idx];
    if(atIdx && _daoProdKeyFromItem(atIdx) === prodKey) return atIdx;
  }
  for(var i = 0; i < items.length; i++){
    if(items[i] && _daoProdKeyFromItem(items[i]) === prodKey) return items[i];
  }
  return null;
}

function _daoMergeTouched(touched, part){
  if(!part) return touched;
  if(part.activeCart) touched.activeCart = true;
  if(part.cestinoCart) touched.cestinoCart = true;
  if(part.ordini) touched.ordini = true;
  return touched;
}

function _daoClearMirrorInCartList(cart, idx, prodKey, inCestino){
  var out = { activeCart: false, cestinoCart: false, ordini: false };
  if(!cart || !cart.items) return out;
  var mirror = _daoFindItemInList(cart.items, idx, prodKey);
  if(!mirror || !mirror.daOrdinare) return out;
  _daoClearFlagsOnItem(mirror);
  if(inCestino) out.cestinoCart = true;
  else out.activeCart = true;
  return out;
}

function _daoClearMirrorInOrdine(ordId, idx, prodKey){
  var out = { activeCart: false, cestinoCart: false, ordini: false };
  var ordRes = _daoResolveOrdine(ordId);
  if(!ordRes || !ordRes.ordine || !ordRes.ordine.items) return out;
  var mirror = _daoFindItemInList(ordRes.ordine.items, idx, prodKey);
  if(!mirror || !mirror.daOrdinare) return out;
  _daoClearFlagsOnItem(mirror);
  out.ordini = true;
  return out;
}

/** Propaga rimozione daOrdinare su specchio carrello ↔ ordine collegato. */
function _daoPropagaRipulisciDaOrdinare(cartId, idx, it){
  var touched = { activeCart: false, cestinoCart: false, ordini: false };
  var prodKey = _daoProdKeyFromItem(it);
  if(!prodKey) return touched;

  if(String(cartId || '').indexOf('ord:') === 0){
    var ordId = String(cartId).slice(4);
    var bundles = [
      { list: typeof carrelli !== 'undefined' ? carrelli : [], inCestino: false },
      { list: typeof carrelliCestino !== 'undefined' ? carrelliCestino : [], inCestino: true }
    ];
    bundles.forEach(function(bundle){
      (bundle.list || []).forEach(function(cart){
        if(!cart || (cart.ordId !== ordId && cart.bozzaOrdId !== ordId)) return;
        touched = _daoMergeTouched(touched, _daoClearMirrorInCartList(cart, idx, prodKey, bundle.inCestino));
      });
    });
  } else {
    var res = _daoResolveCart(cartId);
    if(res && res.cart){
      var cart = res.cart;
      if(cart.ordId) touched = _daoMergeTouched(touched, _daoClearMirrorInOrdine(cart.ordId, idx, prodKey));
      if(cart.bozzaOrdId && cart.bozzaOrdId !== cart.ordId){
        touched = _daoMergeTouched(touched, _daoClearMirrorInOrdine(cart.bozzaOrdId, idx, prodKey));
      }
    }
  }
  return touched;
}

function _daoPersistRipulisciTouched(touched){
  if(touched.activeCart && typeof saveCarrelli === 'function') saveCarrelli();
  if(touched.cestinoCart && typeof lsSet === 'function' && typeof CART_CK !== 'undefined'){
    lsSet(CART_CK, carrelliCestino);
  }
  if(touched.ordini && typeof saveOrdini === 'function') saveOrdini();
}

function _daoApplyNotaToItem(it, nota){
  if(!it) return;
  var t = (nota && String(nota).trim()) ? String(nota).trim() : '';
  if(t) it.nota = t;
  else delete it.nota;
}

function _daoSetNotaMirrorInCartList(cart, idx, prodKey, nota, inCestino){
  var out = { activeCart: false, cestinoCart: false, ordini: false };
  if(!cart || !cart.items) return out;
  var mirror = _daoFindItemInList(cart.items, idx, prodKey);
  if(!mirror) return out;
  _daoApplyNotaToItem(mirror, nota);
  if(inCestino) out.cestinoCart = true;
  else out.activeCart = true;
  return out;
}

function _daoSetNotaMirrorInOrdine(ordId, idx, prodKey, nota){
  var out = { activeCart: false, cestinoCart: false, ordini: false };
  var ordRes = _daoResolveOrdine(ordId);
  if(!ordRes || !ordRes.ordine || !ordRes.ordine.items) return out;
  var mirror = _daoFindItemInList(ordRes.ordine.items, idx, prodKey);
  if(!mirror) return out;
  _daoApplyNotaToItem(mirror, nota);
  out.ordini = true;
  return out;
}

function _daoPropagaNotaSuMirror(cartId, idx, it, nota){
  var touched = { activeCart: false, cestinoCart: false, ordini: false };
  var prodKey = _daoProdKeyFromItem(it);
  if(!prodKey) return touched;

  if(String(cartId || '').indexOf('ord:') === 0){
    var ordId = String(cartId).slice(4);
    var bundles = [
      { list: typeof carrelli !== 'undefined' ? carrelli : [], inCestino: false },
      { list: typeof carrelliCestino !== 'undefined' ? carrelliCestino : [], inCestino: true }
    ];
    bundles.forEach(function(bundle){
      (bundle.list || []).forEach(function(cart){
        if(!cart || (cart.ordId !== ordId && cart.bozzaOrdId !== ordId)) return;
        touched = _daoMergeTouched(touched, _daoSetNotaMirrorInCartList(cart, idx, prodKey, nota, bundle.inCestino));
      });
    });
  } else {
    var res = _daoResolveCart(cartId);
    if(res && res.cart){
      var cart = res.cart;
      if(cart.ordId) touched = _daoMergeTouched(touched, _daoSetNotaMirrorInOrdine(cart.ordId, idx, prodKey, nota));
      if(cart.bozzaOrdId && cart.bozzaOrdId !== cart.ordId){
        touched = _daoMergeTouched(touched, _daoSetNotaMirrorInOrdine(cart.bozzaOrdId, idx, prodKey, nota));
      }
    }
  }
  return touched;
}

function daoSetItemNota(cartId, idx, notaTesto){
  var res = _daoResolveCart(cartId);
  var ordRes = null;
  if(!res && String(cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(cartId).slice(4));
  if((!res || !res.cart.items[idx]) && (!ordRes || !ordRes.ordine.items[idx])) return;
  var it = res ? res.cart.items[idx] : ordRes.ordine.items[idx];
  _daoApplyNotaToItem(it, notaTesto);
  var touched = _daoPropagaNotaSuMirror(cartId, idx, it, notaTesto);
  if(res){
    if(res.inCestino) touched.cestinoCart = true;
    else touched.activeCart = true;
  } else {
    touched.ordini = true;
  }
  _daoPersistRipulisciTouched(touched);
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdini === 'function') renderOrdini();
  if(typeof renderOrdFor === 'function') renderOrdFor(true);
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView(true);
}

function daoEditFornNota(col){
  if(typeof daoShowQuickNotaSheet !== 'function') return;
  var corrente = typeof ctGetFornNota === 'function' ? ctGetFornNota(col) : '';
  daoShowQuickNotaSheet({
    title: 'Nota fornitore',
    value: corrente,
    placeholder: 'es. Ordinare il marted\u00ec...',
    onSave: function(val){
      if(typeof ctSaveFornNota === 'function') ctSaveFornNota(col, val);
      if(typeof renderOrdFor === 'function') renderOrdFor(true);
      if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView(true);
    }
  });
}
if(typeof window !== 'undefined') window.daoEditFornNota = daoEditFornNota;

function daoEditItemNota(cartId, idx){
  if(typeof daoShowQuickNotaSheet !== 'function') return;
  var res = _daoResolveCart(cartId);
  var ordRes = null;
  if(!res && String(cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(cartId).slice(4));
  if((!res || !res.cart.items[idx]) && (!ordRes || !ordRes.ordine.items[idx])) return;
  var it = res ? res.cart.items[idx] : ordRes.ordine.items[idx];
  var corrente = (it && it.nota) ? String(it.nota) : '';
  daoShowQuickNotaSheet({
    title: 'Nota articolo',
    value: corrente,
    placeholder: 'Nota per questo articolo...',
    onSave: function(val){
      daoSetItemNota(cartId, idx, val);
    }
  });
}
if(typeof window !== 'undefined') window.daoEditItemNota = daoEditItemNota;

/** Toglie marcatore "da ordinare" (speculare carrello ↔ ordine collegato). */
function daoRipulisciVoceDaOrdinare(cartId, idx){
  var res = _daoResolveCart(cartId);
  var ordRes = null;
  if(!res && String(cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(cartId).slice(4));
  if((!res || !res.cart.items[idx]) && (!ordRes || !ordRes.ordine.items[idx])) return;
  var it = res ? res.cart.items[idx] : ordRes.ordine.items[idx];
  _daoClearFlagsOnItem(it);
  var touched = _daoPropagaRipulisciDaOrdinare(cartId, idx, it);
  if(res){
    if(res.inCestino) touched.cestinoCart = true;
    else touched.activeCart = true;
  } else {
    touched.ordini = true;
  }
  _daoPersistRipulisciTouched(touched);
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdini === 'function') renderOrdini();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
}

function daoGetStoricoRecent(){
  var recent = lsGet(ORD_FORN_STOR_K, []) || [];
  if(Array.isArray(recent)) return recent;
  if(recent && typeof recent === 'object'){
    return Object.keys(recent).map(function(k){ return recent[k]; }).filter(function(x){ return x; });
  }
  return [];
}

/** True se il driver Firebase è pronto per scritture/letture. */
function daoFbReady(){
  return typeof _fbReady !== 'undefined' && !!_fbReady &&
         typeof _fbDb !== 'undefined' && !!_fbDb;
}

/** Pubblica un singolo batch nell'archivio completo Firebase. Idempotente per id. */
function daoUploadBatchArchivioCompleto(batch){
  if(!daoFbReady() || !batch || !batch.id) return false;
  try{
    _fbDb.ref(DAO_FB_ARCHIVIO_PATH + '/' + batch.id).set(batch);
    return true;
  }catch(e){
    console.error('[OrdFor] upload archivio completo errore:', e);
    return false;
  }
}

/**
 * Tiene per ogni colore (fornitore) solo gli ultimi DAO_STORICO_PER_FORN_MAX
 * batch in localStorage. I batch in eccesso vengono SCARTATI dalla copia
 * locale: la persistenza è garantita dall'archivio completo su Firebase.
 * NB: chi chiama deve aver già pubblicato i batch su Firebase prima di
 * passarli qui (vedi daoArchiviaColoreGruppo).
 */
function daoPruneStoricoLast5PerColore(arr){
  if(!Array.isArray(arr)) return [];
  var seenPerColore = {};
  var keep = [];
  // arr è ordinato dal più recente al più vecchio (unshift in archivia)
  arr.forEach(function(b){
    if(!b) return;
    var col = (typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(b.colore) || b.colore) : b.colore) || '';
    var key = col || '__noColor__';
    seenPerColore[key] = (seenPerColore[key] || 0) + 1;
    if(seenPerColore[key] <= DAO_STORICO_PER_FORN_MAX) keep.push(b);
  });
  return keep;
}

/** Alias di compatibilità: il vecchio prune cold-archive non è più usato. */
function daoPruneStoricoToCold(arr){
  return daoPruneStoricoLast5PerColore(arr);
}

/**
 * Migrazione una-tantum: sposta il vecchio cold archive locale
 * (cp4_ord_forn_storico_cold) sul nodo Firebase shared/archivio_ordini_completo.
 * Il dato locale non viene cancellato (backup di sicurezza).
 */
function daoMigraColdToFirebase(){
  try{
    if(localStorage.getItem(DAO_MIGR_FLAG_K) === '1') return;
  }catch(e){}
  if(!daoFbReady()) return;
  var cold = [];
  try{
    var raw = localStorage.getItem(ORD_FORN_COLD_K);
    cold = raw ? JSON.parse(raw) : [];
  }catch(e){ cold = []; }
  if(!Array.isArray(cold) || !cold.length){
    try{ localStorage.setItem(DAO_MIGR_FLAG_K, '1'); }catch(e){}
    return;
  }
  // Pubblica anche le voci recenti in archivio completo (idempotente per id)
  var recent = daoGetStoricoRecent();
  var all = (Array.isArray(recent) ? recent : []).concat(cold);
  var ok = 0, fail = 0;
  all.forEach(function(b){
    if(!b || !b.id) return;
    if(daoUploadBatchArchivioCompleto(b)) ok++; else fail++;
  });
  if(!fail){
    try{ localStorage.setItem(DAO_MIGR_FLAG_K, '1'); }catch(e){}
    console.log('[OrdFor] migrazione archivio completata, batch pubblicati:', ok);
  } else {
    console.warn('[OrdFor] migrazione parziale, ok:', ok, 'fail:', fail);
  }
}

/** Avvia la migrazione quando Firebase è pronto. */
(function(){
  function tryMigra(retry){
    if(daoFbReady()){ daoMigraColdToFirebase(); return; }
    if(retry > 20) return;
    setTimeout(function(){ tryMigra(retry+1); }, 500);
  }
  setTimeout(function(){ tryMigra(0); }, 1500);
})();

function _daoHtmlBatchItemRows(items){
  return (items || []).map(function(it){
    var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7, '0') : it.codM) : '';
    var um = it.unit || 'pz';
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#ddd;">' + esc(it.desc || '—') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;font-family:monospace;">' + esc(codM) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;font-family:monospace;">' + esc(it.codF || '') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#68d391;text-align:right;">' + esc(String(it.qty || '')) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;">' + esc(um) + '</td>' +
      '</tr>';
  }).join('');
}

function _daoHtmlBatchItemsTable(items){
  var rows = _daoHtmlBatchItemRows(items);
  if(!rows){
    return '<div style="padding:12px;color:#888;">Nessun articolo.</div>';
  }
  return '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
    '<thead><tr>' +
      '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Descrizione</th>' +
      '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Cod.Mag</th>' +
      '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Cod.Forn</th>' +
      '<th style="padding:6px 8px;text-align:right;color:#888;border-bottom:1px solid #333;">Q.tà</th>' +
      '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">UM</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function daoChiudiConfermaArchiviaOverlay(){
  var el = document.getElementById('dao-arch-conf-overlay');
  if(el) el.remove();
}

/** Anteprima articoli + No / Stampa / Sì (stampa + archivia). */
function daoConfermaArchiviaGruppo(colore){
  colore = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(colore) || colore) : colore;
  var byColor = daoCollectDaOrdinareByColor();
  var entries = byColor[colore] || [];
  if(!entries.length){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Nessun articolo in questo gruppo');
    return;
  }
  var forniMap = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
  var nome = (forniMap[colore] && String(forniMap[colore]).trim())
    ? String(forniMap[colore]).trim()
    : (typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(colore) : colore);
  var items = entries.map(function(e){ return e.it; });
  var col = colore || '#888888';
  var colAttr = String(col).replace(/'/g, "\\'");

  daoChiudiConfermaArchiviaOverlay();
  var bd = document.createElement('div');
  bd.id = 'dao-arch-conf-overlay';
  bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9055;display:flex;align-items:center;justify-content:center;padding:16px;';
  bd.onclick = function(e){ if(e.target === bd) daoChiudiConfermaArchiviaOverlay(); };

  bd.innerHTML =
    '<div class="dao-arch-conf-box" style="background:#1a1a1c;border:1px solid #333;border-radius:12px;max-width:720px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;" onclick="event.stopPropagation()">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #333;">' +
        '<span style="width:14px;height:14px;border-radius:50%;background:' + col + ';flex-shrink:0;"></span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:14px;font-weight:900;color:#fff;">' + esc(nome) + '</div>' +
          '<div style="font-size:11px;color:#888;">Confermi archiviazione? — ' + items.length + ' articoli</div>' +
        '</div>' +
        '<button type="button" onclick="daoChiudiConfermaArchiviaOverlay()" style="background:transparent;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;">✕</button>' +
      '</div>' +
      '<div style="overflow:auto;padding:8px 14px;flex:1;min-height:0;">' +
        _daoHtmlBatchItemsTable(items) +
      '</div>' +
      '<div style="display:flex;gap:8px;padding:12px 14px;border-top:1px solid #333;flex-wrap:wrap;justify-content:flex-end;">' +
        '<button type="button" onclick="daoChiudiConfermaArchiviaOverlay()" style="padding:8px 16px;border-radius:8px;border:1px solid #444;background:transparent;color:#aaa;font-size:12px;font-weight:800;cursor:pointer;">No</button>' +
        '<button type="button" onclick="daoArchiviaGruppoSoloStampa(\'' + colAttr + '\')" style="padding:8px 16px;border-radius:8px;border:1px solid #3182ce66;background:#3182ce22;color:#90cdf4;font-size:12px;font-weight:800;cursor:pointer;">🖨️ Stampa</button>' +
        '<button type="button" onclick="daoArchiviaGruppoSi(\'' + colAttr + '\')" style="padding:8px 16px;border-radius:8px;border:none;background:#38a169;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">Sì, archivia</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(bd);
}

function daoArchiviaGruppoSoloStampa(colore){
  colore = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(colore) || colore) : colore;
  if(typeof daoGenerateOrderPDF === 'function') daoGenerateOrderPDF(colore);
  daoChiudiConfermaArchiviaOverlay();
}

function daoArchiviaGruppoSi(colore){
  colore = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(colore) || colore) : colore;
  daoChiudiConfermaArchiviaOverlay();
  var ok = typeof daoGenerateOrderPDF === 'function' ? daoGenerateOrderPDF(colore) : false;
  if(!ok) return;
  setTimeout(function(){
    daoArchiviaColoreGruppo(colore);
    if(typeof showToastGen === 'function') showToastGen('green', 'Ordine stampato e archiviato');
  }, 500);
}

/** Sposta il gruppo colore in "già ordinati" e svuota le righe dai carrelli. */
function daoArchiviaColoreGruppo(colore){
  var byColor = daoCollectDaOrdinareByColor();
  var entries = byColor[colore];
  if(!entries || !entries.length){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Nessun articolo in questo gruppo');
    return;
  }
  var forniMap = ctGetForniColore();
  var batch = {
    id: 'ofarch_' + Date.now(),
    archivedAt: new Date().toISOString(),
    colore: colore,
    nomeFornitore: (forniMap[colore] && String(forniMap[colore]).trim()) ? String(forniMap[colore]).trim() : ctEtichettaFornitore(colore),
    items: entries.map(function(e){
      return {
        desc: e.it.desc,
        codM: e.it.codM,
        codF: e.it.codF,
        qty: e.it.qty,
        unit: e.it.unit,
        prezzoUnit: e.it.prezzoUnit,
        nota: e.it.nota,
        cartNome: e.cartNome
      };
    })
  };
  var touchedActive = false;
  var touchedCestino = false;
  var touchedOrdini = false;
  entries.forEach(function(e){
    var res = _daoResolveCart(e.cartId);
    var ordRes = null;
    if(!res && String(e.cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(e.cartId).slice(4));
    if((!res || !res.cart.items[e.idx]) && (!ordRes || !ordRes.ordine.items[e.idx])) return;
    var it = res ? res.cart.items[e.idx] : ordRes.ordine.items[e.idx];
    _daoClearFlagsOnItem(it);
    var part = _daoPropagaRipulisciDaOrdinare(e.cartId, e.idx, it);
    if(res){
      if(res.inCestino) touchedCestino = true;
      else touchedActive = true;
    } else {
      touchedOrdini = true;
    }
    if(part.activeCart) touchedActive = true;
    if(part.cestinoCart) touchedCestino = true;
    if(part.ordini) touchedOrdini = true;
  });
  // 1) Persistenza FULL su Firebase: avviene PRIMA del prune locale,
  //    così l'eccedenza scartata in locale resta comunque sul cloud.
  if(!daoUploadBatchArchivioCompleto(batch)){
    console.warn('[OrdFor] Firebase non pronto: il batch verrà ripubblicato alla prossima migrazione');
  }
  // 2) Recente locale: regola dei 5 per fornitore
  var recent = daoGetStoricoRecent();
  recent.unshift(batch);
  recent = daoPruneStoricoLast5PerColore(recent);
  lsSet(ORD_FORN_STOR_K, recent);
  if(typeof window !== 'undefined') window.ordFornStorico = recent;
  if(touchedActive && typeof saveCarrelli === 'function') saveCarrelli();
  if(touchedCestino && typeof lsSet === 'function' && typeof CART_CK !== 'undefined') lsSet(CART_CK, carrelliCestino);
  if((touchedOrdini || touchedActive) && typeof saveOrdini === 'function') saveOrdini();
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdini === 'function') renderOrdini();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
  if(typeof showToastGen === 'function') showToastGen('green', 'Gruppo archiviato come ordinato');
}

/** Archivio freddo: alias di compatibilità — legge il vecchio store locale (read-only). */
function daoLoadStoricoCold(){
  try{
    var raw = localStorage.getItem(ORD_FORN_COLD_K);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

/**
 * Carica l'archivio completo da Firebase (shared/archivio_ordini_completo).
 * Restituisce via callback un array di batch ordinato dal più recente.
 */
function daoFetchArchivioCompleto(cb){
  if(!daoFbReady()){
    cb && cb([], 'Database non connesso');
    return;
  }
  try{
    _fbDb.ref(DAO_FB_ARCHIVIO_PATH).once('value').then(function(snap){
      var data = snap.val() || {};
      var arr = [];
      if(Array.isArray(data)){
        arr = data.filter(function(x){ return x && x.id; });
      } else {
        Object.keys(data).forEach(function(k){
          var v = data[k];
          if(v && typeof v === 'object'){
            if(!v.id) v.id = k;
            arr.push(v);
          }
        });
      }
      arr.sort(function(a, b){
        var ta = a && a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        var tb = b && b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
        return tb - ta;
      });
      cb && cb(arr, null);
    }).catch(function(err){
      console.error('[OrdFor] fetch archivio completo errore:', err);
      cb && cb([], String(err && err.message || err));
    });
  }catch(e){
    console.error('[OrdFor] fetch archivio completo eccezione:', e);
    cb && cb([], String(e && e.message || e));
  }
}

/** Apre il pannello di ricerca dell'archivio completo (sostituisce il vecchio archivio cold). */
function daoApriArchivioColdUI(){
  daoApriRicercaArchivio();
}

/** Mostra/focus la barra di ricerca inline dell'archivio completo. */
function daoApriRicercaArchivio(){
  var inp = daoQueryInActiveWrap('#dao-search-input');
  if(inp){
    try{ inp.focus(); inp.select(); }catch(e){}
    inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  // Se non siamo nella tab Ordini Fornitore, mostra un fallback semplice
  if(!daoFbReady()){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Database non connesso');
    return;
  }
  daoFetchArchivioCompleto(function(arr, err){
    if(err){
      if(typeof showToastGen === 'function') showToastGen('orange', 'Errore archivio: ' + err);
      return;
    }
    if(!arr.length){
      if(typeof showToastGen === 'function') showToastGen('yellow', 'Archivio completo vuoto');
      return;
    }
    var lines = arr.slice(0, 120).map(function(b){
      var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
      return d + ' — ' + (b.nomeFornitore||b.colore||'') + ' — ' + (b.items||[]).length + ' art.';
    });
    var txt = lines.join('\n');
    if(txt.length > 4500) txt = txt.slice(0, 4500) + '\n…';
    alert(txt);
  });
}

/** Esegue la ricerca testuale (nome prodotto / data / codici / fornitore) sull'archivio completo. */
var _daoSearchTimer = null;
var _daoSearchMode = 'catalogo';
var _daoSearchQuery = '';
var DAO_FORN_STAGING_CART_ID = '__dao_forn_staging__';

/** Container visibile: Tab Ordini → Da ordinare ha priorità su Carrello → Ordini fornitore. */
function daoGetActiveSearchWrap(){
  var daOrd = document.getElementById('ord-daordinare-view');
  if(daOrd){
    var hidden = daOrd.style.display === 'none';
    if(!hidden){
      try{
        var cs = window.getComputedStyle(daOrd);
        if(cs && cs.display !== 'none' && cs.visibility !== 'hidden') return daOrd;
      }catch(e){
        return daOrd;
      }
    }
  }
  var ordFor = document.getElementById('t-ordfor-body');
  if(ordFor) return ordFor;
  return daOrd || ordFor || null;
}

function daoQueryInActiveWrap(selector){
  var wrap = daoGetActiveSearchWrap();
  if(!wrap) return null;
  try{ return wrap.querySelector(selector); }catch(e){ return null; }
}

function daoIsFornStagingCart(cart){
  return typeof _cartIsStagingCart === 'function'
    ? _cartIsStagingCart(cart)
    : !!(cart && (cart._daoFornStaging === true || cart.id === DAO_FORN_STAGING_CART_ID));
}

function daoGetOrCreateStagingCart(){
  if(typeof carrelli === 'undefined' || !carrelli) return null;
  var cart = carrelli.find(function(c){ return c && daoIsFornStagingCart(c); });
  if(!cart){
    var nowIso = new Date().toISOString();
    cart = {
      id: DAO_FORN_STAGING_CART_ID,
      nome: '',
      _daoFornStaging: true,
      createdAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      dataCreazione: Date.now(),
      creatoAtISO: nowIso,
      ultimaModificaISO: nowIso,
      items: [],
      scontoGlobale: null,
      fatturaRichiesta: false,
      fatturaCliente: null,
      salvaFatturaInRubrica: false
    };
    carrelli.push(cart);
  }
  return cart;
}

function daoBuildCatalogItem(rowIdx){
  var r = (typeof rows !== 'undefined' && rows) ? (rows[rowIdx] || {}) : {};
  var m = (typeof magazzino !== 'undefined' && magazzino) ? (magazzino[rowIdx] || {}) : {};
  var hasScag = !!(m.scaglioni && m.scaglioni.length);
  var newItem = {
    rowIdx: rowIdx,
    desc: r.desc || '',
    codF: r.codF || '',
    codM: r.codM || '',
    specs: m.specs || '',
    posizione: m.posizione || '',
    prezzoUnit: r.prezzo || '0',
    qty: 1,
    unit: typeof rowListinoUnit === 'function' ? rowListinoUnit(r) : (r.unit || 'pz'),
    scampolo: false,
    hasScaglioni: hasScag,
    scaglioni: hasScag ? JSON.parse(JSON.stringify(m.scaglioni)) : [],
    nota: '',
    _scaglioniAperti: false,
    daOrdinare: false
  };
  if(typeof itemUsesPrezzoPerBaseUm === 'function' && itemUsesPrezzoPerBaseUm(newItem.unit)){
    var pList = parsePriceIT(r.prezzo || '0');
    if(pList > 0){
      newItem._prezzoUnitaBase = typeof itemFormatPrezzoLineStr === 'function' ? itemFormatPrezzoLineStr(pList) : String(pList);
      if(typeof itemApplyPrezzoUnitaBase === 'function') itemApplyPrezzoUnitaBase(newItem);
    }
  }
  return newItem;
}

function daoSetDaOrdColoreOnItem(it, colore){
  if(!it) return;
  var cNorm = (colore && typeof ctNormalizeHex === 'function') ? ctNormalizeHex(colore) : (colore || '');
  if(colore && typeof ctNormalizeHex === 'function' && !cNorm){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Colore non valido');
    return;
  }
  if(cNorm) it._ordColore = cNorm;
  else delete it._ordColore;
  it.daOrdinare = !!it._ordColore;
  if(it._ordColore){
    if(typeof _daoTouchDaOrdinareAt === 'function') _daoTouchDaOrdinareAt(it);
    var map = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
    if(map[it._ordColore]) it._ordFornitoreNome = map[it._ordColore];
    else delete it._ordFornitoreNome;
  } else {
    delete it._ordFornitoreNome;
    if(typeof _daoClearDaOrdinareAt === 'function') _daoClearDaOrdinareAt(it);
  }
}

function daoSearchMode(){
  return _daoSearchMode === 'catalogo' ? 'catalogo' : 'ordini';
}

function daoToggleSearchMode(){
  _daoSearchMode = (_daoSearchMode === 'catalogo') ? 'ordini' : 'catalogo';
  var inp = daoQueryInActiveWrap('#dao-search-input');
  var q = inp ? String(inp.value || '').trim() : _daoSearchQuery;
  _daoSearchQuery = q;
  if(_daoSearchMode === 'ordini') daoRipristinaVisibilitaRighe();
  daoAggiornaUiBarraRicerca();
  if(q.length >= 2) daoCercaInput(q);
  else daoChiudiRicerca(false);
}

function daoAggiornaUiBarraRicerca(){
  var badge = daoQueryInActiveWrap('#dao-search-mode-badge');
  var btn = daoQueryInActiveWrap('#dao-search-mode-btn');
  var inp = daoQueryInActiveWrap('#dao-search-input');
  var isCat = daoSearchMode() === 'catalogo';
  if(badge) badge.textContent = isCat ? 'Catalogo' : 'Ordini';
  if(btn){
    btn.title = isCat ? 'Passa a ricerca ordini' : 'Passa a ricerca catalogo';
    btn.setAttribute('aria-label', btn.title);
  }
  if(inp){
    inp.placeholder = isCat
      ? 'Cerca nel catalogo (nome, codice, fornitore)...'
      : 'Cerca ordini correnti e archivio (prodotto, codice, fornitore, data)...';
  }
}

function daoCercaArchivioInput(val){
  daoCercaInput(val);
}

function daoCercaInput(val){
  _daoSearchQuery = String(val != null ? val : '').trim();
  if(_daoSearchTimer) clearTimeout(_daoSearchTimer);
  _daoSearchTimer = setTimeout(function(){
    if(daoSearchMode() === 'catalogo') daoCercaCatalogo(_daoSearchQuery);
    else daoCercaOrdini(_daoSearchQuery);
  }, 300);
}

function _daoEntrySearchHay(entry, col){
  var it = (entry && entry.it) || {};
  var forn = typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(col) : (col || '');
  var nota = (it.nota != null ? it.nota : it.note) || '';
  return [
    it.desc || '',
    it.codM || '',
    it.codF || '',
    entry.cartNome || '',
    forn,
    col || '',
    it._ordFornitoreNome || '',
    nota
  ].join(' ').toLowerCase();
}

function daoRaccogliMatchCorrenti(q){
  q = String(q || '').toLowerCase().trim();
  if(!q) return [];
  var byColor = typeof daoCollectDaOrdinareByColor === 'function' ? daoCollectDaOrdinareByColor() : {};
  var out = [];
  Object.keys(byColor).forEach(function(col){
    (byColor[col] || []).forEach(function(entry){
      if(_daoEntrySearchHay(entry, col).indexOf(q) !== -1){
        out.push({ entry: entry, col: col, rowId: typeof daoRowDomId === 'function' ? daoRowDomId(entry) : '' });
      }
    });
  });
  return out;
}

function daoRipristinaVisibilitaRighe(){
  var wrap = daoGetActiveSearchWrap();
  if(!wrap) return;
  wrap.querySelectorAll('.dao-row--search-hidden').forEach(function(el){
    el.classList.remove('dao-row--search-hidden');
  });
  wrap.querySelectorAll('.ord-dao-group--search-hidden').forEach(function(el){
    el.classList.remove('ord-dao-group--search-hidden');
  });
  wrap.querySelectorAll('.dao-day-sep--search-hidden').forEach(function(el){
    el.classList.remove('dao-day-sep--search-hidden');
  });
}

function daoFiltraRigheCorrenti(q){
  q = String(q || '').toLowerCase().trim();
  var wrap = daoGetActiveSearchWrap();
  if(!wrap) return;
  if(!q){
    daoRipristinaVisibilitaRighe();
    return;
  }
  wrap.querySelectorAll('.dao-row--compact[data-dao-search]').forEach(function(row){
    var hay = row.getAttribute('data-dao-search') || '';
    row.classList.toggle('dao-row--search-hidden', hay.indexOf(q) === -1);
  });
  wrap.querySelectorAll('.ord-dao-group').forEach(function(grp){
    var vis = grp.querySelector('.dao-row--compact:not(.dao-row--search-hidden)');
    grp.classList.toggle('ord-dao-group--search-hidden', !vis);
  });
  wrap.querySelectorAll('.dao-day-sep').forEach(function(sep){
    var el = sep.nextElementSibling;
    var anyVisible = false;
    while(el){
      if(el.classList.contains('ord-dao-group')) break;
      if(el.classList.contains('dao-day-sep')) break;
      if(el.classList.contains('dao-row--compact') && !el.classList.contains('dao-row--search-hidden')){
        anyVisible = true;
        break;
      }
      el = el.nextElementSibling;
    }
    sep.classList.toggle('dao-day-sep--search-hidden', !anyVisible);
  });
}

function daoScrollToRigaCorrente(rowId){
  if(!rowId) return;
  var wrap = daoGetActiveSearchWrap();
  var row = null;
  if(wrap){
    try{ row = wrap.querySelector('[id="' + String(rowId).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'); }catch(e){}
  }
  if(!row) row = document.getElementById(rowId);
  if(!row) return;
  row.classList.remove('dao-row--search-hidden');
  var grp = row.closest('.ord-dao-group');
  if(grp) grp.classList.remove('ord-dao-group--search-hidden');
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  row.classList.add('dao-row--search-flash');
  setTimeout(function(){ row.classList.remove('dao-row--search-flash'); }, 1200);
}

function daoFiltraArchivioBatch(arr, q){
  q = String(q || '').toLowerCase().trim();
  if(!q) return [];
  return (arr || []).filter(function(b){
    if(!b) return false;
    var d = (b.archivedAt || '').toLowerCase();
    if(d.indexOf(q) !== -1) return true;
    var nm = (b.nomeFornitore || '').toLowerCase();
    if(nm.indexOf(q) !== -1) return true;
    return (b.items || []).some(function(it){
      return (String(it.desc||'').toLowerCase().indexOf(q) !== -1) ||
             (String(it.codM||'').toLowerCase().indexOf(q) !== -1) ||
             (String(it.codF||'').toLowerCase().indexOf(q) !== -1);
    });
  });
}

function daoRenderRisultatiOrdini(liveMatches, archiveArr, q){
  var resBox = daoQueryInActiveWrap('#dao-search-results');
  if(!resBox) return;
  liveMatches = liveMatches || [];
  archiveArr = archiveArr || [];
  if(!liveMatches.length && !archiveArr.length){
    resBox.innerHTML = '<div class="dao-search-empty">Nessun risultato per "' + esc(q) + '".</div>';
    return;
  }
  var h = '';
  h += '<div class="dao-search-panel-head">';
  h += 'RISULTATI RICERCA';
  h += '<button type="button" class="dao-search-close-btn" onclick="daoChiudiRicerca()" title="Chiudi ricerca">\u2715</button>';
  h += '</div>';
  if(liveMatches.length){
    h += '<div class="dao-search-section-title">CORRENTI (' + liveMatches.length + ')</div>';
    liveMatches.slice(0, 40).forEach(function(m){
      var it = m.entry.it || {};
      var forn = typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(m.col) : m.col;
      h += '<div class="dao-search-row dao-search-row--live" onclick="daoScrollToRigaCorrente(\'' + esc(m.rowId) + '\')">';
      h += '<span class="dao-search-live-dot" style="background:' + esc(m.col) + '"></span>';
      h += '<span class="dao-search-live-desc">' + esc(it.desc || '\u2014') + '</span>';
      h += '<span class="dao-search-live-meta">' + esc(forn) + '</span>';
      h += '</div>';
    });
  }
  if(archiveArr.length){
    h += '<div class="dao-search-section-title">ARCHIVIO (' + archiveArr.length + ')</div>';
    archiveArr.slice(0, 80).forEach(function(b){
      var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
      var col = b.colore || '#888888';
      var nItems = (b.items || []).length;
      h += '<div class="dao-search-row dao-search-row--arch" onclick="daoApriDettaglioBatchArchivio(\'' + esc(b.id||'') + '\')">';
      h += '<span class="dao-search-live-dot" style="background:' + col + '"></span>';
      h += '<span class="dao-search-arch-date">' + esc(d) + '</span>';
      h += '<span class="dao-search-live-desc">' + esc(b.nomeFornitore||'') + '</span>';
      h += '<span class="dao-search-arch-count">' + nItems + ' art.</span>';
      h += '</div>';
    });
  }
  resBox.innerHTML = h;
}

function daoCercaOrdini(rawQuery){
  var resBox = daoQueryInActiveWrap('#dao-search-results');
  if(rawQuery == null){
    var inp = daoQueryInActiveWrap('#dao-search-input');
    rawQuery = inp ? inp.value : '';
  }
  var q = String(rawQuery || '').trim();
  _daoSearchQuery = q;
  if(!resBox) return;
  if(!q){
    daoChiudiRicerca(false);
    return;
  }
  if(q.length < 2){
    resBox.innerHTML = '';
    resBox.style.display = 'none';
    daoRipristinaVisibilitaRighe();
    return;
  }
  daoFiltraRigheCorrenti(q);
  var liveMatches = daoRaccogliMatchCorrenti(q);
  resBox.style.display = 'block';
  resBox.innerHTML = '<div class="dao-search-loading">Ricerca in corso...</div>';
  daoFetchArchivioCompleto(function(arr, err){
    if(err){
      daoRenderRisultatiOrdini(liveMatches, [], q);
      var rb = daoQueryInActiveWrap('#dao-search-results');
      if(rb) rb.insertAdjacentHTML('beforeend', '<div class="dao-search-arch-err">Archivio: ' + esc(err) + '</div>');
      return;
    }
    daoRenderRisultatiOrdini(liveMatches, daoFiltraArchivioBatch(arr, q), q);
  });
}

var _daoCatalogSearchMoreState = { q: '', matches: [], shown: 0 };
var DAO_CATALOG_SEARCH_INITIAL = 15;
var DAO_CATALOG_SEARCH_PAGE = 20;

function daoCatalogSearchLoadMore(){
  var inp = daoQueryInActiveWrap('#dao-search-input');
  var qNow = inp ? String(inp.value || '').trim() : '';
  var st = _daoCatalogSearchMoreState;
  if(!st.matches.length || qNow !== st.q) return;
  var listEl = daoQueryInActiveWrap('#dao-catalog-search-rows');
  var moreEl = daoQueryInActiveWrap('#dao-catalog-search-more');
  if(!listEl || !moreEl) return;
  var total = st.matches.length;
  var start = st.shown;
  if(start >= total) return;
  var end = Math.min(start + DAO_CATALOG_SEARCH_PAGE, total);
  for(var ci = start; ci < end; ci++){
    listEl.insertAdjacentHTML('beforeend', daoCatalogSearchResultRowHtml(st.matches[ci]));
  }
  st.shown = end;
  var rem = total - end;
  if(rem <= 0){
    moreEl.parentNode.removeChild(moreEl);
  } else {
    moreEl.textContent = '... e altri ' + rem + ' articoli';
  }
}

function daoCatalogSearchResultRowHtml(x){
  var r = x.r, i = x.i, m = x.m;
  var qty = m.qty !== undefined && m.qty !== '' ? m.qty : '';
  var qtyNum = qty === '' ? null : Number(qty);
  var outOfStock = qtyNum !== null && qtyNum <= 0;
  var h = '';
  h += '<div class="dao-search-catalog-row">';
  h += '<div class="dao-search-catalog-info">';
  h += '<div class="dao-search-catalog-desc">' + esc(r.desc) + '</div>';
  h += '<div class="dao-search-catalog-meta">';
  if(r.codF) h += '<span class="dao-search-catalog-codf">' + esc(r.codF) + '</span> ';
  if(r.codM) h += '<span class="dao-search-catalog-codm">' + esc(r.codM) + '</span>';
  if(m.marca) h += ' <span class="dao-search-catalog-marca">' + esc(m.marca) + '</span>';
  h += '</div>';
  if(qty !== '') h += '<div class="dao-search-catalog-stock' + (outOfStock ? ' dao-search-catalog-stock--out' : '') + '">Stock: ' + esc(qty) + ' ' + esc(rowListinoUnit(r)) + '</div>';
  h += '</div>';
  h += '<div class="dao-search-catalog-actions">';
  h += '<div class="dao-search-catalog-price">' + esc(r.prezzo) + '</div>';
  h += '<button type="button" class="dao-search-ordina-btn" onclick="event.stopPropagation();daoOrdinaDaCatalogo(' + i + ', this)">Ordina</button>';
  h += '</div></div>';
  return h;
}

function daoCercaCatalogo(rawQuery){
  var resBox = daoQueryInActiveWrap('#dao-search-results');
  if(rawQuery == null){
    var inp = daoQueryInActiveWrap('#dao-search-input');
    rawQuery = inp ? inp.value : '';
  }
  var q = String(rawQuery || '').trim();
  _daoSearchQuery = q;
  if(!resBox) return;
  daoRipristinaVisibilitaRighe();
  if(!q){
    daoChiudiRicerca(false);
    return;
  }
  if(q.length < 2){
    resBox.innerHTML = '';
    resBox.style.display = 'none';
    return;
  }
  resBox.style.display = 'block';
  if(typeof rows === 'undefined' || !rows || !rows.length){
    resBox.innerHTML = '<div class="dao-search-loading">\u23F3 Database in caricamento, attendi...</div>';
    return;
  }
  _daoCatalogSearchMoreState = { q: '', matches: [], shown: 0 };
  var matches = typeof catalogSearchCollectMatches === 'function' ? catalogSearchCollectMatches(q) : [];
  if(!matches.length){
    resBox.innerHTML = '<div class="dao-search-empty">Nessun risultato catalogo per "' + esc(q) + '".</div>';
    return;
  }
  var firstN = Math.min(DAO_CATALOG_SEARCH_INITIAL, matches.length);
  _daoCatalogSearchMoreState = { q: q, matches: matches, shown: firstN };
  var h = '';
  h += '<div class="dao-search-panel-head">';
  h += 'CATALOGO (' + matches.length + ')';
  h += '<button type="button" class="dao-search-close-btn" onclick="daoChiudiRicerca()" title="Chiudi ricerca">\u2715</button>';
  h += '</div>';
  h += '<div class="dao-search-catalog-list">';
  h += '<div id="dao-catalog-search-rows">';
  for(var ri = 0; ri < firstN; ri++){
    h += daoCatalogSearchResultRowHtml(matches[ri]);
  }
  h += '</div>';
  var rem = matches.length - firstN;
  if(rem > 0){
    h += '<div id="dao-catalog-search-more" class="dao-search-more-btn" role="button" tabindex="0" onclick="daoCatalogSearchLoadMore()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();daoCatalogSearchLoadMore();}">... e altri ' + rem + ' articoli</div>';
  }
  h += '</div>';
  resBox.innerHTML = h;
  resBox.classList.add('dao-search-results--open');
}

function daoOrdinaDaCatalogo(rowIdx, anchorEl){
  var slots = typeof ctHexSlotsOrdineFornitore === 'function'
    ? ctHexSlotsOrdineFornitore()
    : (typeof CT_FORN_CANON_HEX !== 'undefined' ? CT_FORN_CANON_HEX : ['#e53e3e', '#38a169', '#3182ce', '#e2c400']);
  if(typeof ctOpenOrdinaPopup !== 'function') return;
  ctOpenOrdinaPopup({
    key: 'dao-catalog:' + rowIdx,
    slots: slots,
    activeColor: '',
    anchorEl: anchorEl || null,
    onSelectColor: function(color){
      if(!color) return;
      var prevActiveCartId = (typeof activeCartId !== 'undefined') ? activeCartId : null;
      var cart = daoGetOrCreateStagingCart();
      if(!cart){
        if(typeof showToastGen === 'function') showToastGen('orange', 'Impossibile salvare articolo');
        return;
      }
      var newItem = daoBuildCatalogItem(rowIdx);
      daoSetDaOrdColoreOnItem(newItem, color);
      if(!newItem.daOrdinare) return;
      cart.items = cart.items || [];
      var prodKey = _daoProdKeyFromItem(newItem);
      var dayKey = _daoDayKeyFromSortAt(newItem._daOrdinareAt);
      var colNorm = _daoColorFromItem(newItem);
      var merged = false;
      for(var mi = 0; mi < cart.items.length; mi++){
        var ex = cart.items[mi];
        if(!ex || !ex.daOrdinare) continue;
        if(_daoColorFromItem(ex) !== colNorm) continue;
        if(_daoProdKeyFromItem(ex) !== prodKey) continue;
        if(_daoDayKeyFromSortAt(ex._daOrdinareAt) !== dayKey) continue;
        ex.qty = _daoSumQty(ex.qty, newItem.qty);
        merged = true;
        break;
      }
      if(!merged) cart.items.push(newItem);
      cart.ultimaModificaISO = new Date().toISOString();
      if(typeof saveCarrelli === 'function') saveCarrelli();
      if(typeof activeCartId !== 'undefined'){
        activeCartId = prevActiveCartId;
        if(typeof _cartEnsureActiveNotStaging === 'function') _cartEnsureActiveNotStaging();
      }
      if(typeof ctCloseOrdinaPopup === 'function') ctCloseOrdinaPopup();
      if(typeof renderOrdFor === 'function') renderOrdFor(true);
      if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView(true);
      if(typeof showToastGen === 'function') showToastGen('green', 'Aggiunto a da ordinare');
    }
  });
}

function daoSearchReapplyAfterRender(){
  var q = _daoSearchQuery || '';
  var inp = daoQueryInActiveWrap('#dao-search-input');
  if(inp && String(inp.value || '').trim()) q = String(inp.value || '').trim();
  if(!q || q.length < 2) return;
  daoAggiornaUiBarraRicerca();
  if(daoSearchMode() === 'catalogo') daoCercaCatalogo(q);
  else daoCercaOrdini(q);
}

function daoCercaArchivio(rawQuery){
  daoCercaOrdini(rawQuery);
}

function daoRenderRisultatiRicerca(arr, q){
  daoRenderRisultatiOrdini([], arr || [], q);
}

function daoChiudiRicerca(clearInput){
  if(clearInput !== false){
    var inp = daoQueryInActiveWrap('#dao-search-input');
    if(inp) inp.value = '';
  }
  _daoSearchQuery = '';
  _daoCatalogSearchMoreState = { q: '', matches: [], shown: 0 };
  daoRipristinaVisibilitaRighe();
  var resBox = daoQueryInActiveWrap('#dao-search-results');
  if(resBox){
    resBox.innerHTML = '';
    resBox.style.display = 'none';
    resBox.classList.remove('dao-search-results--open');
  }
}
if(typeof window !== 'undefined'){
  window.daoGetActiveSearchWrap = daoGetActiveSearchWrap;
  window.daoQueryInActiveWrap = daoQueryInActiveWrap;
  window.daoIsFornStagingCart = daoIsFornStagingCart;
  window.daoToggleSearchMode = daoToggleSearchMode;
  window.daoCercaInput = daoCercaInput;
  window.daoScrollToRigaCorrente = daoScrollToRigaCorrente;
  window.daoOrdinaDaCatalogo = daoOrdinaDaCatalogo;
  window.daoCatalogSearchLoadMore = daoCatalogSearchLoadMore;
  window.daoChiudiRicerca = daoChiudiRicerca;
  window._daoEntrySearchHay = _daoEntrySearchHay;
}

/** Mostra il dettaglio (read-only) di un batch archiviato, fetchando il singolo nodo Firebase. */
function daoApriDettaglioBatchArchivio(batchId){
  if(!batchId) return;
  if(!daoFbReady()){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Database non connesso');
    return;
  }
  try{
    _fbDb.ref(DAO_FB_ARCHIVIO_PATH + '/' + batchId).once('value').then(function(snap){
      var b = snap.val();
      if(!b){
        if(typeof showToastGen === 'function') showToastGen('yellow', 'Ordine non trovato');
        return;
      }
      _daoMostraDettaglioBatchOverlay(b);
    }).catch(function(err){
      console.error('[OrdFor] dettaglio batch errore:', err);
    });
  }catch(e){ console.error('[OrdFor] dettaglio batch eccezione:', e); }
}

function _daoMostraDettaglioBatchOverlay(b){
  var ex = document.getElementById('dao-detail-overlay');
  if(ex) ex.remove();
  var bd = document.createElement('div');
  bd.id = 'dao-detail-overlay';
  bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9050;display:flex;align-items:center;justify-content:center;padding:16px;';
  bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
  var d = b.archivedAt ? b.archivedAt.slice(0, 10) : '';
  var col = b.colore || '#888888';
  bd.innerHTML =
    '<div style="background:#1a1a1c;border:1px solid #333;border-radius:12px;max-width:720px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #333;">' +
        '<span style="width:14px;height:14px;border-radius:50%;background:' + col + ';"></span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:14px;font-weight:900;color:#fff;">' + esc(b.nomeFornitore || '') + '</div>' +
          '<div style="font-size:11px;color:#888;">Archiviato il ' + esc(d) + ' — ' + (b.items || []).length + ' articoli</div>' +
        '</div>' +
        '<button type="button" onclick="document.getElementById(\'dao-detail-overlay\').remove()" style="background:transparent;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;">✕</button>' +
      '</div>' +
      '<div style="overflow:auto;padding:8px 14px 14px;">' +
        _daoHtmlBatchItemsTable(b.items || []) +
      '</div>' +
    '</div>';
  document.body.appendChild(bd);
}

/** Popup "ultimi 5 ordini" per un fornitore (legge dal recente locale, già pruned a 5). */
function daoApriPopupStoricoFornitore(colore){
  daoChiudiPopupStoricoFornitore();
  var col = ctNormalizeHex(colore) || colore;
  var nome = ctEtichettaFornitore(colore);
  var recent = daoGetStoricoRecent();
  var lista = (recent || []).filter(function(b){
    if(!b) return false;
    var c = ctNormalizeHex(b.colore) || b.colore;
    return c === col;
  }).slice(0, DAO_STORICO_PER_FORN_MAX);

  var bd = document.createElement('div');
  bd.id = 'dao-storico-bd';
  bd.style.cssText = 'position:fixed;inset:0;z-index:9020;background:rgba(0,0,0,.45);';
  bd.onclick = function(e){ if(e.target === bd) daoChiudiPopupStoricoFornitore(); };

  var box = document.createElement('div');
  box.id = 'dao-storico-popup';
  box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9021;'+
    'background:#1a1a1c;border:1px solid '+col+'66;border-radius:12px;'+
    'min-width:280px;max-width:420px;width:92%;max-height:70vh;display:flex;flex-direction:column;'+
    'box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden;';

  var head = '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;">' +
    '<span style="width:12px;height:12px;border-radius:50%;background:' + col + ';"></span>' +
    '<div style="flex:1;font-size:12px;font-weight:900;color:#fff;">' + esc(nome) + '</div>' +
    '<span style="font-size:10px;color:#888;">Ultimi ' + DAO_STORICO_PER_FORN_MAX + '</span>' +
    '<button type="button" onclick="daoChiudiPopupStoricoFornitore()" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1;">✕</button>' +
    '</div>';

  var body = '<div style="overflow:auto;">';
  if(!lista.length){
    body += '<div style="padding:18px;text-align:center;color:#666;font-size:11px;">Nessun ordine archiviato per questo fornitore.</div>';
  } else {
    lista.forEach(function(b){
      var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
      var n = (b.items||[]).length;
      body += '<div onclick="daoApriDettaglioBatchArchivio(\'' + esc(b.id||'') + '\')" ' +
        'style="padding:10px 12px;border-top:1px solid #252528;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
        '<div style="font-size:11px;color:#ddd;">' + esc(d) + '</div>' +
        '<div style="font-size:10px;color:#68d391;">' + n + ' art.</div>' +
        '</div>';
    });
  }
  body += '</div>';

  box.innerHTML = head + body;
  document.body.appendChild(bd);
  document.body.appendChild(box);
}

function daoChiudiPopupStoricoFornitore(){
  var bd = document.getElementById('dao-storico-bd');
  var box = document.getElementById('dao-storico-popup');
  if(bd) bd.remove();
  if(box) box.remove();
}

/**
 * Genera un PDF "stampabile" dell'ordine corrente (gruppo colore).
 * Apre una nuova finestra con HTML print-ready (l'utente può scegliere
 * "Salva come PDF" dal dialog di stampa).
 * Ritorna true se la finestra si è aperta correttamente.
 */
function daoGenerateOrderPDF(colore){
  var byColor = daoCollectDaOrdinareByColor();
  var entries = byColor[colore] || [];
  if(!entries.length){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Nessun articolo da stampare');
    return false;
  }
  var nomeFornitore = ctEtichettaFornitore(colore);
  var dataOggi = new Date();
  var dataStr = dataOggi.toLocaleDateString('it-IT');
  var oraStr = dataOggi.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  var rows = entries.map(function(e){
    var it = e.it || {};
    var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
    var qty  = (it.qty != null && it.qty !== '') ? String(it.qty) : '';
    var um   = it.unit || 'pz';
    return '<tr>' +
      '<td>' + esc(it.desc || '') + '</td>' +
      '<td class="mono">' + esc(codM) + '</td>' +
      '<td class="mono">' + esc(it.codF || '') + '</td>' +
      '<td class="qty">' + esc(qty) + '</td>' +
      '<td>' + esc(um) + '</td>' +
      '</tr>';
  }).join('');

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Ordine Fornitore - ' + esc(nomeFornitore) + ' - ' + esc(dataStr) + '</title>' +
    '<style>' +
      '*{box-sizing:border-box;}' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000;padding:18px;margin:0;}' +
      'h1{font-size:20px;margin:0 0 2px;letter-spacing:1px;}' +
      '.sub{font-size:11px;color:#444;margin-bottom:14px;}' +
      '.meta{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;}' +
      '.meta .right{text-align:right;}' +
      '.meta b{display:inline-block;min-width:90px;}' +
      'table{width:100%;border-collapse:collapse;margin-top:6px;}' +
      'thead th{background:#222;color:#fff;font-size:11px;padding:7px 8px;text-align:left;border:1px solid #222;}' +
      'tbody td{font-size:11px;padding:6px 8px;border:1px solid #999;vertical-align:top;}' +
      'tbody tr:nth-child(even) td{background:#f3f3f3;}' +
      '.qty{text-align:right;font-weight:bold;}' +
      '.mono{font-family:Consolas,Menlo,monospace;}' +
      '.foot{margin-top:14px;font-size:10px;color:#555;border-top:1px solid #999;padding-top:6px;display:flex;justify-content:space-between;}' +
      '@media print{@page{size:A4;margin:12mm;}body{padding:0;}.no-print{display:none;}}' +
      '.no-print{margin:10px 0;text-align:right;}' +
      '.no-print button{padding:8px 14px;border:none;background:#c00;color:#fff;border-radius:6px;font-size:12px;cursor:pointer;}' +
    '</style></head><body>' +
    '<div class="no-print"><button onclick="window.print()">🖨️ Stampa / Salva PDF</button></div>' +
    '<h1>FERRAMENTA RATTAZZI</h1>' +
    '<div class="sub">Ordine fornitore</div>' +
    '<div class="meta">' +
      '<div><b>Fornitore:</b> ' + esc(nomeFornitore) + '</div>' +
      '<div class="right"><b>Data:</b> ' + esc(dataStr) + ' ' + esc(oraStr) + '</div>' +
    '</div>' +
    '<table>' +
      '<thead><tr>' +
        '<th>Descrizione articolo</th>' +
        '<th>Cod. Magazzino</th>' +
        '<th>Cod. Fornitore</th>' +
        '<th class="qty">Q.tà</th>' +
        '<th>UM</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<div class="foot">' +
      '<div>Totale articoli: <b>' + entries.length + '</b></div>' +
      '<div>Generato il ' + esc(dataStr) + ' alle ' + esc(oraStr) + '</div>' +
    '</div>' +
    '<script>setTimeout(function(){try{window.print();}catch(e){}},350);<\/script>' +
    '</body></html>';

  var w = window.open('', '_blank');
  if(!w){
    if(typeof showToastGen === 'function') showToastGen('orange', 'Abilita i popup per generare il PDF');
    return false;
  }
  try{
    w.document.open();
    w.document.write(html);
    w.document.close();
  }catch(e){
    console.error('[OrdFor] PDF write errore:', e);
    if(typeof showToastGen === 'function') showToastGen('orange', 'Errore generazione PDF');
    try{ w.close(); }catch(_){ }
    return false;
  }
  return true;
}

/**
 * Flusso completo "invio ordine":
 *  1) genera PDF (apre dialog di stampa/salva)
 *  2) archivia automaticamente il gruppo (sposta su Firebase + pulisce carrelli)
 *  3) la lista del fornitore si svuota in tab.
 */
function daoInviaEArchiviaGruppo(colore){
  daoConfermaArchiviaGruppo(colore);
}

function daoHtmlBloccoStoricoRecente(){
  var recent = daoGetStoricoRecent().slice(0, 12);
  if(!recent.length) return '';
  var h = '<div style="margin:14px 0;padding:10px 12px;background:#1a1a1c;border:1px solid #333;border-radius:10px;">';
  h += '<div style="font-size:11px;font-weight:900;color:#888;margin-bottom:8px;letter-spacing:.5px;">GIÀ ORDINATI (ultimi 5 per fornitore)</div>';
  recent.forEach(function(b){
    var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
    var bid = esc(b.id || '');
    h += '<div onclick="daoApriDettaglioBatchArchivio(\'' + bid + '\')" ' +
      'style="font-size:11px;color:#68d391;padding:4px 0;border-bottom:1px solid #252528;cursor:pointer;">';
    h += esc(d) + ' — ' + esc(b.nomeFornitore||b.colore||'') + ' — ' + (b.items||[]).length + ' art.';
    h += '</div>';
  });
  h += '<button type="button" onclick="daoApriRicercaArchivio()" style="margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid #444;background:transparent;color:#aaa;font-size:10px;cursor:pointer;">🔍 Cerca nell\'archivio completo (Firebase)</button>';
  h += '</div>';
  return h;
}

// renderOrdFor: renderizza la tab Ordini Fornitore raggruppati per colore
var _ordForColorFilter=null;
function ordForFilterColor(col){
  col = ctNormalizeHex(col) || col;
  _ordForColorFilter=(_ordForColorFilter===col)?null:col;
  renderOrdFor();
}
function ordForResetFiltri(){
  _ordForColorFilter=null;
  renderOrdFor();
}

/** HTML barra ricerca unificata (modalità Ordini / Catalogo). */
function daoHtmlSearchBar(){
  var prevVal = _daoSearchQuery || '';
  var prevInp = typeof daoQueryInActiveWrap === 'function' ? daoQueryInActiveWrap('#dao-search-input') : null;
  if(!prevInp) prevInp = document.getElementById('dao-search-input');
  if(prevInp) prevVal = prevInp.value || prevVal;
  var resVisible = false;
  var prevRes = typeof daoQueryInActiveWrap === 'function' ? daoQueryInActiveWrap('#dao-search-results') : null;
  if(!prevRes) prevRes = document.getElementById('dao-search-results');
  if(prevRes) resVisible = prevRes.style.display !== 'none' && prevRes.innerHTML.length > 0;
  var isCat = daoSearchMode() === 'catalogo';
  var h = '';
  h += '<div class="dao-search-bar">';
  h += '<div class="dao-search-bar-row">';
  h += '<span class="dao-search-bar-icon">\uD83D\uDD0D</span>';
  h += '<span id="dao-search-mode-badge" class="dao-search-mode-badge">' + (isCat ? 'Catalogo' : 'Ordini') + '</span>';
  h += '<input id="dao-search-input" type="search" class="dao-search-input" ';
  h += 'placeholder="' + (isCat ? 'Cerca nel catalogo (nome, codice, fornitore)...' : 'Cerca ordini correnti e archivio (prodotto, codice, fornitore, data)...') + '" ';
  h += 'value="' + esc(prevVal) + '" ';
  h += 'oninput="daoCercaInput(this.value)" ';
  h += 'onkeydown="if(event.key===\'Enter\'){event.preventDefault();daoCercaInput(this.value);}" ';
  h += 'autocomplete="off" autocorrect="off" spellcheck="false">';
  h += '<button type="button" id="dao-search-mode-btn" class="dao-search-mode-btn" onclick="daoToggleSearchMode()" title="' + (isCat ? 'Passa a ricerca ordini' : 'Passa a ricerca catalogo') + '" aria-label="' + (isCat ? 'Passa a ricerca ordini' : 'Passa a ricerca catalogo') + '">\uD83D\uDD04</button>';
  h += '</div>';
  h += '<div id="dao-search-results" class="dao-search-results' + (resVisible ? ' dao-search-results--open' : '') + '"></div>';
  h += '</div>';
  return h;
}

function renderOrdFor(forceRender){
  if(typeof daoRenderFornitoreView !== 'function') return;
  daoRenderFornitoreView({
    wrapId: 't-ordfor-body',
    activeFilter: _ordForColorFilter,
    filterCfg: {
      fnFilter: 'ordForFilterColor',
      fnReset: 'ordForResetFiltri',
      showStoricoBtn: true
    },
    mode: 'ordfor-tab',
    showArchiveSearch: true,
    forceRender: !!forceRender
  });
}

// ctSaveFornNome: salva il nome fornitore per un colore (solo su conferma esplicita)
function ctSaveFornNome(colore, nome){
  var map = ctGetForniColore();
  var ck = ctNormalizeHex(colore) || colore;
  if(nome && nome.trim()) map[ck] = nome.trim();
  else delete map[ck];
  ctSaveForniColore(map);
  daoPropagaNomeFornitoreSuArticoli(ck, nome);
  if(typeof saveCarrelli === 'function') saveCarrelli();
  if(typeof saveOrdini === 'function') saveOrdini();
  if(typeof renderCartTabs === 'function') renderCartTabs();
}



// ctToggleNome: click sul nome prodotto espande/collassa la card
// La classe ct-card--expanded nel CSS imposta white-space:normal sul nome
function ctToggleNome(cartId, idx){
  var card = document.getElementById('cart-row-' + idx);
  if(card) card.classList.toggle('ct-card--expanded');
}

// ctCalcolaLive — aggiorna i prezzi nel DOM in tempo reale SENZA salvare su Firebase.
// Viene chiamata da oninput sull'input %. onchange salva poi definitivamente.
// Parametri: inputEl = <input> %, idx = indice card, baseStr = prezzo originale, qty = quantità
function ctCalcolaLive(inputEl, idx, baseStr, qty){
  var perc   = parseFloat(inputEl.value) || 0;
  var base   = parsePriceIT(String(baseStr)) || 0;
  var finale = perc > 0 ? base * (1 - perc / 100) : base;
  var q      = parseFloat(qty) || 1;

  // Aggiorna preview nel pannello
  var ppEl = document.getElementById('pp-sc-' + idx);
  if(ppEl){
    ppEl.querySelector('.ct-pp-orig').textContent = 'Orig: €' + (base*q).toFixed(2);
    ppEl.querySelector('.ct-pp-fin').textContent  = 'Fin: €'  + (finale*q).toFixed(2);
  }
  // Aggiorna cella prezzo unitario (prz-IDX) — nella griglia è la colonna "Prezzo"
  var przEl = document.getElementById('prz-' + idx);
  if(przEl){
    var origEl = przEl.querySelector('.ct-old--orig');
    var finEl  = przEl.querySelector('.ct-sub--final');
    if(perc > 0 && base > finale + 0.005){
      if(origEl) origEl.textContent = '€' + base.toFixed(2);
      if(finEl)  finEl.textContent  = '€' + finale.toFixed(2);
      // Se non esistono ancora (era prezzo normale), riscrivi
      if(!origEl && !finEl){
        przEl.innerHTML = '<div class="ct-old--orig">€' + base.toFixed(2) + '</div>' +
          '<div class="ct-sub--final">€' + finale.toFixed(2) + '</div>' +
          przEl.querySelector('.ct-punit').outerHTML;
      }
    }
  }
  // Aggiorna cella totale — è il nextElementSibling di prz-IDX nella griglia
  if(przEl && przEl.nextElementSibling){
    var totCell = przEl.nextElementSibling;
    if(perc > 0 && base > finale + 0.005){
      totCell.innerHTML = '<div class="ct-old--orig">€' + (base*q).toFixed(2) + '</div>' +
        '<div class="ct-sub--final">€' + (finale*q).toFixed(2) + '</div>';
    } else {
      totCell.innerHTML = '<div style="font-size:14px;font-weight:900;color:var(--accent)">€' + (finale*q).toFixed(2) + '</div>';
    }
  }
}
