// ordini.cassa.js - estratto da ordini.js

// --- VISTA CASSA (fullscreen per tablet/schermo cassa) -------
var _cassaOrdId=null;

function openCassa(gi){
  var ord=ordini[gi];
  if(!ord)return;
  _cassaOrdId=ord.id;
  document.getElementById('cassa-cliente').textContent=ord.nomeCliente||'Cliente';
  var infoTxt=(ord.numero?'Ordine #'+ord.numero+' - ':'')+ord.data+' '+ord.ora;
  if(ord.commesso)infoTxt+=' - - '+ord.commesso;
  document.getElementById('cassa-info').textContent=infoTxt;
  document.getElementById('cassa-info').style.fontSize='11px';
  document.getElementById('cassa-cliente').style.fontSize='18px';
  var tot=0;
  var itemsCassa=(ord.items||[]).filter(function(it){ return !ordItemCongelato(it); });
  var nItems=itemsCassa.length;
  var bodyH='';
  itemsCassa.forEach(function(it,i){
    var pu=parsePriceIT(it.prezzoUnit);
    var q=parseFloat(it.qty||0);
    var sub=(pu*q).toFixed(2);
    tot+=pu*q;
    bodyH+='<div class="cassa-item" style="gap:10px;">';
    bodyH+='<div style="flex:1;min-width:0;">';
    bodyH+='<div style="font-size:14px;font-weight:700;color:var(--text);">'+esc(it.desc||'')+'</div>';
    bodyH+='<div style="font-size:11px;color:var(--muted);margin-top:2px;">';
    if(it.codM)bodyH+='<span style="color:var(--accent);font-weight:700;">'+esc(it.codM)+'</span> ';
    if(it.codF)bodyH+='<span style="color:#fc8181;">'+esc(it.codF)+'</span>';
    if(it.nota)bodyH+='<div style="padding:3px 8px;margin-top:2px;background:#2a1800;border-left:3px solid #f6ad55;border-radius:3px;font-size:10px;color:#f6ad55;font-weight:600;">- '+esc(it.nota)+'</div>';
    bodyH+='</div>';
    if(it.scampolo)bodyH+='<div style="font-size:10px;color:var(--accent);font-weight:700;margin-top:1px;">-- SCAMPOLO</div>';
    bodyH+='</div>';
    bodyH+='<div style="text-align:right;flex-shrink:0;">';
    bodyH+='<div style="font-size:16px;font-weight:900;color:var(--accent);">- '+sub+'</div>';
    bodyH+='<div style="font-size:11px;color:var(--muted);">'+q+' '+(it.unit||'pz')+' - -'+esc(it.prezzoUnit)+'</div>';
    bodyH+='</div>';
    bodyH+='</div>';
  });
  if(ord.nota){
    bodyH+='<div style="padding:8px 0;font-size:12px;color:#666;font-style:italic;border-top:1px solid #222;margin-top:6px;">- '+esc(ord.nota)+'</div>';
  }
  document.getElementById('cassa-body').innerHTML=bodyH;
  document.getElementById('cassa-totale').textContent='- '+tot.toFixed(2);
  document.getElementById('cassa-totale').style.fontSize='28px';
  document.getElementById('cassa-n-art').textContent=nItems+' articoli'+(ord.scontoGlobale?' - - -'+ord.scontoGlobale+'%':'');
  var fattoBtn=document.getElementById('cassa-fatto-btn');
  fattoBtn.style.fontSize='14px';
  fattoBtn.style.padding='12px 22px';
  fattoBtn.onclick=function(){
    var o=ordini.find(function(x){return x.id===_cassaOrdId;});
    if(o){
      if(o.id && typeof ordUnlock === 'function') ordUnlock(o.id);
      o.stato='completato';
      if(!o.statiLog)o.statiLog={};
      o.statiLog.completato={ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),data:new Date().toLocaleDateString('it-IT')};
      saveOrdini();
    }
    closeCassa();
    renderOrdini();
    showToastGen('green','- Ordine completato!');
  };
  document.getElementById('cassa-overlay').classList.add('open');
}

function closeCassa(){
  document.getElementById('cassa-overlay').classList.remove('open');
  _cassaOrdId=null;
}
