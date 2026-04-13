// =============================================================================
//  TAB ORDINI PER COLORE/FORNITORE — #t-ordfor
// =============================================================================

var ORD_FORN_STOR_K = window.AppKeys.ORD_FORN_STORICO;
var ORD_FORN_COLD_K = window.AppKeys.ORD_FORN_STORICO_COLD;
var DAO_STORICO_MAX_GG = 30;

function ctGetForniColore(){
  return lsGet(CT_FORN_KEY, {}) || {};
}
function ctSaveForniColore(map){
  map = map || {};
  lsSet(CT_FORN_KEY, map);
  if(typeof window !== 'undefined') window.forniColore = map;
}

/** Slot colore fissi (filtri e menu carrello) — stesso ordine ovunque. */
var CT_FORN_CANON_HEX = ['#e53e3e', '#38a169', '#3182ce', '#e2c400'];
var CT_FORN_HEX_FALLBACK = {
  '#e53e3e': 'Rosso', '#38a169': 'Verde', '#3182ce': 'Blu', '#e2c400': 'Giallo',
  '#888888': 'Senza colore'
};

/** Nome fornitore salvato per lo slot colore; altrimenti etichetta di default. */
function ctEtichettaFornitore(hex){
  var m = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
  var custom = m && m[hex];
  if(custom && String(custom).trim()) return String(custom).trim();
  return CT_FORN_HEX_FALLBACK[hex] || hex || '';
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
 * cfg: { fnFilter, fnReset } nomi funzione globali per click.
 */
function ctHtmlBarraFiltriFornitore(byColor, activeFilter, cfg){
  cfg = cfg || {};
  var fnFilter = cfg.fnFilter || 'ordForFilterColor';
  var fnReset = cfg.fnReset || 'ordForResetFiltri';
  var allOn = !activeFilter;
  var h = '';
  h += '<div class="ord-forn-filter-row">';
  h += '<button type="button" class="ord-forn-filt-tutti' + (allOn ? ' ord-forn-filt-tutti--on' : '') + '" onclick="' + fnReset + '()">Tutti</button>';
  CT_FORN_CANON_HEX.forEach(function(col){
    var cnt = (byColor && byColor[col]) ? byColor[col].length : 0;
    var nome = ctEtichettaFornitore(col);
    var isOn = activeFilter === col;
    var st = isOn
      ? 'border-color:' + col + ';background:' + col + '22;color:' + col + ';'
      : 'border-color:#333;background:transparent;color:#888;';
    h += '<button type="button" class="ord-forn-filt-slot" style="' + st + '" onclick="' + fnFilter + '(\'' + col + '\')">';
    h += '<span class="ord-forn-filt-dot" style="background:' + col + '"></span>';
    h += '<span class="ord-forn-filt-lbl">' + esc(nome) + '</span>';
    h += '<span class="ord-forn-filt-n">(' + cnt + ')</span>';
    h += '</button>';
  });
  h += '</div>';
  return h;
}

/** Articoli "da ordinare" raggruppati per colore (con cartId + idx per azioni). */
function daoCollectDaOrdinareByColor(){
  var byColor = {};
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it, idx){
      if(!it.daOrdinare) return;
      if(!it._ordColore || it._ordColore === '#888888') return;
      var col = it._ordColore;
      if(!byColor[col]) byColor[col] = [];
      byColor[col].push({ it: it, cartNome: cart.nome||'', cartId: cart.id, idx: idx });
    });
  });
  return byColor;
}

function daoPropagaNomeFornitoreSuArticoli(colore, nome){
  var n = (nome && String(nome).trim()) ? String(nome).trim() : '';
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      if(it._ordColore === colore && it.daOrdinare){
        if(n) it._ordFornitoreNome = n;
        else delete it._ordFornitoreNome;
      }
    });
  });
  if(typeof ordini !== 'undefined' && ordini){
    ordini.forEach(function(ord){
      (ord.items||[]).forEach(function(it){
        if(it._ordColore === colore && it.daOrdinare){
          if(n) it._ordFornitoreNome = n;
          else delete it._ordFornitoreNome;
        }
      });
    });
  }
}

/** Toglie marcatore "da ordinare" (speculare carrello ↔ ordine collegato). */
function daoRipulisciVoceDaOrdinare(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];
  it.daOrdinare = false;
  delete it._ordColore;
  delete it._ordFornitoreNome;
  if(typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(cart);
  if(typeof saveCarrelli === 'function') saveCarrelli();
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
}

function daoGetStoricoRecent(){
  return lsGet(ORD_FORN_STOR_K, []) || [];
}

function daoPruneStoricoToCold(arr){
  var cutoff = Date.now() - DAO_STORICO_MAX_GG * 24 * 60 * 60 * 1000;
  var keep = [];
  var old = [];
  (arr||[]).forEach(function(entry){
    var t = entry.archivedAt ? new Date(entry.archivedAt).getTime() : 0;
    if(t && t < cutoff) old.push(entry);
    else keep.push(entry);
  });
  if(old.length){
    var coldArr = [];
    try{
      var raw = localStorage.getItem(ORD_FORN_COLD_K);
      coldArr = raw ? JSON.parse(raw) : [];
    }catch(e){ coldArr = []; }
    if(!Array.isArray(coldArr)) coldArr = [];
    coldArr = coldArr.concat(old);
    try{ localStorage.setItem(ORD_FORN_COLD_K, JSON.stringify(coldArr)); }catch(e){}
  }
  return keep;
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
  var affected = {};
  entries.forEach(function(e){
    var cart = carrelli.find(function(c){ return c.id === e.cartId; });
    if(!cart || !cart.items[e.idx]) return;
    var it = cart.items[e.idx];
    it.daOrdinare = false;
    delete it._ordColore;
    delete it._ordFornitoreNome;
    affected[e.cartId] = cart;
  });
  Object.keys(affected).forEach(function(cid){
    var c = affected[cid];
    if(c && typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(c);
  });
  var recent = daoGetStoricoRecent();
  recent.unshift(batch);
  if(recent.length > 200) recent.length = 200;
  recent = daoPruneStoricoToCold(recent);
  lsSet(ORD_FORN_STOR_K, recent);
  if(typeof window !== 'undefined') window.ordFornStorico = recent;
  if(typeof saveCarrelli === 'function') saveCarrelli();
  if(typeof saveOrdini === 'function') saveOrdini();
  if(typeof renderCartTabs === 'function') renderCartTabs();
  if(typeof renderOrdFor === 'function') renderOrdFor();
  if(typeof renderDaOrdinareView === 'function') renderDaOrdinareView();
  if(typeof showToastGen === 'function') showToastGen('green', 'Gruppo archiviato come ordinato');
}

/** Archivio freddo: non letto all'avvio; solo su richiesta. */
function daoLoadStoricoCold(){
  try{
    var raw = localStorage.getItem(ORD_FORN_COLD_K);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

function daoApriArchivioColdUI(){
  var cold = daoLoadStoricoCold();
  if(!cold.length){
    if(typeof showToastGen === 'function') showToastGen('yellow', 'Archivio oltre 30 giorni vuoto');
    return;
  }
  var lines = cold.slice(-120).map(function(b){
    var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
    return d + ' — ' + (b.nomeFornitore||'') + ' — ' + (b.items||[]).length + ' art.';
  });
  var txt = lines.join('\n');
  if(txt.length > 4500) txt = txt.slice(0, 4500) + '\n…';
  alert(txt);
}

function daoHtmlBloccoStoricoRecente(){
  var recent = daoGetStoricoRecent().slice(0, 12);
  if(!recent.length) return '';
  var h = '<div style="margin:14px 0;padding:10px 12px;background:#1a1a1c;border:1px solid #333;border-radius:10px;">';
  h += '<div style="font-size:11px;font-weight:900;color:#888;margin-bottom:8px;letter-spacing:.5px;">GIÀ ORDINATI (recenti)</div>';
  recent.forEach(function(b){
    var d = b.archivedAt ? b.archivedAt.slice(0,10) : '';
    h += '<div style="font-size:11px;color:#68d391;padding:4px 0;border-bottom:1px solid #252528;">';
    h += esc(d) + ' — ' + esc(b.nomeFornitore||b.colore||'') + ' — ' + (b.items||[]).length + ' art.';
    h += '</div>';
  });
  h += '<button type="button" onclick="daoApriArchivioColdUI()" style="margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid #444;background:transparent;color:#aaa;font-size:10px;cursor:pointer;">Archivio completo (&gt;30 gg, solo locale)</button>';
  h += '</div>';
  return h;
}

// renderOrdFor: renderizza la tab Ordini Fornitore raggruppati per colore
var _ordForColorFilter=null;
function ordForFilterColor(col){
  _ordForColorFilter=(_ordForColorFilter===col)?null:col;
  renderOrdFor();
}
function ordForResetFiltri(){
  _ordForColorFilter=null;
  renderOrdFor();
}

function renderOrdFor(){
  var wrap = document.getElementById('t-ordfor-body');
  if(!wrap) return;

  var byColor = daoCollectDaOrdinareByColor();
  var forniMap = ctGetForniColore();
  var h = '';

  h += ctHtmlBarraFiltriFornitore(byColor, _ordForColorFilter, { fnFilter: 'ordForFilterColor', fnReset: 'ordForResetFiltri' });

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
    h += '<button type="button" onclick="daoArchiviaColoreGruppo(\'' + col + '\')" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #38a16944;background:#38a16922;color:#68d391;font-size:10px;font-weight:800;cursor:pointer;">Archivia ordinato</button>';
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
      h += '<div class="ord-dao-row">';
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
      h += '<div class="ord-dao-qty">' + (parseFloat(it.qty)||0) + ' ' + (it.unit||'pz') + '</div>';
      h += '<div class="ord-dao-sub">€' + sub + '</div>';
      h += '</div>';
      h += '</div>';
    });

    h += '</div>';
  });

  h += daoHtmlBloccoStoricoRecente();
  wrap.innerHTML = h;
}

// ctSaveFornNome: salva il nome fornitore per un colore (con debounce)
var _ctFornTimer = null;
function ctSaveFornNome(colore, nome){
  clearTimeout(_ctFornTimer);
  _ctFornTimer = setTimeout(function(){
    var map = ctGetForniColore();
    if(nome && nome.trim()) map[colore] = nome.trim();
    else delete map[colore];
    ctSaveForniColore(map);
    daoPropagaNomeFornitoreSuArticoli(colore, nome);
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
