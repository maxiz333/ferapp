// ordini.scaglione.js - estratto da ordini.js

function ordSetScaglioneQta(gi, ii, val){
  var ord=ordini[gi]; if(!ord||!ord.items[ii]) return;
  var it=ord.items[ii];
  if(ordItemCongelato(it)) return;
  it._scaglioneQta = parseInt(val) || 10;
  if(!ensurePrezzoOriginaleDaListino(it, true)){
    showToastGen('orange','Listino non disponibile');
    return;
  }
  var q = parseFloat(it.qty || 0);
  if(it._scontoApplicato > 0 && q >= it._scaglioneQta){
    it.prezzoUnit = (parsePriceIT(it._prezzoOriginale) * (1 - it._scontoApplicato/100)).toFixed(2);
  } else {
    it.prezzoUnit = it._prezzoOriginale;
  }
  _ordRecalcSave(gi);
}
