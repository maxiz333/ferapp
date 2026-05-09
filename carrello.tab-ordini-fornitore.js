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
function daoCollectDaOrdinareByColor(){
  var byColor = {};
  var seen = {};
  function addEntry(it, idx, refId, cartNome){
    if(!it || !it.daOrdinare) return;
    var col = _daoColorFromItem(it);
    if(!col) return;
    var key = String(it.codM || it.codF || it.desc || '') + '|' + String(refId || '') + '|' + idx;
    if(seen[key]) return;
    seen[key] = true;
    if(!byColor[col]) byColor[col] = [];
    byColor[col].push({ it: it, cartNome: cartNome || '', cartId: refId, idx: idx });
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

/** Toglie marcatore "da ordinare" (speculare carrello ↔ ordine collegato). */
function daoRipulisciVoceDaOrdinare(cartId, idx){
  var res = _daoResolveCart(cartId);
  var ordRes = null;
  if(!res && String(cartId || '').indexOf('ord:') === 0) ordRes = _daoResolveOrdine(String(cartId).slice(4));
  if((!res || !res.cart.items[idx]) && (!ordRes || !ordRes.ordine.items[idx])) return;
  var cart = res ? res.cart : null;
  var it = res ? cart.items[idx] : ordRes.ordine.items[idx];
  it.daOrdinare = false;
  delete it._ordColore;
  delete it._ordFornitoreNome;
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
    it.daOrdinare = false;
    delete it._ordColore;
    delete it._ordFornitoreNome;
    if(res){
      if(res.inCestino) touchedCestino = true;
      else touchedActive = true;
      if(typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(res.cart);
    } else {
      touchedOrdini = true;
    }
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
  var inp = document.getElementById('dao-search-input');
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
function daoCercaArchivioInput(val){
  // Debounce input: 300ms
  if(_daoSearchTimer) clearTimeout(_daoSearchTimer);
  _daoSearchTimer = setTimeout(function(){ daoCercaArchivio(val); }, 300);
}

function daoCercaArchivio(rawQuery){
  var resBox = document.getElementById('dao-search-results');
  if(rawQuery == null){
    var inp = document.getElementById('dao-search-input');
    rawQuery = inp ? inp.value : '';
  }
  var q = String(rawQuery || '').toLowerCase().trim();
  if(!resBox) return;
  if(!q){
    resBox.innerHTML = '';
    resBox.style.display = 'none';
    return;
  }
  resBox.style.display = 'block';
  resBox.innerHTML = '<div style="padding:10px;color:#888;font-size:11px;">Ricerca in corso...</div>';
  daoFetchArchivioCompleto(function(arr, err){
    if(err){
      resBox.innerHTML = '<div style="padding:10px;color:#fc8181;font-size:11px;">Errore: ' + esc(err) + '</div>';
      return;
    }
    var results = (arr || []).filter(function(b){
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
    daoRenderRisultatiRicerca(results, q);
  });
}

function daoRenderRisultatiRicerca(arr, q){
  var resBox = document.getElementById('dao-search-results');
  if(!resBox) return;
  if(!arr || !arr.length){
    resBox.innerHTML = '<div style="padding:10px;color:#888;font-size:11px;">Nessun risultato per "' + esc(q) + '".</div>';
    return;
  }
  var h = '';
  h += '<div style="padding:6px 10px;font-size:10px;color:#888;letter-spacing:.5px;font-weight:800;">';
  h += 'RISULTATI ARCHIVIO (' + arr.length + ')';
  h += '<button type="button" onclick="daoChiudiRicerca()" style="float:right;background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1;">✕</button>';
  h += '</div>';
  arr.slice(0, 80).forEach(function(b){
    var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
    var col = b.colore || '#888888';
    var nItems = (b.items || []).length;
    h += '<div class="dao-search-row" onclick="daoApriDettaglioBatchArchivio(\'' + esc(b.id||'') + '\')" ';
    h += 'style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid #252528;cursor:pointer;">';
    h += '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';flex:0 0 auto;"></span>';
    h += '<span style="font-size:11px;color:#aaa;flex:0 0 78px;">' + esc(d) + '</span>';
    h += '<span style="font-size:11px;color:#ddd;font-weight:700;flex:1;">' + esc(b.nomeFornitore||'') + '</span>';
    h += '<span style="font-size:10px;color:#68d391;">' + nItems + ' art.</span>';
    h += '</div>';
  });
  resBox.innerHTML = h;
}

function daoChiudiRicerca(){
  var resBox = document.getElementById('dao-search-results');
  if(resBox){ resBox.innerHTML = ''; resBox.style.display = 'none'; }
  var inp = document.getElementById('dao-search-input');
  if(inp) inp.value = '';
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
  var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
  var col = b.colore || '#888888';
  var rows = (b.items || []).map(function(it){
    var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
    var um = it.unit || 'pz';
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#ddd;">' + esc(it.desc||'—') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;font-family:monospace;">' + esc(codM) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;font-family:monospace;">' + esc(it.codF||'') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#68d391;text-align:right;">' + esc(String(it.qty||'')) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#aaa;">' + esc(um) + '</td>' +
      '</tr>';
  }).join('');
  bd.innerHTML =
    '<div style="background:#1a1a1c;border:1px solid #333;border-radius:12px;max-width:720px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #333;">' +
        '<span style="width:14px;height:14px;border-radius:50%;background:' + col + ';"></span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:14px;font-weight:900;color:#fff;">' + esc(b.nomeFornitore||'') + '</div>' +
          '<div style="font-size:11px;color:#888;">Archiviato il ' + esc(d) + ' — ' + (b.items||[]).length + ' articoli</div>' +
        '</div>' +
        '<button type="button" onclick="document.getElementById(\'dao-detail-overlay\').remove()" style="background:transparent;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;">✕</button>' +
      '</div>' +
      '<div style="overflow:auto;padding:8px 14px 14px;">' +
        (rows ?
          '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
            '<thead><tr>' +
              '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Descrizione</th>' +
              '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Cod.Mag</th>' +
              '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">Cod.Forn</th>' +
              '<th style="padding:6px 8px;text-align:right;color:#888;border-bottom:1px solid #333;">Q.tà</th>' +
              '<th style="padding:6px 8px;text-align:left;color:#888;border-bottom:1px solid #333;">UM</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>'
          : '<div style="padding:12px;color:#888;">Nessun articolo nel batch.</div>') +
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
  var byColor = daoCollectDaOrdinareByColor();
  var entries = byColor[colore] || [];
  if(!entries.length){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Nessun articolo da inviare');
    return;
  }
  var ok = daoGenerateOrderPDF(colore);
  if(!ok) return; // PDF non generato → non archiviamo per non perdere dati
  // Piccolo ritardo per dare tempo al dialog di stampa di aprirsi nel popup
  setTimeout(function(){
    daoArchiviaColoreGruppo(colore);
    if(typeof showToastGen === 'function') showToastGen('green', 'Ordine inviato e archiviato');
  }, 500);
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

/** HTML della barra di ricerca nell'archivio completo Firebase. */
function daoHtmlSearchBar(){
  // Conserva il valore attuale dell'input se è già in DOM (per non perderlo a re-render)
  var prevVal = '';
  var prevInp = document.getElementById('dao-search-input');
  if(prevInp) prevVal = prevInp.value || '';
  var resVisible = false;
  var prevRes = document.getElementById('dao-search-results');
  if(prevRes) resVisible = prevRes.style.display !== 'none' && prevRes.innerHTML.length > 0;
  var h = '';
  h += '<div style="margin-bottom:10px;padding:8px 10px;background:#16161a;border:1px solid #2a2a30;border-radius:10px;">';
  h += '<div style="display:flex;gap:6px;align-items:center;">';
  h += '<span style="font-size:13px;">🔍</span>';
  h += '<input id="dao-search-input" type="search" placeholder="Cerca archivio (prodotto, codice, fornitore o data YYYY-MM-DD)..." ';
  h += 'value="' + esc(prevVal) + '" ';
  h += 'oninput="daoCercaArchivioInput(this.value)" ';
  h += 'onkeydown="if(event.key===\'Enter\'){event.preventDefault();daoCercaArchivio(this.value);}" ';
  h += 'style="flex:1;min-width:0;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0e0e10;color:#eee;font-size:11px;">';
  h += '<button type="button" onclick="daoCercaArchivio()" style="padding:6px 10px;border-radius:8px;border:1px solid #555;background:#222;color:#ddd;font-size:10px;font-weight:700;cursor:pointer;">Cerca</button>';
  h += '</div>';
  h += '<div id="dao-search-results" style="margin-top:' + (resVisible ? '8px' : '0') + ';background:#0e0e10;border-radius:8px;border:1px solid #2a2a30;display:' + (resVisible ? 'block' : 'none') + ';max-height:320px;overflow:auto;"></div>';
  h += '</div>';
  return h;
}

function renderOrdFor(){
  var wrap = document.getElementById('t-ordfor-body');
  if(!wrap) return;
  try{

  var byColor = daoCollectDaOrdinareByColor();
  var forniMap = ctGetForniColore();
  var h = '';

  // Barra di ricerca archivio (Firebase) — sempre in cima
  h += daoHtmlSearchBar();

  h += ctHtmlBarraFiltriFornitore(byColor, _ordForColorFilter, { fnFilter: 'ordForFilterColor', fnReset: 'ordForResetFiltri', showStoricoBtn: true });

  if(!Object.keys(byColor).length){
    h += '<div style="text-align:center;padding:28px;color:#555">' +
      'Nessun articolo da ordinare.<br><small>Usa il tasto ORDINA nelle card del carrello.</small></div>';
    h += daoHtmlBloccoStoricoRecente();
    wrap.innerHTML = h;
    return;
  }

  var coloriDaMostrare = _ordForColorFilter ? [_ordForColorFilter] : _daoSortedKeysForDisplay(byColor);

  coloriDaMostrare.forEach(function(col){
    var items = byColor[col] || [];
    var fornNome = (forniMap[col] && String(forniMap[col]).trim()) ? String(forniMap[col]).trim() : '';
    var titoloSlot = ctEtichettaFornitore(col);

    h += '<div class="ord-dao-group" style="border-color:' + col + '55">';
    h += '<div class="ord-dao-header" style="border-color:' + col + '">';
    h += '<span class="ord-dao-dot" style="background:' + col + '" title="' + esc(titoloSlot) + '"></span>';
    h += '<input class="ord-dao-forn-inp ord-dao-forn-inp--title" ' +
         'value="' + esc(fornNome) + '" ' +
         'placeholder="' + esc(titoloSlot) + '" ' +
         'title="Nome fornitore (salvato)" ' +
         'oninput="ctSaveFornNome(\'' + col + '\',this.value)" ' +
         'onkeydown="if(event.key===\'Enter\')this.blur()">';
    h += '<span class="ord-dao-count">' + items.length + ' art.</span>';
    // Nuovo flusso: PDF + archivia + svuota lista
    h += '<button type="button" onclick="daoInviaEArchiviaGruppo(\'' + col + '\')" title="Genera PDF, archivia e svuota la lista" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #3182ce66;background:#3182ce22;color:#90cdf4;font-size:10px;font-weight:800;cursor:pointer;">📄 Invia & Archivia</button>';
    // Manteniamo il flusso storico (solo archivia, senza PDF) per non rompere l'abitudine
    h += '<button type="button" onclick="daoArchiviaColoreGruppo(\'' + col + '\')" title="Archivia senza generare PDF" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #38a16944;background:#38a16922;color:#68d391;font-size:10px;font-weight:800;cursor:pointer;">Archivia</button>';
    h += '</div>';

    if(!items.length){
      h += '<div class="ord-dao-empty-msg">Nessun articolo per questo fornitore.</div>';
      h += '</div>';
      return;
    }

    items.forEach(function(entry){
      var it   = entry.it;
      var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
      var sub  = (parsePriceIT(it.prezzoUnit)*(parseFloat(it.qty)||0)).toFixed(2);
      var showFornRow = it._ordFornitoreNome && String(it._ordFornitoreNome).trim() &&
        String(it._ordFornitoreNome).trim() !== String(titoloSlot).trim();
      var allowDec = (typeof itemUnitAllowsDecimalQty === 'function') ? itemUnitAllowsDecimalQty(it.unit) : false;
      var qVal = parseFloat(it.qty) || 0;
      var step = allowDec ? 'any' : '1';
      var minV = allowDec ? '0.1' : '1';
      h += '<div class="ord-dao-row ord-dao-row--forn" style="border-left:3px solid ' + col + '99">';
      if(it.foto) h += '<img class="ord-dao-thumb" src="' + it.foto + '" alt="" onclick="apriModalFoto(this.src)">';
      else        h += '<div class="ord-dao-thumb ord-dao-thumb--empty">📦</div>';
      h += '<div class="ord-dao-info">';
      h += '<div class="ord-dao-nome">' + esc(it.desc||'—') + '</div>';
      if(showFornRow) h += '<div class="ord-dao-forn-alt">Fornitore: ' + esc(it._ordFornitoreNome) + '</div>';
      h += '<div class="ord-dao-meta">';
      if(codM)    h += '<span>Cod.Mag: <b>' + esc(codM) + '</b></span> ';
      if(it.codF) h += '<span>Cod.Forn: <b>' + esc(it.codF) + '</b></span> ';
      h += '<span>Cart: <b>' + esc(entry.cartNome) + '</b></span>';
      h += '</div>';
      if(it.nota) h += '<div class="ord-dao-nota">📝 ' + esc(it.nota) + '</div>';
      h += '</div>';
      h += '<div class="ord-dao-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">';
      h += '<button type="button" onclick="daoRipulisciVoceDaOrdinare(\'' + entry.cartId + '\',' + entry.idx + ')" title="Togli da da ordinare" class="dao-btn-cestino">\uD83D\uDDD1\uFE0F</button>';
      h += '<div class="ord-dao-qty-wrap">';
      h += '<input type="number" class="ord-dao-qty-inp" min="' + minV + '" step="' + step + '" value="' + qVal + '" inputmode="decimal" ';
      h += 'title="Quantità da ordinare" ';
      h += 'oninput="daoSetDaOrdQtyInput(\'' + entry.cartId + '\',' + entry.idx + ',this)" ';
      h += 'onchange="daoSetDaOrdQtyCommit(\'' + entry.cartId + '\',' + entry.idx + ',this)" />';
      h += '<span class="ord-dao-qty-um">' + esc(it.unit||'pz') + '</span></div>';
      h += '<div class="ord-dao-sub">€' + sub + '</div>';
      h += '</div>';
      h += '</div>';
    });

    h += '</div>';
  });

  h += daoHtmlBloccoStoricoRecente();
  wrap.innerHTML = h;
  }catch(e){
    console.error('[OrdFor] render errore:', e);
    var safeByColor = {};
    try{ safeByColor = daoCollectDaOrdinareByColor(); }catch(e2){ safeByColor = {}; }
    var safe = '';
    safe += '<div style="padding:10px 12px;border:1px solid #e53e3e44;border-radius:10px;background:#2a0808;color:#fc8181;font-size:12px;margin-bottom:10px;">';
    safe += 'Errore nel caricamento fornitori. Puoi comunque ricreare i fornitori con il tasto +.</div>';
    try{
      if(typeof ctHtmlBarraFiltriFornitore === 'function'){
        safe += ctHtmlBarraFiltriFornitore(safeByColor, _ordForColorFilter, { fnFilter: 'ordForFilterColor', fnReset: 'ordForResetFiltri', showStoricoBtn: true });
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

// ctSaveFornNome: salva il nome fornitore per un colore (con debounce)
var _ctFornTimer = null;
function ctSaveFornNome(colore, nome){
  clearTimeout(_ctFornTimer);
  _ctFornTimer = setTimeout(function(){
    var map = ctGetForniColore();
    var ck = ctNormalizeHex(colore) || colore;
    if(nome && nome.trim()) map[ck] = nome.trim();
    else delete map[ck];
    ctSaveForniColore(map);
    daoPropagaNomeFornitoreSuArticoli(ck, nome);
    if(typeof saveCarrelli === 'function') saveCarrelli();
    if(typeof saveOrdini === 'function') saveOrdini();
    if(typeof renderCartTabs === 'function') renderCartTabs();
    if(typeof renderOrdFor === 'function') renderOrdFor();
    if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
  }, 400);
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
