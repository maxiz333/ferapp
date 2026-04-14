// --- CLIENTI - PREZZI PERSONALIZZATI ---------------------------
var clienti=lsGet(window.AppKeys.CLIENTI,{});
function saveClienti(){lsSet(window.AppKeys.CLIENTI,clienti);}

function getClienteSconto(nome){
  if(!nome)return 0;
  var key=nome.toLowerCase().trim();
  return clienti[key]&&clienti[key].sconto?clienti[key].sconto:0;
}
function setClienteSconto(nome,sconto){
  if(!nome)return;
  var key=nome.toLowerCase().trim();
  if(!clienti[key])clienti[key]={};
  clienti[key].sconto=parseFloat(sconto)||0;
  clienti[key].nome=nome;
  saveClienti();
}
