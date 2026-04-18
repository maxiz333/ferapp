// carrello.render-tabs.js — renderCartTabs

// Confronto articoli: indici righe catalogo (rows[]) — NON sono righe carrello; totali carrello invariati.
if(typeof window.tcCompareSlots === 'undefined') window.tcCompareSlots = [];
if(typeof window.tcCompareAreaOpen === 'undefined') window.tcCompareAreaOpen = false;
if(typeof window.tcCompareHighlightDiff === 'undefined') window.tcCompareHighlightDiff = false;

// --- RENDER CARRELLO ---------------------------------------

/** Ordine/bozza collegato al carrello (per indicatore visto ufficio). */
function _ctLinkedOrdForVisto(cart){
  if(!cart || typeof ordini === 'undefined' || !ordini) return null;
  if(cart.bozzaOrdId){
    var b = ordini.find(function(o){ return o && o.id === cart.bozzaOrdId; });
    if(b) return b;
  }
  if(cart.stato === 'modifica' && cart.ordId){
    return ordini.find(function(o){ return o && o.id === cart.ordId; }) || null;
  }
  if(cart.stato === 'inviato' && cart.ordId){
    return ordini.find(function(o){ return o && o.id === cart.ordId; }) || null;
  }
  return null;
}

function _ctHtmlOrdineVistoBadge(cart){
  var o = _ctLinkedOrdForVisto(cart);
  if(!o || (typeof ordVistoMostraIcona === 'function' ? !ordVistoMostraIcona(o) : !o.visto)) return '';
  return '<span class="ord-visto-ico" title="Visto in ufficio">\uD83D\uDC41\uFE0F</span>';
}

// =============================================================================
//  renderCartTabs — RISCRITTURA DEFINITIVA v3
//  Layout testata: 3 righe fisse centrate max 600px
//  Riga 1: [📦 ORDINI — centrato]
//  Riga 2: [👥 CLIENTI▾]  [＋ NUOVO]
//  Riga 3: pillole nomi clienti (scroll laterale, mai trabocca)
//  Card: nome a capo | codici 14px | prezzo blu/verde | qty interi
// =============================================================================

function renderCartTabs(){
  var body = document.getElementById('cart-body');
  if(!body) return;

  // ── TESTATA: riga unica nel wrapper (struttura già in HTML) ────────────
  var wrap = document.getElementById('ct-header-wrap');
  var row1 = document.getElementById('ct-row-ordini');

  // Rimuovi vecchia riga 2 se esiste (legacy)
  var oldRow2 = document.getElementById('ct-row-azioni');
  if(oldRow2) oldRow2.remove();

  // Riga unica: NUOVO + CLIENTI + ORDINI (in ordine di importanza)
  var _oggiC = new Date().toISOString().slice(0,10);
  var nCl = carrelli.filter(function(c){
    var d = c.creatoAtISO ? c.creatoAtISO.slice(0,10) : '';
    return d === _oggiC || c.stato === 'inviato' || c.stato === 'modifica';
  }).length;
  row1.innerHTML =
    '<button class="ct-pill--new" onclick="newCart()">＋ NUOVO</button>' +
    '<button id="ct-btn-clienti" onclick="ctApriClienti()" title="Scegli cliente">' +
      '👥 CLIENTI' + (nCl ? ' <span class="ct-pill-n">' + nCl + '</span>' : '') +
    '</button>' +
    '<button id="ct-btn-ordfor" onclick="goTab(\'t-ordfor\');renderOrdFor()" title="Ordini per fornitore">📦 ORDINI</button>';

  // ── DROPDOWN CLIENTI (creato una sola volta nel body) ─────────────────────
  if(!document.getElementById('ct-clienti-dropdown')){
    var dd = document.createElement('div');
    dd.id  = 'ct-clienti-dropdown';
    dd.innerHTML =
      '<div id="ct-clienti-backdrop" onclick="ctChiudiClienti()"></div>' +
      '<div id="ct-clienti-panel">' +
        '<h3>👥 Clienti</h3>' +
        '<div id="ct-clienti-list"></div>' +
        '<button class="ct-clienti-close" onclick="ctChiudiClienti()">✕ Chiudi</button>' +
      '</div>';
    document.body.appendChild(dd);
  }

  // ── CORPO VUOTO ───────────────────────────────────────────────────────────
  if(!activeCartId || !carrelli.length){
    body.innerHTML =
      '<div class="ct-empty">' +
        '<div class="ct-empty-icon">🛒</div>' +
        '<p>Premi <b style="color:#FFD700">＋ NUOVO</b> per iniziare</p>' +
      '</div>';
    return;
  }
  var cart = carrelli.find(function(c){ return c.id === activeCartId; });
  if(!cart) return;
  if(typeof ensureFatturaState === 'function') ensureFatturaState(cart);

  var h = '';

  // ── CARRELLO DI UN ALTRO ACCOUNT — overlay blocco ──────────────────────────
  var _cartMio = _cartPossoModificare(cart);
  if(!_cartMio){
    var _nomeComm = (typeof _roles !== 'undefined' && _roles[cart.commesso])
      ? _roles[cart.commesso].nome : (cart.commesso || 'altro account');
    h += '<div style="position:relative;background:#111;border-radius:14px;border:2px solid #2a2a2a;min-height:160px;display:flex;align-items:center;justify-content:center;">';
    h += '<div class="ord-lock-overlay" style="position:relative;border-radius:12px;padding:32px 20px;" onclick="cartForzaAccesso(' + "'" + cart.id + "'" + ')">';
    h += '<div class="ord-lock-msg">';
    h += '<div style="font-size:30px;margin-bottom:8px">🔐</div>';
    h += '<div style="font-size:15px;font-weight:900">CARRELLO DI ' + esc(_nomeComm).toUpperCase() + '</div>';
    h += '<div style="font-size:11px;margin-top:6px;color:#aaa">' + (cart.items||[]).length + ' articoli — solo lettura</div>';
    h += '<div style="font-size:10px;margin-top:10px;color:#666">Triplo tap per forzare accesso</div>';
    h += '</div></div></div>';
    body.innerHTML = h;
    return;
  }

  // ── STATO INVIATO (read-only) ─────────────────────────────────────────────
  if(cart.stato === 'inviato' && cart.locked){
    var totInv = (cart.items||[]).reduce(function(s,it){
      return s + _prezzoEffettivo(it) * parseFloat(it.qty||0);
    }, 0);
    h += '<div class="ct-inviato-box">';
    h += '<div class="ct-inviato-top">';
    h += '<span style="font-size:22px">✅</span>';
    h += '<div style="flex:1"><div class="ct-inviato-label">Ordine inviato alla cassa' + _ctHtmlOrdineVistoBadge(cart) + '</div>';
    h += '<div class="ct-inviato-nome" onclick="ctEditClienteName(\''+cart.id+'\')" style="cursor:pointer;" title="Tap per modificare">' + esc(cart.nome) + '</div></div>';
    h += '<div class="ct-price-big">€ ' + totInv.toFixed(2) + '</div>';
    h += '</div>';
    var _invItems = (cart.items||[]).slice().reverse();
    _invItems.forEach(function(it){
      var sub = (parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0)).toFixed(2);
      h += '<div class="ct-inviato-row">';
      h += '<div style="flex:1;min-width:0;font-size:12px;color:#ccc">' + esc(it.desc||'');
      if(it.codM) h += ' <span style="color:#FFD700;font-size:10px">' + esc(it.codM) + '</span>';
      if(it.nota) h += '<div style="font-size:10px;color:#f6ad55;font-style:italic">📝 '+esc(it.nota)+'</div>';
      h += '</div><div class="ct-price-sm">€'+sub+'</div></div>';
    });
    h += '<div style="display:flex;gap:8px;margin-top:14px">';
    h += '<button onclick="cartUnlock(\'' + cart.id + '\')" class="ct-btn-yellow" style="flex:1">✏️ Sblocca e modifica</button>';
    h += '<button onclick="goTab(\'to\')" class="ct-btn-solid" style="padding:10px 16px">📋 Ordini</button>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;height:38px;">';
    h += '<button onclick="deleteCart(\'' + cart.id + '\')" title="Elimina carrello" aria-label="Elimina carrello" ';
    h += 'style="height:38px;min-width:44px;padding:0 12px;border-radius:10px;border:1px solid #2a2a2a;background:transparent;color:#666;cursor:pointer;font-size:18px;line-height:1;">🗑️</button>';
    if(cart.fatturaRichiesta){
      h += '<button onclick="ctPreviewStampaFattura(\'' + cart.id + '\')" title="Anteprima stampa fattura" ';
      h += 'style="height:38px;padding:0 14px;border-radius:10px;border:none;background:var(--accent);color:#111;font-size:12px;font-weight:900;cursor:pointer;">🖨️ Stampa Fattura</button>';
    } else {
      h += '<button onclick="ctPreviewStampaProforma(\'' + cart.id + '\')" title="Anteprima stampa scontrino/proforma" ';
      h += 'style="height:38px;padding:0 14px;border-radius:10px;border:1px solid #2f2f2f;background:#1b1b1b;color:#ddd;font-size:12px;font-weight:800;cursor:pointer;">🧾 Stampa Proforma</button>';
    }
    h += '</div></div>';
    h += '<div class="ct-inviato-esauriti-banner" role="note">C\'è qualche articolo esaurito?</div>';
    body.innerHTML = h;
    return;
  }

  // ── BANNER MODIFICA — striscia sottile ─────────────────────────────────
  if(cart.stato === 'modifica'){
    h += '<div class="ct-banner-mod">';
    h += '<span style="font-size:13px">✏️</span>';
    h += '<span class="ct-banner-mod-title" onclick="ctEditClienteName(\''+cart.id+'\')" style="cursor:pointer;" title="Tap per modificare">' + esc(cart.nome) + ' — MODIFICA' + _ctHtmlOrdineVistoBadge(cart) + '</span>';
    h += '</div>';
  }

  // ── BARRA CERCA — compatta ──────────────────────────────────────────────
  h += '<div id="cart-action-btns">';
  h += '<button class="ct-btn-cerca" onclick="openCodeNumpad()">';
  h += '🔍 CERCA PER CODICE</button></div>';
  h += '<div id="cart-search-wrap">';
  h += '<input type="text" id="cart-search" placeholder="🔎 Cerca per nome, specifiche..." ';
  h += 'style="width:100%;padding:10px 14px;border:1px solid #2e3033;border-radius:10px;font-size:13px;background:#1e1e1e;color:#f0f0f0;box-sizing:border-box" ';
  h += 'oninput="renderCartSearch()" autocomplete="off">';
  h += '</div>';
  h += '<div id="cart-search-results" style="padding:0 8px"></div>';

  // ── LISTA VUOTA ───────────────────────────────────────────────────────────
  if(!(cart.items||[]).length){
    h += '<div class="ct-empty" style="padding:30px 20px">';
    h += '<div class="ct-empty-icon">📦</div>';
    h += '<p>Cerca un articolo o premi <b style="color:#FFD700">CERCA PER CODICE</b></p>';
    h += '</div>';
  } else {

    // ── BARRA STICKY: cliente + sconto globale (niente totale € qui) ─────────
    var scontoGl = cart.scontoGlobale;
    h += '<div class="ct-sticky-total">';
    h += '<span class="ct-sticky-client" onclick="ctEditClienteName(\'' + cart.id + '\')" title="Tap per modificare il cliente">' +
         esc(cart.nome || 'Cliente') + _ctHtmlOrdineVistoBadge(cart) + '</span>';
    h += '<div class="ct-sticky-right">';
    if(scontoGl) h += '<span class="ct-sconto-badge">-'+scontoGl+'%</span>';
    h += '<span class="ct-sticky-n">' + (cart.items||[]).length + ' art.</span>';
    h += '<button onclick="openScontoOverlay()" class="ct-btn-sconto">% Sconto</button>';
    h += '</div></div>';

    // ── GRIGLIA ARTICOLI — stessa struttura tab ordini ─────────────
    h += '<div class="ord-items-wrap">';
    h += '<div class="ord-grid ord-grid-head">';
    h += '<div class="ord-gh">Prodotto</div>';
    h += '<div class="ord-gh ord-gh-c">Qtà</div>';
    h += '<div class="ord-gh ord-gh-c">Prezzo</div>';
    h += '<div class="ord-gh ord-gh-c">Tot</div>';
    h += '</div>';
    h += '</div>';

    // ── CARD ARTICOLI (ultimo aggiunto in cima; idx = indice reale in cart.items) ──
    var _items = cart.items || [];
    for(var _ri = _items.length - 1; _ri >= 0; _ri--){
      var idx = _ri;
      var it = _items[idx];
      var displayPos = _items.length - 1 - idx;
      var pListino     = listinoPrezzoNum(it);
      var pVendita     = ordItemLineUnitSelling(it);
      var q            = parseFloat(it.qty) || 0;
      var isSc         = it.scampolo    || false;
      var isFR         = it.fineRotolo  || false;
      var isDaOrd      = it.daOrdinare  || false;
      var scagAp       = it._scaglioniAperti || false;
      var scagAtt      = it._scaglioneAttivo || null;
      var hasNota      = !!(it.nota && it.nota.trim());
      var promoG       = (typeof isPromoGItem === 'function') ? isPromoGItem(it) : false;
      var scOn         = isSc || isFR;
      var isTuttoRotolo = it._tuttoRotolo || false;
      var isStorno     = !!it._stornoReso;

      // Prezzo scontato calcolato al volo
      var scAttivo     = it._scontoApplicato || 0;
      var scApplica = false;
      if(it._scaglionato && scAttivo > 0){
        // Scaglionato: sconto solo se qty >= soglia
        scApplica = q >= (it._scaglioneQta || 10);
      } else if(scOn && scAttivo > 0){
        scApplica = true;
      }
      var sub          = (pVendita * q).toFixed(2);
      var hasScontoRow = !isStorno && pListino > pVendita + 0.005;

      // Cod. Magazzino — 7 cifre se numerico
      var codM7 = it.codM
        ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM)
        : '';
      var codF = it.codF || '';

      // Bordo card
      var cardStyle = '';
      if(isStorno)         cardStyle = 'border-color:#c05621;box-shadow:0 0 0 2px rgba(221,107,32,.5);background:rgba(154,52,18,.12)';
      else if(isTuttoRotolo)    cardStyle = 'border-color:#e53e3e;box-shadow:0 0 0 2px #e53e3e55';
      else if(it._ordColore) cardStyle = 'border-color:' + it._ordColore + ';box-shadow:0 0 0 1px ' + it._ordColore + '44';

      var cardClass = 'ct-card' +
        (it._checked ? ' ct-card--checked' : '') +
        (cart.stato === 'modifica' ? ' ct-card--mod' : '');

      h += '<div class="' + cardClass + '" id="cart-row-' + idx + '"' +
           (cardStyle ? ' style="' + cardStyle + '"' : '') + '>';

      // ── RIGA GRIGLIA: stessa struttura ord-grid 50%|15%|15%|20% ──────
      h += '<div class="ord-grid ord-grid-row' + (displayPos%2===0 ? ' ord-grid-even' : ' ord-grid-odd') + '">';

      var units = (typeof UM_STANDARD !== 'undefined' && UM_STANDARD && UM_STANDARD.length) ? UM_STANDARD : ['pz','kg','MQ','mt','conf'];
      var curUnit = (typeof normalizeUmValue === 'function') ? normalizeUmValue(it.unit || 'pz') : (it.unit || 'pz');

      // Colonna prodotto: nome + codici
      h += '<div class="ord-gc-desc">';
      h += '<div class="ord-item-name">' + esc(it.desc || '—') + '</div>';
      if(isStorno){
        h += '<div style="font-size:9px;font-weight:800;color:#fc8181;margin:4px 0 2px;letter-spacing:.25px;">STORNO RESO</div>';
      }
      var codes = '';
      codes += '<div class="ord-item-codes-line">';
      if(codM7) codes += '<span class="ord-code-mag">' + esc(codM7) + '</span>';
      if(!isStorno){
        codes += '<span class="ord-code-forn ord-code-forn--inp"><span class="ord-code-forn-lbl">f.</span>';
        codes += '<input class="ct-codf-inp" value="' + esc(codF) + '" placeholder="—" ' +
                 'oninput="ctSetCodF(\'' + cart.id + '\',' + idx + ',this.value)" ' +
                 'onclick="event.stopPropagation();this.select()" ' +
                 'onkeydown="if(event.key===\'Enter\')this.blur()">';
        codes += '</span>';
      } else {
        codes += '<span class="ord-code-forn"><span class="ord-code-forn-lbl">f.</span> ' + esc(codF || '—') + '</span>';
      }
      codes += '</div>';
      h += '<div class="ord-item-codes">' + codes + '</div>';
      h += '</div>';

      if(isStorno){
        h += '<div class="ord-gc-qty ct-grid-qty" style="align-self:center">';
        h += '<span style="font-size:15px;font-weight:800;color:#e2e8f0">' + esc((typeof itemFormatQtyDisplay === 'function') ? itemFormatQtyDisplay(q, it.unit) : String(q)) + '</span>';
        h += '<span style="font-size:11px;color:#a0aec0;margin-left:6px">' + esc(curUnit) + '</span>';
        h += '</div>';
        h += '<div class="ord-gc-price" id="prz-' + idx + '">';
        h += '<span style="color:#fc8181;font-weight:800;font-size:14px">€' + esc(it.prezzoUnit || '') + '</span>';
        h += '</div>';
        h += '<div class="ord-gc-sub" id="cart-sub-' + idx + '">';
        h += '<div class="ord-gc-sub-val" style="color:#f56565;font-weight:800">€' + sub + '</div>';
        h += '</div>';
      } else {

      // Colonna quantità — stepper interattivo
      h += '<div class="ord-gc-qty ct-grid-qty">';
      h += '<div class="ct-qty ct-qty--compact">';
      h += '<button class="ct-qty-btn" onclick="cartDelta(\'' + cart.id + '\',' + idx + ',-1)">−</button>';
      h += '<button type="button" class="ct-qty-val" id="cart-qty-val-' + idx + '" onclick="openQtyNumpad(\'' + cart.id + '\',' + idx + ')">' + esc((typeof itemFormatQtyDisplay === 'function') ? itemFormatQtyDisplay(q, it.unit) : String(q)) + '</button>';
      h += '<button class="ct-qty-btn" onclick="cartDelta(\'' + cart.id + '\',' + idx + ',1)">＋</button>';
      h += '</div>';
      h += '<select class="ct-um-select ct-um--mini" onchange="cartSetUnit(\'' + cart.id + '\',' + idx + ',this.value)">';
      units.forEach(function(u){
        h += '<option value="' + u + '"' + (u === curUnit ? ' selected' : '') + '>' + u + '</option>';
      });
      h += '</select>';
      if(typeof itemIsMqUm === 'function' && itemIsMqUm(curUnit)){
        var hSup = it.h_superficie != null ? String(it.h_superficie) : '';
        var lSup = it.l_superficie != null ? String(it.l_superficie) : '';
        h += '<div class="ct-mq-hl" onclick="event.stopPropagation()">';
        h += '<span class="ct-mq-hl-lbl" title="Altezza (m)">H</span>';
        h += '<input type="text" class="ct-mq-inp" inputmode="decimal" autocomplete="off" ';
        h += 'value="' + esc(hSup) + '" placeholder="—" title="Altezza m" ';
        h += 'oninput="cartSetMqSuperficie(\'' + cart.id + '\',' + idx + ',\'h\',this.value)" ';
        h += 'onclick="event.stopPropagation();this.select()" />';
        h += '<span class="ct-mq-x">×</span>';
        h += '<span class="ct-mq-hl-lbl" title="Larghezza (m)">L</span>';
        h += '<input type="text" class="ct-mq-inp" inputmode="decimal" autocomplete="off" ';
        h += 'value="' + esc(lSup) + '" placeholder="—" title="Larghezza m" ';
        h += 'oninput="cartSetMqSuperficie(\'' + cart.id + '\',' + idx + ',\'l\',this.value)" ';
        h += 'onclick="event.stopPropagation();this.select()" />';
        h += '</div>';
      }
      if(itemUsesPrezzoPerBaseUm(it.unit)){
        var bd = itemBaseUmScontoDisplay(it);
        var suffPB = itemPrezzoBaseUmSuffix(it.unit);
        var qhPB = itemUmQtyHint(it.unit);
        h += '<div class="ct-pb-inline" id="cart-pb-' + idx + '">';
        h += '<span class="ct-pb-tag" title="Prezzo per ' + esc(suffPB) + ', quantità in ' + esc(qhPB) + '">Prezzo Base</span>';
        h += '<input type="text" class="ct-pb-inp" inputmode="decimal" ';
        h += 'value="' + esc(it._prezzoUnitaBase || '') + '" placeholder="—" ';
        h += 'title="Prezzo listino ' + esc(suffPB) + ' · qtà ' + esc(qhPB) + '" ';
        h += 'oninput="cartInputPrezzoUnitaBase(\'' + cart.id + '\',' + idx + ',this)" ';
        h += 'onclick="event.stopPropagation();this.select()" />';
        h += '<span class="ct-pb-disc" id="cart-pb-disc-' + idx + '">';
        if(bd && bd.hasSc){
          h += '<span class="ct-pb-struck">€' + formatPrezzoUnitDisplay(bd.b0) + '</span>';
          h += '<span class="ct-pb-final">€' + formatPrezzoUnitDisplay(bd.b1) + '</span>';
          h += '<span class="ct-pb-sav">-€' + formatPrezzoUnitDisplay(bd.savPerBase) + '</span>';
        }
        h += '</span></div>';
      }
      h += '</div>';

      // Colonna prezzo — listino/sconto convertito + input €/UM riga
      var hasSconto = hasScontoRow;
      h += '<div class="ord-gc-price" id="prz-' + idx + '">';
      h += '<div id="cart-prz-strip-' + idx + '"' + (hasSconto ? '' : ' style="display:none"') + '">';
      if(hasSconto){
        h += htmlPrezzoUnitScontoRiga(pListino, pVendita);
      }
      h += '</div>';
      h += '<input class="ct-punit" type="text" inputmode="decimal" autocomplete="off" ' +
           'enterkeyhint="done" value="' +
           esc(it.prezzoUnit||'0') + '" ' +
           'title="Tocca per modificare €/unità" ' +
           'onchange="cartSetPrezzo(\'' + cart.id + '\',' + idx + ',this.value)" ' +
           'onblur="cartSetPrezzo(\'' + cart.id + '\',' + idx + ',this.value)" ' +
           'onclick="this.select()" />';
      if(promoG && typeof htmlPromoGBadge === 'function'){
        h += '<div class="ct-price-promo-wrap">' + htmlPromoGBadge() + '</div>';
      }
      h += '</div>';

      // Colonna totale
      h += '<div class="ord-gc-sub" id="cart-sub-' + idx + '">';
      if(hasSconto){
        h += htmlTotaleScontoRiga(pListino * q, parseFloat(sub));
      } else {
        var subColor = isTuttoRotolo ? '#fc8181' : (isFR ? '#f6ad55' : 'var(--accent)');
        h += '<div class="ord-gc-sub-val" style="color:' + subColor + '">€' + sub + '</div>';
      }
      h += '</div>';

      } // fine !isStorno

      h += '</div>'; // fine ord-grid row

      // ── ICONBAR: Forbici+% | Note | Ordina | Cestino | Reso (modifica) ───────────
      h += '<div class="ct-iconbar">';

      if(isStorno){
        h += '<button class="ct-icon-btn ct-icon-btn--del" ' +
             'onclick="cartRemoveItem(\'' + cart.id + '\',' + idx + ')" title="Rimuovi storno">';
        h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
             '<polyline points="3 6 5 6 21 6"/>' +
             '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>' +
             '<path d="M9 6V4h6v2"/></svg></button>';
        h += '</div>';
      } else {

      // FORBICI (tap=scampolo, doppio tap=rotolo) + input % inline
      var isScag = it._scaglionato || false;
      var forbLbl = isScag ? 'SCAGLIONATO' : (isTuttoRotolo ? 'ROTOLO' : (scOn ? (isFR ? 'ROTOLO' : 'SCAMPOLO') : ''));
      var forbActive = scOn || isTuttoRotolo || isScag;
      h += '<div class="ct-forbici-row">';
      h += '<button class="ct-icon-btn' +
           (forbActive ? ' ct-icon-btn--on' : '') +
           (isTuttoRotolo ? ' ct-icon-btn--rotolo' : '') +
           (isScag ? ' ct-icon-btn--scag' : '') + '" ' +
           'onclick="ctForbiciTap(\'' + cart.id + '\',' + idx + ')" ' +
           'title="Tap: cicla Scampolo/Rotolo/Scaglionato">';
      h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
           '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>' +
           '<line x1="20" y1="4" x2="8.12" y2="15.88"/>' +
           '<line x1="14.47" y1="14.48" x2="20" y2="20"/>' +
           '<line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';
      h += (forbLbl ? '<span>' + forbLbl + '</span>' : '<span>FORBICI</span>') + '</button>';
      // Input % sempre visibile accanto
      var scAtt = it._scontoApplicato || 0;
      h += '<div class="ct-sc-inline">';
      h += '<input type="number" min="0" max="100" value="' + (scAtt || '') + '" placeholder="%" class="ct-sc-inp"' +
           (isScag ? ' style="color:#63b3ed;border-color:#63b3ed44;"' : '') +
           ' onchange="cartSetScontoScampolo(\'' + cart.id + '\',' + idx + ',this.value)" ' +
           'onclick="event.stopPropagation();this.select()">';
      h += '<span class="ct-sc-pct"' + (isScag ? ' style="color:#63b3ed"' : '') + '>%</span>';
      if(isScag){
        h += '<span style="font-size:9px;color:#63b3ed;">da</span>';
        h += '<input type="number" min="1" value="' + (it._scaglioneQta || 10) + '" class="ct-sc-inp" style="width:36px;color:#63b3ed;border-color:#63b3ed44;" ' +
             'onchange="cartSetScaglioneQta(\'' + cart.id + '\',' + idx + ',this.value)" ' +
             'onclick="event.stopPropagation();this.select()">';
        h += '<span style="font-size:9px;color:#63b3ed;">pz</span>';
      }
      if(scAtt > 0 && scApplica){
        var risparmio = ((Math.max(0, pListino - pVendita)) * q).toFixed(2);
        h += '<span class="ct-sc-risp"' + (isScag ? ' style="color:#63b3ed"' : '') + '>-€' + risparmio + '</span>';
      }
      h += '</div>';
      h += '</div>';

      // NOTE
      h += '<button class="ct-icon-btn' + (hasNota ? ' ct-icon-btn--on' : '') + '" ' +
           'onclick="ctTogglePanel(\'' + cart.id + '\',' + idx + ',\'nota\')" title="Nota">';
      h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
           '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
           '<polyline points="14 2 14 8 20 8"/>' +
           '<line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' +
           '<polyline points="10 9 9 9 8 9"/></svg></button>';

      // ORDINA
      var ordStyle = it._ordColore
        ? 'background:' + it._ordColore + '33;border-color:' + it._ordColore + ';color:' + it._ordColore
        : '';
      h += '<button class="ct-icon-btn ct-icon-btn--ordina' + (isDaOrd ? ' ct-icon-btn--on' : '') + '" ' +
           'style="' + ordStyle + '" ' +
           'onclick="ctApriColori(\'' + cart.id + '\',' + idx + ')" title="Colore ordine fornitore">';
      h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
           '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
           '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
           '<span>ORDINA</span></button>';

      // CESTINO
      h += '<button class="ct-icon-btn ct-icon-btn--del" ' +
           'onclick="cartRemoveItem(\'' + cart.id + '\',' + idx + ')" title="Elimina">';
      h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
           '<polyline points="3 6 5 6 21 6"/>' +
           '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>' +
           '<path d="M9 6V4h6v2"/></svg></button>';

      if(cart.stato === 'modifica'){
        h += '<button type="button" class="ord-abtn ord-abtn--del" style="min-width:36px;height:34px;padding:0 10px;font-weight:900;font-size:16px;color:#e53e3e;border-radius:8px;line-height:1;" ';
        h += 'onclick="event.stopPropagation();cartApplicaReso(\'' + cart.id + '\',' + idx + ')" title="Reso merce (storno)">R</button>';
      }

      h += '</div>'; // fine ct-iconbar (non storno)
      }

      // ── PANNELLI A COMPARSA ───────────────────────────────────────────────
      var pNoId = 'ctp-no-' + idx;
      var _pKey = cart.id + '-' + idx;

      // Pannello NOTE
      var notaPanelOpen = _ctPanelState[_pKey] === 'nota';
      h += '<div id="' + pNoId + '" class="ct-panel" style="display:' + (notaPanelOpen ? 'block' : 'none') + '">';
      h += '<textarea class="ct-nota-inp" placeholder="Nota articolo..." ' +
           'oninput="cartSetNota(\'' + cart.id + '\',' + idx + ',this.value)" ' +
           'onblur="cartNotaFieldBlurFlush()">' +
           esc(it.nota||'') + '</textarea>';
      h += '</div>';

      // Preview nota (se presente)
      if(hasNota){
        h += '<div class="ct-nota-prev">📝 ' + esc(it.nota) + '</div>';
      }

      // Badge stati attivi
      var badges = '';
      if(isTuttoRotolo) badges += '<span class="ct-badge ct-badge--red">ROTOLO INTERO</span> ';
      if(scagAtt) badges += '<span class="ct-badge ct-badge--blue">📊 -'+(scagAtt.sconto||0)+'% da '+scagAtt.qtaMin+'pz</span> ';
      if(isDaOrd){
        var bc = it._ordColore || '#e53e3e';
        badges += '<span class="ct-badge" style="background:'+bc+'22;color:'+bc+';border:1px solid '+bc+'44">🛒 ORDINA</span> ';
      }
      if(badges) h += '<div class="ct-badges">' + badges + '</div>';

      h += '</div>'; // fine ct-card
    } // fine loop items (ordine inverso)

  } // fine items.length > 0

  // ── NOTA ORDINE ───────────────────────────────────────────────────────────
  h += '<div id="cart-order-nota-row">';
  h += '<textarea class="pos-nota-ordine" rows="2" placeholder="📋 Nota ordine..." ' +
       'oninput="cartSetNotaOrdine(\'' + cart.id + '\',this.value)" ' +
       'onblur="cartNotaFieldBlurFlush()">' + esc(cart.nota||'') + '</textarea>';
  h += '</div>';

  h += tcHtmlCompareShell();

  // ── STICKY FOOTER ─────────────────────────────────────────────────────────
  var tot2    = (cart.items||[]).reduce(function(s,it){ return s + _prezzoEffettivo(it) * parseFloat(it.qty||0); }, 0);
  var tot2Fin = cart.scontoGlobale ? tot2*(1-cart.scontoGlobale/100) : tot2;
  h += '<div id="cart-pos-footer">';
  h += '<div class="ct-footer">';
  h += '<div class="ct-footer-tot"><span class="ct-footer-sym">€</span>' + tot2Fin.toFixed(2) + '</div>';
  h += '<div class="ct-footer-btns">';
  h += '<button class="ct-fbtn ct-fbtn--danger" onclick="eliminaOrdineCarrello(\'' + cart.id + '\')">🗑️<span>Elimina ordine</span></button>';
  h += '<button class="ct-fbtn ct-fbtn--fattura' + (cart.fatturaRichiesta ? ' ct-fbtn--fattura-on' : '') + '" onclick="ctOpenFatturaClienteModal(\'' + cart.id + '\')" title="Ricerca anagrafica clienti e dati fattura">';
  h += '🧾<span>' + (cart.fatturaRichiesta ? 'FATTURA ON' : 'FATTURA') + '</span></button>';
  h += '<button class="ct-fbtn ct-fbtn--riepilogo" onclick="openRiepilogoOrdine(\'' + cart.id + '\')">👀<span>RIEPILOGO</span></button>';
  // Tasto Avvisa Ufficio — solo prima bozza; con bozza attiva la sync carrello↔ufficio è automatica (saveCarrelli)
  if(cart.stato !== 'modifica' && cart.stato !== 'inviato' && !cart.bozzaOrdId){
    h += '<button class="ct-fbtn ct-fbtn--avvisa" ' +
         (!(cart.items||[]).length ? 'disabled ' : '') +
         'onclick="avvisaUfficio(\'' + cart.id + '\')">' +
         '📢<span>UFFICIO</span></button>';
  }
  if(cart.stato === 'modifica'){
    h += '<button class="ct-fbtn ct-fbtn--danger" onclick="eliminaCarrelloModifica(\'' + cart.id + '\')" title="Elimina carrello">🗑️<span>ELIMINA</span></button>';
    h += '<button class="ct-fbtn ct-fbtn--cassa" id="ctf-cassa-' + cart.id + '" ' +
         'onclick="ctCassaSingleClick(this,\'aggiornaOrdine(\\x27' + cart.id + '\\x27)\')">' +
         '✏️<span>AGGIORNA</span></button>';
  } else {
    h += '<button class="ct-fbtn ct-fbtn--cassa" id="ctf-cassa-' + cart.id + '" ' +
         (!(cart.items||[]).length ? 'disabled ' : '') +
         'onclick="ctCassaSingleClick(this,\'inviaOrdine(\\x27' + cart.id + '\\x27)\')">' +
         '🛍️<span>CONFERMA</span></button>';
  }
  h += '</div>';
  h += '</div>';
  h += '</div>'; // fine cart-pos-footer

  body.innerHTML = h;
  if((window.tcCompareSlots||[]).length){
    setTimeout(function(){ if(typeof tcCompareHydratePhotos==='function') tcCompareHydratePhotos(); }, 0);
  }
}

/** Testo lungo confronto: campi magazzino descrizione / note tecniche (come DB magazzino), poi specs. */
function tcCompareMagLongDesc(r,m){
  r=r||{};m=m||{};
  var a=String(m.descrizione||m.Descrizione||'').trim();
  var b=String(m.note_tecniche||m.noteTecniche||m.Note_Tecniche||'').trim();
  var ra=String(r.descrizione||r.note_tecniche||'').trim();
  var parts=[];
  function pushUnique(t){
    t=String(t||'').trim();
    if(!t)return;
    if(parts.indexOf(t)<0)parts.push(t);
  }
  pushUnique(a);pushUnique(b);pushUnique(ra);
  if(parts.length)return parts.join('\n\n');
  var sp=String(m.specs||'').trim();
  if(sp)return sp;
  return '\u2014';
}

/** Chiave canonica codM per confronti carrello/confronto (00123 = 123 se numerici). */
function tcCompareNormCodMKey(cm){
  var s=String(cm==null?'':cm).trim();
  if(!s)return '';
  if(/^\d+$/.test(s))return 'n:'+String(parseInt(s,10));
  return 's:'+s.toLowerCase();
}

/** True se il codice magazzino della riga catalogo è già in una voce del carrello. */
function tcCompareRowCodInCart(rowIdx, cart){
  if(!cart||!(cart.items&&cart.items.length)||typeof rows==='undefined'||!rows[rowIdx])return false;
  var r=rows[rowIdx];
  var k=tcCompareNormCodMKey(r.codM);
  if(!k)return false;
  var items=cart.items;
  for(var i=0;i<items.length;i++){
    var it=items[i];
    if(!it)continue;
    if(tcCompareNormCodMKey(it.codM)===k)return true;
  }
  return false;
}

function tcCompareVariField(arr){
  if(!arr||arr.length<2)return false;
  var x=arr[0];
  for(var i=1;i<arr.length;i++){
    if(arr[i]!==x)return true;
  }
  return false;
}

function tcCompareNormUnitKey(unit){
  return String(unit||'').trim().toLowerCase();
}

function tcCompareNormNumKey(raw){
  var s=String(raw||'').trim().replace(',', '.');
  var n=parseFloat(s);
  if(!isFinite(n))return '';
  return String(Math.round(n*10000)/10000);
}

/** Estrae valori tecnici dal testo: numero + unità tra quelle richieste. */
function tcCompareExtractTechPairs(text){
  var out=[];
  var re=/(\d+(?:[.,]\d+)?)\s*(bar|l\/h|°c|kw|v|ah|mm|kg)\b/gi;
  var s=String(text||'');
  var m;
  while((m=re.exec(s))){
    out.push({
      start:m.index,
      end:re.lastIndex,
      numKey:tcCompareNormNumKey(m[1]),
      unitKey:tcCompareNormUnitKey(m[2])
    });
  }
  return out;
}

/** Mappa gli intervalli di testo da evidenziare per differenze tecniche. */
function tcCompareBuildTechDiffMap(){
  return {};
}

function tcCompareDescToLines(text){
  var s=String(text||'').replace(/\r/g,'\n');
  s=s.replace(/\s*(•|●|◦|▪|🌡️|🌋|💰)\s*/g,'\n$1 ');
  s=s.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n');
  var parts=s.split(/\n+/);
  var lines=[];
  for(var i=0;i<parts.length;i++){
    var t=String(parts[i]||'').trim();
    if(t)lines.push(t);
  }
  return lines.length?lines:['—'];
}

function tcCompareLineHtmlWithTechDiff(line){
  var raw=String(line||'');
  return esc(raw);
}

function tcCompareDescHtml(descText){
  var lines=tcCompareDescToLines(descText);
  var h='<div class="comp-col-desc-list">';
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    h+='<div class="comp-desc-line">'+tcCompareLineHtmlWithTechDiff(line)+'</div>';
  }
  h+='</div>';
  return h;
}

function tcComparePriceMeta(slots){
  var out={hasDiff:false,min:null,byRow:{}};
  if(!slots||!slots.length||typeof rows==='undefined')return out;
  var vals=[];
  for(var i=0;i<slots.length;i++){
    var ri=slots[i];
    var r=rows[ri]||{};
    var pu=typeof parsePriceIT==='function'?parsePriceIT(r.prezzo||0):0;
    if(!isFinite(pu))pu=0;
    pu=Math.round(pu*100)/100;
    out.byRow[ri]=pu;
    vals.push(pu);
  }
  if(!vals.length)return out;
  out.min=Math.min.apply(null,vals);
  out.hasDiff=tcCompareVariField(vals);
  return out;
}

/** Campi che differiscono tra le colonne (solo se highlight attivo e almeno 2 articoli). */
function tcCompareDiffFlags(slots, highlightOn){
  var out={name:false,codes:false,desc:false,price:false};
  if(!highlightOn||!slots||slots.length<2||typeof rows==='undefined')return out;
  var prices=[];
  for(var s=0;s<slots.length;s++){
    var ri=slots[s];
    var r=rows[ri]||{};
    var pu=typeof parsePriceIT==='function'?parsePriceIT(r.prezzo||0):0;
    if(!isFinite(pu))pu=0;
    prices.push(Math.round(pu*100)/100);
  }
  out.price=tcCompareVariField(prices);
  return out;
}

function tcCompareOnHighlightDiffToggle(el){
  window.tcCompareHighlightDiff=!!(el&&el.checked);
  if(typeof renderCartTabs==='function')renderCartTabs();
}

/** Match codice magazzino (stessa logica codepad: esatto prima, poi parziale; max 5 per UI). */
function tcCompareCodMatches(raw, limit){
  var code=String(raw||'').trim().toLowerCase();
  var lim=limit==null?5:limit;
  if(!code||typeof rows==='undefined'||!rows.length)return [];
  var codeNum=/^\d+$/.test(code)?parseInt(code,10):null;
  var matches=[];
  for(var i=0;i<rows.length;i++){
    if(typeof removed!=='undefined'&&removed.has(String(i)))continue;
    var r=rows[i];if(!r)continue;
    var fv=String(r.codM||'').trim();
    if(!fv)continue;
    var fvLo=fv.toLowerCase();
    var exact=fvLo===code||(codeNum!==null&&/^\d+$/.test(fv)&&parseInt(fv,10)===codeNum);
    if(exact){matches.unshift({i:i,r:r,exact:true});continue;}
    if(fvLo.indexOf(code)>=0){matches.push({i:i,r:r,exact:false});}
  }
  return matches.slice(0,lim);
}

/** Risolve indice riga da input utente (esatto o primo parziale come codepadSearch). */
function tcCompareResolveRowIdx(raw){
  var code=String(raw||'').trim();
  if(!code)return -1;
  if(typeof rows==='undefined'||!rows.length)return -1;
  var codeLo=code.toLowerCase();
  var codeNum=/^\d+$/.test(code)?parseInt(code,10):null;
  for(var pass=0;pass<2;pass++){
    for(var i=0;i<rows.length;i++){
      if(typeof removed!=='undefined'&&removed.has(String(i)))continue;
      var r=rows[i];if(!r)continue;
      var fv=String(r.codM||'').trim();
      if(!fv)continue;
      var fvLo=fv.toLowerCase();
      if(pass===0){
        if(fvLo===codeLo)return i;
        if(codeNum!==null&&/^\d+$/.test(fv)&&parseInt(fv,10)===codeNum)return i;
      } else {
        if(fvLo.indexOf(codeLo)>=0)return i;
      }
    }
  }
  return -1;
}

function tcHtmlCompareColumn(rowIdx, slotIx, diffFlags, cart, hiOn, techDiffMap, priceMeta){
  diffFlags=diffFlags||{};
  var r=rows[rowIdx]||{};
  var m=(typeof magazzino!=='undefined'&&magazzino[rowIdx])?magazzino[rowIdx]:{};
  var codM7=r.codM?(String(r.codM).match(/^\d+$/)?String(r.codM).padStart(7,'0'):String(r.codM)):'\u2014';
  var forn=(m.nomeFornitore&&String(m.nomeFornitore).trim())?String(m.nomeFornitore).trim():'\u2014';
  var descText=tcCompareMagLongDesc(r,m);
  var puNum=typeof parsePriceIT==='function'?parsePriceIT(r.prezzo||0):0;
  var priceStr=typeof formatPrezzoUnitDisplay==='function'?formatPrezzoUnitDisplay(puNum):String(puNum);
  var promoG = !!(r && r.isPromo===true && String(r.promoTipo||'')==='G');
  var inCart=tcCompareRowCodInCart(rowIdx, cart);
  var dN='';
  var dC='';
  var dD='';
  var dP=(hiOn&&diffFlags.price)?' comp-col-field--diff':'';
  var isBestPrice=!!(priceMeta&&priceMeta.hasDiff&&priceMeta.byRow&&priceMeta.byRow[rowIdx]===priceMeta.min);
  var h='';
  h+='<article class="comp-col'+(hiOn?' tc-compare--diff-on':'')+'">';
  h+='<button type="button" class="comp-col-remove" aria-label="Rimuovi dal confronto" onclick="tcCompareRemoveSlot('+slotIx+')">\u2715</button>';
  h+='<div class="comp-col-photo" id="tc-comp-ph-'+slotIx+'" data-comp-row="'+rowIdx+'"></div>';
  h+='<h3 class="comp-col-name'+dN+'">'+esc(r.desc||'\u2014')+'</h3>';
  h+='<div class="comp-col-codes'+dC+'"><span class="comp-code-m">M: '+esc(codM7)+'</span><span class="comp-code-sep">|</span><span class="comp-code-f">Fornitore: '+esc(forn)+'</span></div>';
  h+='<div class="comp-col-desc'+dD+'">'+tcCompareDescHtml(descText)+'</div>';
  h+='<div class="comp-col-price'+dP+(isBestPrice?' comp-col-price--best':'')+'">\u20AC '+priceStr+(promoG&&typeof htmlPromoGBadge==='function'?' '+htmlPromoGBadge():'')+(isBestPrice?'<span class="comp-col-price-tag">Miglior Prezzo</span>':'')+'</div>';
  if(inCart){
    h+='<div class="comp-col-present" role="status">PRESENTE</div>';
  } else {
    h+='<button type="button" class="comp-col-cta" onclick="tcCompareAddToCart('+rowIdx+')">Aggiungi al Carrello</button>';
  }
  h+='</article>';
  return h;
}

function tcHtmlCompareShell(){
  var slots=window.tcCompareSlots=window.tcCompareSlots||[];
  var open=!!window.tcCompareAreaOpen;
  var hiOn=!!window.tcCompareHighlightDiff;
  var cart=null;
  if(typeof activeCartId!=='undefined'&&activeCartId&&typeof carrelli!=='undefined'){
    cart=carrelli.find(function(c){ return c&&c.id===activeCartId; })||null;
  }
  var diffFlags=tcCompareDiffFlags(slots, hiOn);
  var techDiffMap=tcCompareBuildTechDiffMap(slots, hiOn);
  var priceMeta=tcComparePriceMeta(slots);
  var chk=hiOn?' checked':'';
  var h='';
  h+='<div id="tc-compare-shell" class="tc-compare-shell">';
  h+='<button type="button" class="tc-compare-btn'+(open?' tc-compare-btn--on':'')+'" onclick="tcToggleCompareArea()">Confronta Articoli</button>';
  h+='<section id="tc-compare-area" class="tc-compare-area" style="display:'+(open?'block':'none')+'" aria-hidden="'+(open?'false':'true')+'">';
  h+='<div class="tc-compare-inner">';
  h+='<header class="tc-compare-topbar">';
  h+='<div class="tc-compare-topbar-main">';
  h+='<button type="button" class="tc-compare-pick-cart" onclick="tcCompareOpenPickFromCart()">Scegli dal carrello</button>';
  h+='<label class="tc-compare-diff-toggle"><input type="checkbox" id="tc-compare-diff-chk"'+chk+' onchange="tcCompareOnHighlightDiffToggle(this)"> Evidenzia Differenze</label>';
  h+='</div>';
  h+='<button type="button" class="tc-compare-close-global" onclick="tcToggleCompareArea(true)">Chiudi Confronto</button>';
  h+='</header>';
  h+='<div class="tc-compare-grid-scroll"><div class="tc-compare-grid">';
  var s=0;
  for(;s<slots.length;s++){
    h+=tcHtmlCompareColumn(slots[s],s, diffFlags, cart, hiOn, techDiffMap, priceMeta);
  }
  if(slots.length<5){
    h+='<div class="comp-col comp-col--add">';
    h+='<button type="button" class="comp-col-add-btn" onclick="tcCompareOpenCodModal()">';
    h+='<span class="comp-col-add-plus" aria-hidden="true">+</span>';
    h+='<span class="comp-col-add-label">Aggiungi Articolo da confrontare (Cerca Codice)</span>';
    h+='</button></div>';
  }
  h+='</div></div></div></section></div>';
  return h;
}

function tcCompareHydratePhotos(){
  var nodes=document.querySelectorAll('.comp-col-photo[data-comp-row]');
  for(var i=0;i<nodes.length;i++){
    (function(el){
      var rowIdx=parseInt(el.getAttribute('data-comp-row'),10);
      if(isNaN(rowIdx))return;
      function show(url){
        if(!url||!el.parentNode)return;
        el.innerHTML='';
        var img=document.createElement('img');
        img.src=url;
        img.alt='';
        el.appendChild(img);
      }
      if(typeof _idbCache!=='undefined'&&_idbCache[rowIdx]){
        show(_idbCache[rowIdx]);
        return;
      }
      if(typeof idbGetFoto!=='function')return;
      idbGetFoto(rowIdx).then(show);
    })(nodes[i]);
  }
}

function tcCompareCodModalRefresh(){
  var matchEl=document.getElementById('tc-compare-cod-sug');
  var inp=document.getElementById('tc-compare-cod-inp');
  if(!matchEl||!inp)return;
  var v=String(inp.value||'').trim();
  if(v.length<2){
    matchEl.innerHTML='<div class="tc-compare-cod-hint">Digita almeno 2 caratteri (codice magazzino)...</div>';
    return;
  }
  if(!rows||!rows.length){
    matchEl.innerHTML='<div class="tc-compare-cod-hint" style="color:var(--accent);">Database in caricamento...</div>';
    return;
  }
  var list=tcCompareCodMatches(v,5);
  if(!list.length){
    matchEl.innerHTML='<div class="tc-compare-cod-hint" style="color:#e53e3e;">Nessun codice trovato</div>';
    return;
  }
  var h='';
  list.forEach(function(m){
    var bgCol=m.exact?'rgba(56,161,105,0.15)':'#1a1a1a';
    var borderCol=m.exact?'#38a169':'#2a2a2a';
    h+='<button type="button" class="tc-compare-cod-sug-row" data-row="'+m.i+'" style="background:'+bgCol+';border:1px solid '+borderCol+';">';
    h+='<span class="tc-compare-cod-sug-t">'+esc(m.r.desc||'\u2014')+'</span>';
    h+='<span class="tc-compare-cod-sug-c"><span class="tc-compare-cod-sug-m">'+esc(m.r.codM||'')+'</span>';
    if(m.r.codF)h+=' <span class="tc-compare-cod-sug-f">'+esc(m.r.codF)+'</span>';
    h+='</span></button>';
  });
  matchEl.innerHTML=h;
  var btns=matchEl.querySelectorAll('.tc-compare-cod-sug-row[data-row]');
  for(var j=0;j<btns.length;j++){
    btns[j].onclick=function(){
      var ix=parseInt(this.getAttribute('data-row'),10);
      if(!isNaN(ix))tcComparePickRowFromModal(ix);
    };
  }
}

function tcComparePickRowFromModal(rowIdx){
  var ok=tcCompareAddRowToCompare(rowIdx);
  if(!ok)return;
  var e=document.getElementById('tc-compare-cod-modal');
  if(e)e.remove();
  showToastGen('green','Aggiunto al confronto');
}

function tcCompareOpenCodModal(){
  if((window.tcCompareSlots||[]).length>=5){
    showToastGen('orange','Massimo 5 articoli nel confronto');
    return;
  }
  var ex=document.getElementById('tc-compare-cod-modal');
  if(ex)ex.remove();
  var ov=document.createElement('div');
  ov.id='tc-compare-cod-modal';
  ov.className='tc-compare-cod-modal';
  ov.innerHTML='<div class="tc-compare-cod-bd"></div>'+
    '<div class="tc-compare-cod-panel" onclick="event.stopPropagation()">'+
    '<div class="tc-compare-cod-title">Codice magazzino</div>'+
    '<input type="text" inputmode="numeric" pattern="[0-9]*" id="tc-compare-cod-inp" class="tc-compare-cod-inp" autocomplete="off" placeholder="es. 0001234">'+
    '<div id="tc-compare-cod-sug" class="tc-compare-cod-sug"></div>'+
    '<div class="tc-compare-cod-btns">'+
    '<button type="button" class="tc-compare-cod-cancel">Annulla</button>'+
    '<button type="button" class="tc-compare-cod-ok">Cerca</button></div></div>';
  document.body.appendChild(ov);
  var close=function(){ var e=document.getElementById('tc-compare-cod-modal');if(e)e.remove(); };
  ov.querySelector('.tc-compare-cod-bd').onclick=close;
  ov.querySelector('.tc-compare-cod-cancel').onclick=close;
  ov.querySelector('.tc-compare-cod-ok').onclick=function(){
    var v=(document.getElementById('tc-compare-cod-inp')||{}).value||'';
    var idx=tcCompareResolveRowIdx(v);
    if(idx<0){
      showToastGen('red','Articolo non trovato');
      return;
    }
    tcComparePickRowFromModal(idx);
  };
  var inp=document.getElementById('tc-compare-cod-inp');
  if(inp){
    inp.focus();
    tcCompareCodModalRefresh();
    inp.oninput=function(){ tcCompareCodModalRefresh(); };
    inp.onkeydown=function(e){
      if(e.key==='Enter'){
        var v=inp.value||'';
        var idx=tcCompareResolveRowIdx(v);
        if(idx>=0)tcComparePickRowFromModal(idx);
        else showToastGen('red','Articolo non trovato');
      }
    };
  }
}

/** Aggiunge rowIdx al confronto; ritorna true se ok. */
function tcCompareAddRowToCompare(rowIdx){
  if(rowIdx==null||rowIdx<0||!rows||!rows[rowIdx])return false;
  var slots=window.tcCompareSlots=window.tcCompareSlots||[];
  if(slots.indexOf(rowIdx)>=0){
    showToastGen('yellow','Articolo gi\u00E0 nel confronto');
    return false;
  }
  if(slots.length>=5){
    showToastGen('orange','Massimo 5 articoli nel confronto');
    return false;
  }
  slots.push(rowIdx);
  window.tcCompareAreaOpen=true;
  if(typeof renderCartTabs==='function')renderCartTabs();
  return true;
}

function tcCompareOpenPickFromCart(){
  if((window.tcCompareSlots||[]).length>=5){
    showToastGen('orange','Massimo 5 articoli nel confronto');
    return;
  }
  if(!activeCartId||typeof carrelli==='undefined'){
    showToastGen('red','Nessun carrello attivo');
    return;
  }
  var cart=carrelli.find(function(c){ return c.id===activeCartId; });
  var items=(cart&&cart.items)||[];
  if(!items.length){
    showToastGen('yellow','Il carrello \u00E8 vuoto');
    return;
  }
  var ex=document.getElementById('tc-compare-cart-modal');
  if(ex)ex.remove();
  var ov=document.createElement('div');
  ov.id='tc-compare-cart-modal';
  ov.className='tc-compare-cod-modal';
  var h='<div class="tc-compare-cod-bd"></div>'+
    '<div class="tc-compare-cod-panel tc-compare-cart-panel" onclick="event.stopPropagation()">'+
    '<div class="tc-compare-cod-title">Scegli dal carrello</div>'+
    '<div class="tc-compare-cart-list">';
  var nCartRows=0;
  for(var k=items.length-1;k>=0;k--){
    var it=items[k];
    if(!it||it.rowIdx===undefined||it.rowIdx===null||it.rowIdx==='')continue;
    var ri=parseInt(it.rowIdx,10);
    if(isNaN(ri)||!rows||!rows[ri])continue;
    nCartRows++;
    var cm=it.codM?String(it.codM):'';
    h+='<button type="button" class="tc-compare-cart-row" data-row="'+ri+'">';
    h+='<span class="tc-compare-cart-row-t">'+esc(it.desc||rows[ri].desc||'\u2014')+'</span>';
    h+='<span class="tc-compare-cart-row-m">M: '+esc(cm||rows[ri].codM||'')+'</span>';
    h+='</button>';
  }
  if(!nCartRows)h+='<div class="tc-compare-cod-hint">Nessun articolo collegato al catalogo nel carrello.</div>';
  h+='</div><div class="tc-compare-cod-btns"><button type="button" class="tc-compare-cod-cancel">Chiudi</button></div></div>';
  ov.innerHTML=h;
  document.body.appendChild(ov);
  var close=function(){ var e=document.getElementById('tc-compare-cart-modal');if(e)e.remove(); };
  ov.querySelector('.tc-compare-cod-bd').onclick=close;
  ov.querySelector('.tc-compare-cod-cancel').onclick=close;
  var btns=ov.querySelectorAll('.tc-compare-cart-row[data-row]');
  for(var j=0;j<btns.length;j++){
    btns[j].onclick=function(){
      var ix=parseInt(this.getAttribute('data-row'),10);
      if(!isNaN(ix)&&tcCompareAddRowToCompare(ix)){
        close();
        showToastGen('green','Aggiunto al confronto');
      }
    };
  }
}

function tcCompareRemoveSlot(slotIx){
  var slots=window.tcCompareSlots=window.tcCompareSlots||[];
  if(slotIx<0||slotIx>=slots.length)return;
  slots.splice(slotIx,1);
  if(typeof renderCartTabs==='function')renderCartTabs();
}

function tcCompareAddToCart(rowIdx){
  if(typeof cartAddItem!=='function')return;
  cartAddItem(rowIdx);
}

function tcToggleCompareArea(forceClose){
  var area=document.getElementById('tc-compare-area');
  if(!area){
    if(forceClose){
      window.tcCompareAreaOpen=false;
      return;
    }
    window.tcCompareAreaOpen=!window.tcCompareAreaOpen;
    if(typeof renderCartTabs==='function')renderCartTabs();
    return;
  }
  if(forceClose){
    window.tcCompareAreaOpen=false;
    area.style.display='none';
    area.setAttribute('aria-hidden','true');
    var act=document.querySelector('.tc-compare-btn');
    if(act)act.classList.remove('tc-compare-btn--on');
    return;
  }
  var hidden=area.style.display==='none'||area.style.display==='';
  if(hidden){
    window.tcCompareAreaOpen=true;
    area.style.display='block';
    area.setAttribute('aria-hidden','false');
    var b=document.querySelector('.tc-compare-btn');
    if(b)b.classList.add('tc-compare-btn--on');
    setTimeout(function(){ if(typeof tcCompareHydratePhotos==='function')tcCompareHydratePhotos(); },0);
  } else {
    window.tcCompareAreaOpen=false;
    area.style.display='none';
    area.setAttribute('aria-hidden','true');
    var b2=document.querySelector('.tc-compare-btn');
    if(b2)b2.classList.remove('tc-compare-btn--on');
  }
}

if(typeof window !== 'undefined' && !window.__CART_ORDINI_SYNC_BOUND__){
  window.__CART_ORDINI_SYNC_BOUND__ = true;
  function _ctRefreshIfCartTabActive(){
    var tc = document.getElementById('tc');
    if(!tc || !tc.classList.contains('active') || typeof renderCartTabs !== 'function') return;
    if(typeof cartNoteFieldHasFocus === 'function' && cartNoteFieldHasFocus()) return;
    renderCartTabs();
  }
  window.addEventListener('sync-orders', _ctRefreshIfCartTabActive);
  window.addEventListener('db-changed', function(ev){
    var k = ev && ev.detail && ev.detail.key;
    if(typeof ORDK !== 'undefined' && k === ORDK) _ctRefreshIfCartTabActive();
  });
}
