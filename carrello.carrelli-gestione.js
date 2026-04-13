// --- CARRELLO - NUOVO ---------------------------------------
function newCart(){
  var el=document.getElementById('nc-input');if(el)el.value='';
  var sc=document.getElementById('nc-sconto');if(sc)sc.value='';
  var ind=document.getElementById('nc-indirizzo');if(ind)ind.value='';
  var pv=document.getElementById('nc-piva');if(pv)pv.value='';
  document.getElementById('nc-overlay').classList.add('open');
  setTimeout(function(){if(el)el.focus();},100);
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
  carrelli.push({id:id,nome:nome||('Cliente '+(carrelli.length+1)),
    createdAt:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    dataCreazione:Date.now(),
    creatoAtISO:new Date().toISOString(),
    items:[],
    scontoGlobale:sconto||null});
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
function deleteCart(id, toastMsg){
  var cart=carrelli.find(function(c){return c.id===id;});
  if(!cart)return;
  if(!_cartPossoModificare(cart)){
    showToastGen('orange','🔒 Non puoi eliminare il carrello di un altro account');
    return;
  }
  cart.deletedAt=new Date().toLocaleString('it-IT');
  carrelliCestino.push(cart);lsSet(CART_CK,carrelliCestino);
  carrelli=carrelli.filter(function(c){return c.id!==id;});
  if(activeCartId===id)activeCartId=carrelli.length?carrelli[carrelli.length-1].id:null;
  saveCarrelli();renderCartTabs();
  showToastGen('green', toastMsg != null ? toastMsg : '🗑️ Carrello eliminato');
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
  showConfirm('Eliminare questo carrello?\nSe l\'ordine esiste ancora rimarrà invariato.', function(){
    // Scollega bozza se presente
    if(cart.bozzaOrdId){
      ordini = ordini.filter(function(o){ return o.id !== cart.bozzaOrdId; });
      saveOrdini();
      if(typeof renderOrdini==='function') renderOrdini();
      if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
        window.dispatchEvent(new CustomEvent('sync-orders',{detail:{source:'carrello-delete'}}));
      }
    }
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
    if(c.bozzaOrdId){
      ordini = ordini.filter(function(o){ return o.id !== c.bozzaOrdId; });
      saveOrdini();
      if(typeof renderOrdini==='function') renderOrdini();
      if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
        window.dispatchEvent(new CustomEvent('sync-orders',{detail:{source:'carrello-delete'}}));
      }
    }
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
