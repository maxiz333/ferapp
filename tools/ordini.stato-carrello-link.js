// ordini.stato-carrello-link.js - estratto da ordini.js

function ordSetNuovo(gi){ setStatoOrdine(gi,'nuovo'); }
function ordSetFatto(gi){ setStatoOrdine(gi,'completato'); }
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
