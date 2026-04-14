// ordini.nota-cart.js - estratto da ordini.js

// --- NOTA ARTICOLO (edit con prompt) --------------------------
function cartEditNota(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  var current = cart.items[idx].nota || '';
  var nuova = prompt('- Nota per: ' + (cart.items[idx].desc || ''), current);
  if(nuova === null) return; // annullato
  cart.items[idx].nota = nuova.trim();
  saveCarrelli();
  renderCartTabs();
  if(nuova.trim()) showToastGen('green', '- Nota salvata');
}
