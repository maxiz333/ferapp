// carrello.render-tabs.js — renderCartTabs

// --- RENDER CARRELLO ---------------------------------------

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
    h += '<div style="flex:1"><div class="ct-inviato-label">Ordine inviato alla cassa</div>';
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
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button onclick="deleteCart(\'' + cart.id + '\')" class="ct-btn-ghost" style="flex:1;font-size:12px;color:#555">🗑️ Elimina carrello</button>';
    h += '</div></div>';
    body.innerHTML = h;
    return;
  }

  // ── BANNER MODIFICA — striscia sottile ─────────────────────────────────
  if(cart.stato === 'modifica'){
    h += '<div class="ct-banner-mod">';
    h += '<span style="font-size:13px">✏️</span>';
    h += '<span class="ct-banner-mod-title" onclick="ctEditClienteName(\''+cart.id+'\')" style="cursor:pointer;" title="Tap per modificare">' + esc(cart.nome) + ' — MODIFICA</span>';
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

    // ── TOTALE STICKY ─────────────────────────────────────────────────────
    var tot     = (cart.items||[]).reduce(function(s,it){ return s + _prezzoEffettivo(it) * parseFloat(it.qty||0); }, 0);
    var scontoGl = cart.scontoGlobale;
    var totFin   = scontoGl ? tot * (1 - scontoGl/100) : tot;
    h += '<div class="ct-sticky-total">';
    h += '<span class="ct-sticky-val">€ ' + totFin.toFixed(2) + '</span>';
    if(scontoGl) h += '<span class="ct-sconto-badge">-'+scontoGl+'%</span>';
    h += '<span class="ct-sticky-n">' + (cart.items||[]).length + ' art.</span>';
    h += '<button onclick="openScontoOverlay()" class="ct-btn-sconto">% Sconto</button>';
    h += '</div>';

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
      var p            = listinoPrezzoNum(it);
      var q            = parseFloat(it.qty) || 0;
      var isSc         = it.scampolo    || false;
      var isFR         = it.fineRotolo  || false;
      var isDaOrd      = it.daOrdinare  || false;
      var scagAp       = it._scaglioniAperti || false;
      var scagAtt      = it._scaglioneAttivo || null;
      var hasNota      = !!(it.nota && it.nota.trim());
      var scOn         = isSc || isFR;
      var isTuttoRotolo = it._tuttoRotolo || false;

      // Prezzo scontato calcolato al volo
      var scAttivo     = it._scontoApplicato || 0;
      var scApplica = false;
      if(it._scaglionato && scAttivo > 0){
        // Scaglionato: sconto solo se qty >= soglia
        scApplica = q >= (it._scaglioneQta || 10);
      } else if(scOn && scAttivo > 0){
        scApplica = true;
      }
      var pScontato    = scApplica ? p * (1 - scAttivo/100) : p;
      var sub          = (pScontato * q).toFixed(2);

      // Cod. Magazzino — 7 cifre se numerico
      var codM7 = it.codM
        ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM)
        : '';
      var codF = it.codF || '';

      // Bordo card
      var cardStyle = '';
      if(isTuttoRotolo)    cardStyle = 'border-color:#e53e3e;box-shadow:0 0 0 2px #e53e3e55';
      else if(it._ordColore) cardStyle = 'border-color:' + it._ordColore + ';box-shadow:0 0 0 1px ' + it._ordColore + '44';

      var cardClass = 'ct-card' +
        (it._checked ? ' ct-card--checked' : '') +
        (cart.stato === 'modifica' ? ' ct-card--mod' : '');

      h += '<div class="' + cardClass + '" id="cart-row-' + idx + '"' +
           (cardStyle ? ' style="' + cardStyle + '"' : '') + '>';

      // ── RIGA GRIGLIA: stessa struttura ord-grid 50%|15%|15%|20% ──────
      h += '<div class="ord-grid ord-grid-row' + (displayPos%2===0 ? ' ord-grid-even' : ' ord-grid-odd') + '">';

      // Colonna prodotto: nome + codici
      h += '<div class="ord-gc-desc">';
      h += '<div class="ord-item-name">' + esc(it.desc || '—') + '</div>';
      var codes = '';
      if(codM7) codes += '<span class="ord-code-mag">' + esc(codM7) + '</span>';
      // Cod.Forn editabile
      codes += '<span class="ord-code-forn" style="display:inline-flex;align-items:center;gap:2px;">Forn: ';
      codes += '<input class="ct-codf-inp" value="' + esc(codF) + '" placeholder="—" ' +
               'oninput="ctSetCodF(\'' + cart.id + '\',' + idx + ',this.value)" ' +
               'onclick="event.stopPropagation();this.select()" ' +
               'onkeydown="if(event.key===\'Enter\')this.blur()">';
      codes += '</span>';
      h += '<div class="ord-item-codes">' + codes + '</div>';
      h += '</div>';

      // Colonna quantità — stepper interattivo
      h += '<div class="ord-gc-qty ct-grid-qty">';
      h += '<div class="ct-qty ct-qty--compact">';
      h += '<button class="ct-qty-btn" onclick="cartDelta(\'' + cart.id + '\',' + idx + ',-1)">−</button>';
      h += '<button class="ct-qty-val" onclick="openQtyNumpad(\'' + cart.id + '\',' + idx + ')">' + Math.round(q) + '</button>';
      h += '<button class="ct-qty-btn" onclick="cartDelta(\'' + cart.id + '\',' + idx + ',1)">＋</button>';
      h += '</div>';
      var units = ['pz','mt','kg','lt','cf','ml','gr','mm','cm','m²','m³'];
      var curUnit = it.unit || 'pz';
      h += '<select class="ct-um-select ct-um--mini" onchange="cartSetUnit(\'' + cart.id + '\',' + idx + ',this.value)">';
      units.forEach(function(u){
        h += '<option value="' + u + '"' + (u === curUnit ? ' selected' : '') + '>' + u + '</option>';
      });
      h += '</select>';
      h += '</div>';

      // Colonna prezzo — prezzo base sempre visibile, scontato sotto se attivo
      h += '<div class="ord-gc-price" id="prz-' + idx + '">';
      var hasSconto = scApplica && pScontato < p - 0.005;
      if(hasSconto){
        var savU = (p - pScontato).toFixed(2);
        h += '<div class="ct-old--orig">€' + p.toFixed(2) + '</div>';
        h += '<div class="ct-sub--final">€' + pScontato.toFixed(2) + '</div>';
        h += '<div style="font-size:8px;color:#f6ad55;text-align:center;">-€' + savU + '</div>';
      } else {
        h += '<div style="font-size:12px;font-weight:900;color:#999">€' + p.toFixed(2) + '</div>';
      }
      h += '<input class="ct-punit" type="text" inputmode="decimal" value="' +
           esc(it.prezzoUnit||'0') + '" ' +
           'onchange="cartSetPrezzo(\'' + cart.id + '\',' + idx + ',this.value)" ' +
           'onclick="this.select()" title="€/unità">';
      h += '</div>';

      // Colonna totale
      h += '<div class="ord-gc-sub">';
      if(hasSconto){
        var savT = ((p - pScontato) * q).toFixed(2);
        h += '<div class="ct-old--orig">€' + (p * q).toFixed(2) + '</div>';
        h += '<div class="ct-sub--final">€' + sub + '</div>';
        h += '<div style="font-size:8px;color:#f6ad55;text-align:center;">-€' + savT + '</div>';
      } else {
        var subColor = isTuttoRotolo ? '#fc8181' : (isFR ? '#f6ad55' : 'var(--accent)');
        h += '<div style="font-size:13px;font-weight:900;color:' + subColor + '">€' + sub + '</div>';
      }
      h += '</div>';

      h += '</div>'; // fine ord-grid row

      // ── ICONBAR: Forbici+% | Note | Ordina | Cestino ─────────────────────
      h += '<div class="ct-iconbar">';

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
      if(scAtt > 0){
        var risparmio = (parsePriceIT(it._prezzoOriginale||it._prezzoBase||it.prezzoUnit) * q * scAtt / 100).toFixed(2);
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

      h += '</div>'; // fine ct-iconbar

      // ── PANNELLI A COMPARSA ───────────────────────────────────────────────
      var pNoId = 'ctp-no-' + idx;
      var _pKey = cart.id + '-' + idx;

      // Pannello NOTE
      var notaPanelOpen = _ctPanelState[_pKey] === 'nota';
      h += '<div id="' + pNoId + '" class="ct-panel" style="display:' + (notaPanelOpen ? 'block' : 'none') + '">';
      h += '<textarea class="ct-nota-inp" placeholder="Nota articolo..." ' +
           'oninput="cartSetNota(\'' + cart.id + '\',' + idx + ',this.value)">' +
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
       'oninput="cartSetNotaOrdine(\'' + cart.id + '\',this.value)">' + esc(cart.nota||'') + '</textarea>';
  h += '</div>';

  // ── STICKY FOOTER ─────────────────────────────────────────────────────────
  var tot2    = (cart.items||[]).reduce(function(s,it){ return s + _prezzoEffettivo(it) * parseFloat(it.qty||0); }, 0);
  var tot2Fin = cart.scontoGlobale ? tot2*(1-cart.scontoGlobale/100) : tot2;
  h += '<div id="cart-pos-footer">';
  h += '<div class="ct-footer">';
  h += '<div class="ct-footer-tot"><span class="ct-footer-sym">€</span>' + tot2Fin.toFixed(2) + '</div>';
  h += '<div class="ct-footer-btns">';
  h += '<button class="ct-fbtn ct-fbtn--danger" onclick="eliminaOrdineCarrello(\'' + cart.id + '\')">🗑️<span>Elimina ordine</span></button>';
  // Tasto Avvisa Ufficio — solo prima bozza; con bozza attiva la sync carrello↔ufficio è automatica (saveCarrelli)
  if(cart.stato !== 'modifica' && cart.stato !== 'inviato' && !cart.bozzaOrdId){
    h += '<button class="ct-fbtn ct-fbtn--avvisa" ' +
         (!(cart.items||[]).length ? 'disabled ' : '') +
         'onclick="avvisaUfficio(\'' + cart.id + '\')">' +
         '📢<span>UFFICIO</span></button>';
  }
  h += '<button class="ct-fbtn ct-fbtn--riepilogo" onclick="openRiepilogoOrdine(\'' + cart.id + '\')">👀<span>RIEPILOGO</span></button>';
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
}
