// --- CARRELLO - NUOVO ---------------------------------------
function newCart(){
  var el=document.getElementById('nc-input');if(el)el.value='';
  var sc=document.getElementById('nc-sconto');if(sc)sc.value='';
  var ind=document.getElementById('nc-indirizzo');if(ind)ind.value='';
  var pv=document.getElementById('nc-piva');if(pv)pv.value='';
  document.getElementById('nc-overlay').classList.add('open');
  setTimeout(function(){if(el)el.focus();},100);
}
function _cartNextClienteLabelOggi(){
  var maxN = 0;
  (carrelli || []).forEach(function(c){
    if(typeof ctCartCreatoOggi === 'function' && !ctCartCreatoOggi(c)) return;
    var m = String(c && c.nome || '').trim().match(/^Cliente\s+(\d+)$/i);
    if(m){
      var n = parseInt(m[1], 10);
      if(!isNaN(n) && n > maxN) maxN = n;
    }
  });
  return 'Cliente ' + (maxN + 1);
}

function confirmNewCart(){
  var el=document.getElementById('nc-input');
  var nome=el?el.value.trim():'';
  var scEl=document.getElementById('nc-sconto');
  var sconto=scEl?parseFloat(scEl.value)||0:0;
  document.getElementById('nc-overlay').classList.remove('open');
  var savedSconto=getClienteSconto(nome);
  if(!sconto&&savedSconto)sconto=savedSconto;
  if(nome&&sconto)setClienteSconto(nome,sconto);
  var id='cart_'+Date.now();
  var nowIso=new Date().toISOString();
  carrelli.push({id:id,nome:nome||_cartNextClienteLabelOggi(),
    createdAt:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    dataCreazione:Date.now(),
    creatoAtISO:nowIso,
    ultimaModificaISO:nowIso,
    items:[],
    scontoGlobale:sconto||null,
    fatturaRichiesta:false,
    fatturaCliente:null,
    salvaFatturaInRubrica:false});
  activeCartId=id;
  saveCarrelli();
  goTab('tc');
  if(sconto)showToastGen('green','-- Sconto cliente '+sconto+'% applicato');
  setTimeout(function(){ var s=document.getElementById('cart-search'); if(s)s.focus(); },200);
}
function ncAutoSconto(){
  var nome=(document.getElementById('nc-input')||{}).value||'';
  var sc=getClienteSconto(nome);
  var hint=document.getElementById('nc-sconto-hint');
  var inp=document.getElementById('nc-sconto');
  if(sc>0){
    if(inp&&!inp.value)inp.value=sc;
    if(hint)hint.textContent='(salvato: '+sc+'%)';
  } else {
    if(hint)hint.textContent='';
  }
}
function switchCart(idx){
  if(carrelli[idx])activeCartId=carrelli[idx].id;
  renderCartTabs();
}

/** Carrello vuoto con timestamp di oggi (senza overlay NUOVO). */
function _cartCreateVuotoOggi(nome){
  var id = 'cart_' + Date.now();
  var nowIso = new Date().toISOString();
  var label = (nome && String(nome).trim()) || (typeof _cartNextClienteLabelOggi === 'function' ? _cartNextClienteLabelOggi() : 'Cliente 1');
  carrelli.push({
    id: id,
    nome: label,
    createdAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    dataCreazione: Date.now(),
    creatoAtISO: nowIso,
    ultimaModificaISO: nowIso,
    items: [],
    scontoGlobale: null,
    fatturaRichiesta: false,
    fatturaCliente: null,
    salvaFatturaInRubrica: false
  });
  return id;
}

/** Dopo eliminazione/sync: carrello aperto creato oggi, altrimenti null (schermata NUOVO). */
function _cartResolveActiveId(){
  var oggi = typeof ctOggiDateKey === 'function' ? ctOggiDateKey() : '';
  var best = null;
  var bestMs = 0;
  (carrelli || []).forEach(function(c){
    if(!c || c.stato === 'inviato') return;
    if(typeof ctCartCreatoOggi === 'function' && !ctCartCreatoOggi(c)) return;
    if(typeof ctCartCreatoDayKey === 'function' && ctCartCreatoDayKey(c) !== oggi) return;
    var iso = (typeof ctCartActivityIso === 'function') ? ctCartActivityIso(c) : (c.ultimaModificaISO || c.creatoAtISO || '');
    var ms = iso ? new Date(iso).getTime() : 0;
    if(isNaN(ms)) ms = 0;
    if(!best || ms >= bestMs){
      best = c;
      bestMs = ms;
    }
  });
  return best ? best.id : null;
}

function _cartTrashSave(){
  lsSet(CART_CK, carrelliCestino);
  if(typeof _fbReady !== 'undefined' && _fbReady && typeof _fbDb !== 'undefined' && _fbDb){
    try{ _fbDb.ref('ordini_eliminati').set(carrelliCestino.length ? carrelliCestino : null); }catch(e){ console.error('Firebase ordini_eliminati:', e); }
  }
}

function _cartTrashTotal(cart){
  return (cart.items || []).reduce(function(s, it){
    return s + (parsePriceIT(it.prezzoUnit) * parseFloat(it.qty || 0));
  }, 0);
}

function _cartTrashMoveLinkedOrdine(cart){
  if(!cart || typeof ordini === 'undefined' || !ordini) return;
  var oid = cart.bozzaOrdId || cart.ordId || '';
  if(!oid) return;
  var idx = ordini.findIndex(function(o){ return o && o.id === oid; });
  if(idx < 0) return;
  var ord = ordini.splice(idx, 1)[0];
  if(!ord) return;
  ord.eliminatoAt = new Date().toLocaleString('it-IT');
  ord.eliminatoAtISO = new Date().toISOString();
  ord.eliminatoDaCarrello = true;
  var oc = (typeof ordiniCestino !== 'undefined') ? ordiniCestino : (lsGet(window.AppKeys.ORDINI_CESTINO) || []);
  oc.unshift(ord);
  window.ordiniCestino = oc;
  lsSet(window.AppKeys.ORDINI_CESTINO, oc);
  saveOrdini();
  if(typeof renderOrdini==='function') renderOrdini();
  if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
    window.dispatchEvent(new CustomEvent('sync-orders',{detail:{source:'carrello-delete'}}));
  }
}

function deleteCart(id, toastMsg){
  var cart=carrelli.find(function(c){return c.id===id;});
  if(!cart)return;
  if(!_cartPossoModificare(cart)){
    showToastGen('orange','🔒 Non puoi eliminare il carrello di un altro account');
    return;
  }
  var now = new Date();
  cart.deletedAt = now.toLocaleString('it-IT');
  cart.deletedAtISO = now.toISOString();
  cart.eliminato = true;
  cart.eliminatoDa = (typeof _currentUser !== 'undefined' && _currentUser) ? (_currentUser.nome || _currentUser.key || '') : '';
  carrelliCestino.unshift(cart);
  _cartTrashSave();
  carrelli=carrelli.filter(function(c){return c.id!==id;});
  if(activeCartId===id){
    activeCartId = typeof _cartResolveActiveId === 'function'
      ? _cartResolveActiveId()
      : null;
  }
  saveCarrelli();renderCartTabs();
  if(toastMsg === null || toastMsg === '') return;
  showToastGen('green', toastMsg === undefined ? '🗑️ Carrello eliminato' : toastMsg);
}

function cartTrashEnsureModal(){
  var existing = document.getElementById('cart-trash-modal');
  if(existing) return existing;
  var modal = document.createElement('div');
  modal.id = 'cart-trash-modal';
  modal.innerHTML =
    '<div class="cart-trash-backdrop" onclick="cartTrashClose()"></div>' +
    '<div class="cart-trash-panel" role="dialog" aria-modal="true" aria-label="Cestino ordini eliminati">' +
      '<div class="cart-trash-head">' +
        '<div><div class="cart-trash-kicker">Cestino Carrello</div><h3>🗑️ Ordini eliminati</h3></div>' +
        '<button type="button" class="cart-trash-x" onclick="cartTrashClose()" aria-label="Chiudi">✕</button>' +
      '</div>' +
      '<div id="cart-trash-list"></div>' +
    '</div>';
  document.body.appendChild(modal);
  return modal;
}

function cartTrashOpen(){
  var modal = cartTrashEnsureModal();
  modal.classList.add('open');
  renderCartTrash();
}

function cartTrashClose(){
  var modal = document.getElementById('cart-trash-modal');
  if(modal) modal.classList.remove('open');
}

function _cartTrashDayKey(cart){
  if(cart && cart.deletedAtISO){
    var dIso = new Date(cart.deletedAtISO);
    if(!isNaN(dIso.getTime())) return dIso.toISOString().slice(0, 10);
  }
  var raw = String(cart && cart.deletedAt || '').trim();
  var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return 'senza-data';
}

function _cartTrashDayLabel(key){
  if(key === 'senza-data') return 'Senza data';
  var today = new Date().toISOString().slice(0, 10);
  var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if(key === today) return 'Oggi';
  if(key === y) return 'Ieri';
  var p = key.split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : key;
}

function renderCartTrash(){
  var modal = cartTrashEnsureModal();
  var list = document.getElementById('cart-trash-list');
  if(!list) return;
  if(!carrelliCestino || !carrelliCestino.length){
    list.innerHTML = '<div class="cart-trash-empty">Il cestino degli ordini è vuoto.</div>';
    return;
  }
  var groups = {};
  carrelliCestino.forEach(function(cart, i){
    var key = _cartTrashDayKey(cart);
    if(!groups[key]) groups[key] = [];
    groups[key].push({ cart: cart, idx: i });
  });
  var keys = Object.keys(groups).sort(function(a, b){
    if(a === 'senza-data') return 1;
    if(b === 'senza-data') return -1;
    return a < b ? 1 : (a > b ? -1 : 0);
  });
  var h = '<div class="cart-trash-toolbar">' +
    '<div class="cart-trash-count">' + carrelliCestino.length + ' ordini eliminati</div>' +
    '<button type="button" class="cart-trash-delete-all" onclick="svuotaCartCestino()">🗑️ Elimina tutti</button>' +
    '</div>';
  keys.forEach(function(key){
    h += '<div class="cart-trash-day">';
    h += '<div class="cart-trash-day-title">' + esc(_cartTrashDayLabel(key)) + ' <span>' + groups[key].length + '</span></div>';
    groups[key].forEach(function(entry){
    var cart = entry.cart;
    var i = entry.idx;
    var nArt = (cart.items || []).length;
    var tot = _cartTrashTotal(cart);
    var preview = (cart.items || []).slice(0, 3).map(function(it){
      return '<span>' + esc(it.desc || 'Articolo') + ' × ' + esc(it.qty || 0) + '</span>';
    }).join('');
    h += '<div class="cart-trash-card">';
    h += '<div class="cart-trash-main">';
    h += '<div class="cart-trash-title">' + esc(cart.nome || 'Ordine senza nome') + '</div>';
    h += '<div class="cart-trash-meta">' + nArt + ' articoli · € ' + tot.toFixed(2) + (cart.deletedAt ? ' · Eliminato: ' + esc(cart.deletedAt) : '') + '</div>';
    if(cart.eliminatoDa) h += '<div class="cart-trash-meta">Da: ' + esc(cart.eliminatoDa) + '</div>';
    if(preview) h += '<div class="cart-trash-preview">' + preview + ((cart.items || []).length > 3 ? '<span>+' + ((cart.items || []).length - 3) + ' altri</span>' : '') + '</div>';
    h += '</div>';
    h += '<div class="cart-trash-actions">';
    h += '<button type="button" class="cart-trash-restore" onclick="ripristinaCarrello(' + i + ')">🔄 Ripristina</button>';
    h += '<button type="button" class="cart-trash-delete" onclick="eliminaCartCestino(' + i + ')">🗑️ Elimina definitivamente</button>';
    h += '</div></div>';
    });
    h += '</div>';
  });
  list.innerHTML = h;
  modal.classList.add('open');
}

function ripristinaCarrello(i){
  var cart = carrelliCestino.splice(i, 1)[0];
  if(!cart) return;
  delete cart.deletedAt;
  delete cart.deletedAtISO;
  delete cart.eliminato;
  delete cart.eliminatoDa;
  if(carrelli.some(function(c){ return c.id === cart.id; })){
    cart.id = 'cart_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }
  carrelli.push(cart);
  activeCartId = cart.id;
  _cartTrashSave();
  saveCarrelli();
  renderCartTrash();
  renderCartTabs();
  showToastGen('green','🔄 Ordine ripristinato');
}

function eliminaCartCestino(i){
  showConfirm('Eliminare definitivamente questo ordine?', function(){
    carrelliCestino.splice(i, 1);
    _cartTrashSave();
    renderCartTrash();
    renderCartTabs();
    showToastGen('red','🗑️ Ordine eliminato definitivamente');
  });
}

function svuotaCartCestino(){
  if(!carrelliCestino || !carrelliCestino.length) return;
  showConfirm('Eliminare definitivamente tutti gli ordini nel cestino?', function(){
    var n = carrelliCestino.length;
    carrelliCestino = [];
    _cartTrashSave();
    renderCartTrash();
    renderCartTabs();
    showToastGen('red','🗑️ Eliminati definitivamente ' + n + ' ordini');
  });
}

// ── PERMESSI CARRELLO ────────────────────────────────────────────────────────
function _cartPossoModificare(cart){
  if(!cart) return false;
  var myKey = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.key : null;
  var myRuolo = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.ruolo : 'proprietario';
  if(myRuolo === 'proprietario') return true;
  if(!cart.commesso) return true;
  return cart.commesso === myKey;
}

// Sblocca carrello inviato → torna attivo e rientra in Firebase
function cartUnlock(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  if(!_cartPossoModificare(cart)){
    showToastGen('orange','🔒 Solo il proprietario del carrello può sbloccarlo');
    return;
  }
  console.log('[CART] cartUnlock:', cartId);
  cart.stato = 'modifica';
  cart.locked = false;
  saveCarrelli(); // ora saveCarrelli lo include di nuovo in Firebase perché non è più 'inviato'
  renderCartTabs();
  showToastGen('purple','✏️ Carrello sbloccato — modifica e aggiorna');
}

// ── FORZA ACCESSO CARRELLO — triplo tap ──────────────────────────────────────
var _cartForzaTapTimer = null;
var _cartForzaTapId = null;
var _cartForzaTapCount = 0;

function cartForzaAccesso(cartId){
  if(_cartForzaTapId === cartId){
    _cartForzaTapCount++;
    clearTimeout(_cartForzaTapTimer);
    if(_cartForzaTapCount >= 2){
      _cartForzaTapId = null; _cartForzaTapCount = 0;
      var cart = carrelli.find(function(c){ return c.id === cartId; });
      if(!cart) return;
      var nomeComm = (typeof _roles !== 'undefined' && _roles[cart.commesso])
        ? _roles[cart.commesso].nome : (cart.commesso || 'altro account');
      if(!confirm('⚠️ Forza accesso\n\nCarrello di ' + nomeComm + '.\n\nVuoi prendere il controllo?')) return;
      var chi = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.key : '';
      var chiNome = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.nome : 'Sconosciuto';
      console.warn('[CART] cartForzaAccesso — '+chiNome+' prende controllo da '+nomeComm);
      cart.commesso = chi;
      saveCarrelli();
      renderCartTabs();
      showToastGen('orange','🔓 Accesso forzato — ora sei il proprietario');
      return;
    }
    showToastGen('orange','Ancora un tap per forzare...');
  } else {
    _cartForzaTapId = cartId; _cartForzaTapCount = 0;
    showToastGen('orange','Triplo tap per forzare accesso');
  }
  _cartForzaTapTimer = setTimeout(function(){ _cartForzaTapId=null; _cartForzaTapCount=0; }, 600);
}

// ── ELIMINA CARRELLO IN MODIFICA ────────────────────────────────────────────
// Scollega l'ordine (se esiste ancora) e rimuove il carrello
function eliminaCarrelloModifica(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  showConfirm('Eliminare questo carrello?\nSe esiste un ordine collegato verrà spostato nel cestino.', function(){
    _cartTrashMoveLinkedOrdine(cart);
    // Rimuovi il carrello
    deleteCart(cartId);
  });
}

// ── ELIMINA ORDINE (carrello) ───────────────────────────────────────────────
// Rimuove il carrello corrente, eventuale bozza collegata e consente Annulla/Ripristina.
function eliminaOrdineCarrello(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  if(!_cartPossoModificare(cart)){
    showToastGen('orange','🔒 Non puoi eliminare il carrello di un altro account');
    return;
  }
  showConfirm('Sei sicuro di voler eliminare questo ordine?', function(){
    _takeSnapshot();
    var c = carrelli.find(function(x){ return x.id === cartId; });
    if(!c) return;
    _cartTrashMoveLinkedOrdine(c);
    deleteCart(cartId, '✅ Ordine eliminato');
  });
}
function rinominaCart(idx){
  var cart=carrelli[idx];if(!cart)return;
  activeCartId=cart.id;
  var nuovoNome=prompt('Rinomina cliente:',cart.nome);
  if(nuovoNome&&nuovoNome.trim()){
    cart.nome=nuovoNome.trim();
    saveCarrelli();renderCartTabs();
    showToastGen('green','-- Rinominato: '+cart.nome);
  }
}
