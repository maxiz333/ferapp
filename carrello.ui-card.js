// =============================================================================
//  FUNZIONI HELPER CARRELLO NUOVO
// =============================================================================

// Chiave localStorage per nomi fornitori per colore
var CT_FORN_KEY = window.AppKeys.FORNI_COLORE;

// ctTogglePanel: mostra/nasconde pannello a comparsa (sconto|nota)
// Stato salvato in _ctPanelState (JS puro, non nei dati carrello/Firebase)
var _ctPanelState = {}; // chiave: cartId+'-'+idx → 'sconto'|'nota'|null
function ctTogglePanel(cartId, idx, tipo){
  var key = cartId + '-' + idx;
  var ids = { sconto: 'ctp-sc-', nota: 'ctp-no-' };
  var targetId = (ids[tipo] || 'ctp-') + idx;
  var el = document.getElementById(targetId);
  if(!el) return;
  var isOpen = el.style.display !== 'none';
  // Chiude l'altro pannello della stessa card
  Object.keys(ids).forEach(function(t){
    if(t !== tipo){
      var other = document.getElementById((ids[t]||'ctp-') + idx);
      if(other) other.style.display = 'none';
    }
  });
  el.style.display = isOpen ? 'none' : 'block';
  _ctPanelState[key] = isOpen ? null : tipo;
  if(tipo === 'nota' && !isOpen){
    var ta = el.querySelector('textarea');
    if(ta) setTimeout(function(){ ta.focus(); }, 40);
  }
}

// ctForbiciClick: singolo click sulle forbici = ciclo scampolo/fine-rotolo
// Il singolo click deve essere ignorato se fa parte di un dblclick.
// Usiamo un timer: se entro 250ms arriva il secondo click (dblclick nativo),
// il singolo viene annullato — il dblclick gestisce "Tutto il Rotolo".
// ctToggleScontiMenu: apre/chiude il menu sconti compatto nella iconbar
var _ctScontiMenuState = {}; // chiave: cartId+'-'+idx → true/false
function ctToggleScontiMenu(cartId, idx){
  var key = cartId + '-' + idx;
  _ctScontiMenuState[key] = !_ctScontiMenuState[key];
  renderCartTabs();
}

// ═══════════════════════════════════════════════════════════════════════════
// ctForbiciTap — TAP SINGOLO / DOPPIO TAP sulle forbici
// Funziona su iPhone Safari dove ondblclick non è affidabile.
//
// Logica a timer (unico onClick):
//   1° tap → segna _ctForbiciPending[idx]=true, avvia timer 380ms
//   2° tap entro 380ms → annulla timer → ROTOLO INTERO
//   Timer scade → tap singolo confermato → ciclo scampolo normale
//
// 380ms è calibrato: abbastanza per un doppio tap intenzionale,
// abbastanza corto da non sembrare lento su tap singolo.
// ═══════════════════════════════════════════════════════════════════════════
var _ctForbiciTimers  = {};
var _ctForbiciPending = {};

function ctForbiciTap(cartId, idx){
  // Singolo tap: cicla OFF → Scampolo → Rotolo → Scaglionato → OFF
  cartCycleScampolo(cartId, idx);
}

// ctTuttoRotolo: attiva o disattiva la modalità ROTOLO INTERO
// Bordo rosso sulla card, nota automatica "ROTOLO INTERO", flag _tuttoRotolo
function ctTuttoRotolo(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];

  if(it._tuttoRotolo){
    var restoreTr = it._prezzoOriginale || listinoPrezzoString(it);
    it._tuttoRotolo = false;
    if(it.nota === 'ROTOLO INTERO') it.nota = '';
    it.scampolo   = false;
    it.fineRotolo = false;
    delete it._scontoApplicato;
    delete it._scontoTipo;
    delete it._prezzoOriginale;
    if(restoreTr && parsePriceIT(restoreTr) > 0) it.prezzoUnit = restoreTr;
  } else {
    ensurePrezzoOriginaleDaListino(it, true);
    it._tuttoRotolo     = true;
    it.nota             = 'ROTOLO INTERO';
    it.scampolo         = false;
    it.fineRotolo       = true;
    it._scontoTipo      = 'rotolo';
    it._scontoApplicato = SCONTO_ROTOLO_DEFAULT_PCT;
    if(typeof _cartRicalcolaPrezzoVendita === 'function') _cartRicalcolaPrezzoVendita(it);
  }
  saveCarrelli();
  renderCartTabs();
}

// ctApriColori: popup colore ordine fornitore
function ctApriColori(cartId, idx){
  // Rimuove popup precedente se esiste
  var ex = document.getElementById('ct-color-popup');
  if(ex){ ex.remove(); document.getElementById('ct-color-bd')&&document.getElementById('ct-color-bd').remove(); return; }

  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];

  var slots = typeof CT_FORN_CANON_HEX !== 'undefined' ? CT_FORN_CANON_HEX : ['#e53e3e', '#38a169', '#3182ce', '#e2c400'];

  var popup = document.createElement('div');
  popup.id = 'ct-color-popup';
  popup.className = 'ct-color-popup';

  var html = '<div class="ct-color-title">Ordina da fornitore</div>';
  slots.forEach(function(hex){
    var nome = typeof ctEtichettaFornitore === 'function' ? ctEtichettaFornitore(hex) : hex;
    var isActive = it._ordColore === hex && hex !== '';
    html += '<button type="button" class="ct-color-opt' + (isActive ? ' ct-color-opt--active' : '') + '"';
    html += ' style="border-color:' + hex + '"';
    html += ' onclick="ctSetColore(\'' + cartId + '\',' + idx + ',\'' + hex + '\')">';
    html += '<span class="ct-color-opt-inner"><span class="ct-color-dot" style="background:' + hex + '"></span>';
    html += '<span>' + esc(nome) + '</span></span>';
    if(isActive) html += ' ✓';
    html += '</button>';
  });
  html += '<button type="button" class="ct-color-opt ct-color-opt--clear" onclick="ctSetColore(\'' + cartId + '\',' + idx + ',\'\')">✕ Rimuovi da ordinare</button>';
  popup.innerHTML = html;

  // Posizionamento vicino alla card
  var card = document.getElementById('cart-row-' + idx);
  if(card){
    var r = card.getBoundingClientRect();
    popup.style.top  = (r.bottom + window.scrollY + 4) + 'px';
    popup.style.left = Math.min(r.left, window.innerWidth - 180) + 'px';
  }

  var bd = document.createElement('div');
  bd.id = 'ct-color-bd';
  bd.style.cssText = 'position:fixed;inset:0;z-index:7990';
  bd.onclick = function(){ popup.remove(); bd.remove(); };

  document.body.appendChild(bd);
  document.body.appendChild(popup);
}

// ctSetColore: salva il colore e aggiorna la card
function ctSetColore(cartId, idx, colore){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var it = cart.items[idx];
  it._ordColore = colore || undefined;
  it.daOrdinare = !!colore;
  if(colore){
    var map = typeof ctGetForniColore === 'function' ? ctGetForniColore() : {};
    if(map[colore]) it._ordFornitoreNome = map[colore];
    else delete it._ordFornitoreNome;
  } else {
    delete it._ordFornitoreNome;
  }
  var p = document.getElementById('ct-color-popup');
  var b = document.getElementById('ct-color-bd');
  if(p) p.remove(); if(b) b.remove();
  if(typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(cart);
  saveCarrelli();
  renderCartTabs();
}


// ctSetCodF: salva il Codice Fornitore editato direttamente nella card
// Il campo è un <input> inline — si salva a ogni keystroke con debounce
var _ctCodFTimers = {};
function ctSetCodF(cartId, idx, val){
  clearTimeout(_ctCodFTimers[cartId + '_' + idx]);
  _ctCodFTimers[cartId + '_' + idx] = setTimeout(function(){
    var cart = carrelli.find(function(c){ return c.id === cartId; });
    if(!cart || !cart.items[idx]) return;
    cart.items[idx].codF = val.trim();
    saveCarrelli(); // salva su localStorage + Firebase
    // NON chiama renderCartTabs() per non perdere il focus sull'input
  }, 600);
}

// ctCassaSingleClick: doppio tap per conferma (Safari iOS compatibile)
var _ctCassaTimer = null;
var _ctCassaPending = false;
function ctCassaSingleClick(btn, action){
  if(_ctCassaPending){
    // SECONDO TAP — conferma!
    clearTimeout(_ctCassaTimer);
    _ctCassaPending = false;
    btn.classList.remove('ct-fbtn--warn');
    var sp = btn.querySelector('span');
    if(sp) sp.textContent = '✅ Invio...';
    // Esegui l'azione (inviaOrdine o aggiornaOrdine)
    if(action) setTimeout(function(){ eval(action); }, 100);
  } else {
    // PRIMO TAP — mostra avviso
    _ctCassaPending = true;
    btn.classList.add('ct-fbtn--warn');
    var sp = btn.querySelector('span');
    var orig = sp ? sp.textContent : '';
    if(sp) sp.textContent = '⚠ Tocca di nuovo!';
    _ctCassaTimer = setTimeout(function(){
      btn.classList.remove('ct-fbtn--warn');
      if(sp) sp.textContent = orig;
      _ctCassaPending = false;
    }, 2000);
  }
}

// apriModalFoto: foto a tutto schermo — onclick su miniatura
function apriModalFoto(src){
  var ex = document.getElementById('ct-modal-foto');
  if(ex){ ex.remove(); return; }
  var m = document.createElement('div');
  m.id = 'ct-modal-foto';
  m.className = 'ct-modal-foto';
  m.innerHTML = '<div class="ct-modal-box">' +
    '<button class="ct-modal-close" ' +
    'onclick="document.getElementById(\'ct-modal-foto\').remove()">✕</button>' +
    '<img src="' + src + '" class="ct-modal-img" alt="">' +
    '</div>';
  m.addEventListener('click', function(e){ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}
