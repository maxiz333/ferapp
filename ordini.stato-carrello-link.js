// ordini.stato-carrello-link.js - estratto da ordini.js

function ordSetNuovo(gi){ setStatoOrdine(gi,'nuovo'); }
function ordSetFatto(gi){ setStatoOrdine(gi,'completato'); }

/** Carrelli collegati a ord.id (ordId o bozzaOrdId). */
function _carrelliCollegatiOrdine(ordId){
  if(!ordId || typeof carrelli === 'undefined' || !carrelli) return [];
  return carrelli.filter(function(c){
    return c && (c.ordId === ordId || c.bozzaOrdId === ordId);
  });
}

/**
 * Allinea carrello collegato dopo invio/Fatto: inviato + bloccato, niente CONFERMA.
 * Ritorna true se almeno un carrello è stato aggiornato.
 */
function allineaCarrelloOrdineCollegato(ord){
  if(!ord || !ord.id || typeof carrelli === 'undefined') return false;
  var changed = false;
  _carrelliCollegatiOrdine(ord.id).forEach(function(cart){
    if(cart.bozzaOrdId === ord.id) delete cart.bozzaOrdId;
    if(cart.ordId !== ord.id) cart.ordId = ord.id;
    if(cart.stato !== 'inviato'){
      cart.stato = 'inviato';
      changed = true;
    }
    if(!cart.locked){
      cart.locked = true;
      changed = true;
    }
  });
  if(changed){
    if(typeof saveCarrelli === 'function') saveCarrelli();
    if(typeof renderCartTabs === 'function') renderCartTabs();
  }
  return changed;
}

/** Alias usato quando l'ordine passa a completato/Fatto. */
function allineaCarrelloOrdineCompletato(ord){
  return allineaCarrelloOrdineCollegato(ord);
}

/**
 * Blocca un secondo inviaOrdine se l'ordine collegato esiste già (inviato o Fatto).
 * Ritorna messaggio italiano da mostrare, oppure null se l'invio può procedere.
 */
function inviaOrdineBloccaSeDuplicato(cart){
  if(!cart || typeof ordini === 'undefined' || !ordini) return null;
  var ord = null;
  if(cart.ordId){
    ord = ordini.find(function(o){ return o && o.id === cart.ordId; });
  }
  if(!ord && cart.bozzaOrdId){
    ord = ordini.find(function(o){ return o && o.id === cart.bozzaOrdId; });
  }
  if(!ord) return null;
  var st = (ord.stato === 'lavorazione') ? 'nuovo' : String(ord.stato || '');
  if(st === 'bozza') return null;
  allineaCarrelloOrdineCollegato(ord);
  var num = ord.numero ? (' #' + ord.numero) : '';
  if(st === 'completato'){
    return 'Ordine già completato (Fatto)' + num + '. Non è stato creato un duplicato.';
  }
  if(st === 'nuovo' || st === 'pronto'){
    return 'Ordine già inviato' + num + '. Non è stato creato un duplicato.';
  }
  return null;
}

/** Carrello collegato a ordine/bozza (ordId o bozzaOrdId). */
function linkedCartForOrdine(ord){
  if(!ord || !ord.id || typeof carrelli === 'undefined' || !carrelli) return null;
  var byOrdId = carrelli.find(function(c){ return c && c.ordId === ord.id; });
  if(byOrdId) return byOrdId;
  return carrelli.find(function(c){ return c && c.bozzaOrdId === ord.id; }) || null;
}

/** Copia righe ordine → carrello collegato (prezzo, qty, …). Anche ordini nuovo/pronto/inviato. */
function syncOrdineItemsToLinkedCart(ord){
  if(!ord || typeof ordItemsSoloAttiviDeep !== 'function') return false;
  var cart = linkedCartForOrdine(ord);
  if(!cart) return false;
  cart.items = ordItemsSoloAttiviDeep(ord.items);
  cart.ultimaModificaISO = new Date().toISOString();
  if(typeof saveCarrelli === 'function') saveCarrelli();
  if(typeof renderCartTabs === 'function') renderCartTabs();
  return true;
}

/** Dopo merge Firebase ordini: propaga ordine→carrello se una versione remota è cambiata. */
function cartSyncCarrelliDopoMergeOrdiniRemote(localBefore, merged){
  if(!localBefore || !merged || typeof syncOrdineItemsToLinkedCart !== 'function') return;
  var beforeById = {};
  localBefore.forEach(function(o){ if(o && o.id) beforeById[o.id] = o; });
  merged.forEach(function(ord){
    if(!ord || !ord.id) return;
    var prev = beforeById[ord.id];
    if(prev && JSON.stringify(prev) === JSON.stringify(ord)) return;
    syncOrdineItemsToLinkedCart(ord);
  });
}

function _rimuoviCarrelloDaOrdine(ordId){
  var idx=carrelli.findIndex(function(c){return c.ordId===ordId;});
  if(idx===-1) return;
  var cart=carrelli[idx];
  cart.deletedAt=new Date().toLocaleString('it-IT');
  carrelliCestino.push(cart);
  lsSet(CART_CK, carrelliCestino);
  carrelli.splice(idx,1);
  if(activeCartId===cart.id) activeCartId=carrelli.length?carrelli[carrelli.length-1].id:null;
  saveCarrelli();
  renderCartTabs();
}
