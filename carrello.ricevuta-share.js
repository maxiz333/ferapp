// --- WHATSAPP SHARE -------------------------------------------
function condividiWhatsApp(items,nomeCliente,totale,nota){
  var msg='- *Ordine - '+esc(nomeCliente||'Cliente')+'*\n';
  msg+='- '+new Date().toLocaleDateString('it-IT')+'\n\n';
  items.forEach(function(it){
    var sub=(_prezzoEffettivo(it)*parseFloat(it.qty||0)).toFixed(2);
    msg+=it.qty+' '+( it.unit||'pz')+' - '+(it.desc||'');
    if(it.codF)msg+=' ['+it.codF+']';
    msg+=' - -'+sub+'\n';
  });
  msg+='\n*TOTALE: - '+totale+'*';
  if(nota)msg+='\n\n- '+nota;
  msg+='\n\n_Ferramenta Rattazzi_';
  var url='https://wa.me/?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
}

// --- STAMPA SCONTRINO ---------------------------------------
function stampaRicevuta(items,nomeCliente,totale,nota){
  var h='';
  h+='<div style="font-size:16px;font-weight:900;text-align:center;margin-bottom:4px;">FERRAMENTA RATTAZZI</div>';
  h+='<div style="font-size:10px;text-align:center;color:#666;margin-bottom:8px;">'+new Date().toLocaleString('it-IT')+'</div>';
  if(nomeCliente)h+='<div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:8px;">Cliente: '+esc(nomeCliente)+'</div>';
  h+='<div style="border-top:1px dashed #555;margin:6px 0;"></div>';
  items.forEach(function(it){
    var pu=parsePriceIT(it.prezzoUnit);
    var q=parseFloat(it.qty||0);
    var sub=(pu*q).toFixed(2);
    h+='<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(it.desc||'')+'</div>';
    if(it.scampolo&&it._scontoApplicato)h+='<div style="font-size:10px;color:var(--accent);">-- Scampolo -'+it._scontoApplicato+'%'+(it._prezzoOriginale?' (era -'+esc(it._prezzoOriginale)+')':'')+'</div>';
    if(it.fineRotolo&&it._scontoApplicato)h+='<div style="font-size:10px;color:#f6ad55;">- Rotolo -'+it._scontoApplicato+'%'+(it._prezzoOriginale?' (era -'+esc(it._prezzoOriginale)+')':'')+'</div>';
    if(it._scaglioneAttivo){
      var rispSc=it._prezzoBase?((parsePriceIT(it._prezzoBase)-pu)*q).toFixed(2):'';
      h+='<div style="font-size:10px;color:#63b3ed;">- -'+(it._scaglioneAttivo.sconto||0)+'% da '+it._scaglioneAttivo.qtaMin+'pz'+(it._prezzoBase?' (era -'+esc(it._prezzoBase)+')':'')+(rispSc&&parseFloat(rispSc)>0?' risparmi -'+rispSc:'')+'</div>';
    }
    h+='<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);">';
    h+='<span>'+q+' '+(it.unit||'pz')+' - -'+(it.prezzoUnit||'0')+'</span>';
    h+='<span style="font-weight:900;color:var(--accent);">-'+sub+'</span>';
    h+='</div>';
    if(it.codF)h+='<div style="font-size:10px;color:#fc8181;">'+esc(it.codF)+'</div>';
    h+='</div>';
  });
  h+='<div style="border-top:1px dashed #555;margin:6px 0;"></div>';
  h+='<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:900;color:var(--accent);padding:4px 0;">';
  h+='<span>TOTALE</span><span>- '+totale+'</span></div>';
  if(nota)h+='<div style="border-top:1px dashed #555;margin:6px 0;"></div><div style="font-size:11px;color:#666;font-style:italic;">'+esc(nota)+'</div>';
  // Mostra in overlay
  var ov=document.getElementById('ricevuta-overlay');
  document.getElementById('ricevuta-body').innerHTML=h;
  ov.classList.add('open');
}
function closeRicevuta(){document.getElementById('ricevuta-overlay').classList.remove('open');}
function printRicevutaContent(){
  var content=document.getElementById('ricevuta-body').innerHTML;
  var w=window.open('','_blank');
  if(!w){
    showToastGen('orange','Abilita i popup per stampare');
    return;
  }
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ricevuta</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{width:80mm;font-family:monospace;font-size:11px;padding:4mm;color:#000;}@media print{@page{size:80mm auto;margin:0;}}</style></head><body>'+content+'<script>setTimeout(function(){window.print();},400);<\/script></body></html>');
  w.document.close();
}
