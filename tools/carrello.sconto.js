// ══ CARRELLO ═══════════════════════════════════════════════════════
// --- SCONTO GLOBALE -------------------------------------------
function openScontoOverlay(){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});
  if(!cart)return;
  document.getElementById('sconto-cliente').textContent='Cliente: '+(cart.nome||'-');
  document.getElementById('sconto-custom').value='';
  document.getElementById('sconto-overlay').classList.add('open');
}
function closeScontoOverlay(){document.getElementById('sconto-overlay').classList.remove('open');}

function applicaScontoRapido(perc){
  _applicaSconto(perc);
  closeScontoOverlay();
}
function applicaScontoCustom(){
  var v=parseFloat(document.getElementById('sconto-custom').value);
  if(!v||v<=0||v>=100){showToastGen('red','Inserisci una percentuale valida');return;}
  _applicaSconto(v);
  closeScontoOverlay();
}
function _applicaSconto(perc){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});
  if(!cart||!(cart.items||[]).length)return;
  cart.scontoGlobale=perc;
  (cart.items||[]).forEach(function(it){
    ensurePrezzoOriginaleDaListino(it, true);
    it.scampolo=true;
    it._scontoApplicato=perc;
    it._scontoTipo='globale';
  });
  saveCarrelli();
  renderCartTabs();
  showToastGen('green','- Sconto '+perc+'% applicato!');
}
function rimuoviScontoGlobale(){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});
  if(!cart)return;
  delete cart.scontoGlobale;
  (cart.items||[]).forEach(function(it){
    if(it._scontoTipo==='globale'){
      it.scampolo=false;it.fineRotolo=false;
      delete it._scontoApplicato;delete it._scontoTipo;
    }
  });
  saveCarrelli();
  renderCartTabs();
  closeScontoOverlay();
  showToastGen('green','- Sconti rimossi');
}
