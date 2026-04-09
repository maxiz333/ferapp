// ordini.storico.js - estratto da ordini.js

// --- STORICO ORDINI ARCHIVIATI ---
var _storicoOpen=false;
function toggleStoricoOrdini(){
  _storicoOpen=!_storicoOpen;
  var btn=document.getElementById('ord-f-storico');
  if(btn){
    btn.style.background=_storicoOpen?'#805ad533':'transparent';
    btn.style.borderColor=_storicoOpen?'#805ad5':'#333';
  }
  var listEl=document.getElementById('ord-list');
  if(_storicoOpen){
    renderStoricoOrdini();
    if(listEl) listEl.style.display='none';
  } else {
    var sv=document.getElementById('ord-storico-view');
    if(sv) sv.style.display='none';
    if(listEl) listEl.style.display='';
  }
}
function renderStoricoOrdini(){
  var sv=document.getElementById('ord-storico-view');
  if(!sv){
    sv=document.createElement('div');
    sv.id='ord-storico-view';
    var listEl=document.getElementById('ord-list');
    if(listEl) listEl.parentNode.insertBefore(sv,listEl.nextSibling);
    else return;
  }
  sv.style.display='block';
  var arch=lsGet(ORDK_ARCH)||[];
  if(!arch.length){
    sv.innerHTML='<div style="text-align:center;color:#555;padding:30px;font-size:13px;">Nessun ordine archiviato.<br>Gli ordini completati da 7+ giorni vengono archiviati automaticamente.</div>';
    return;
  }
  var SC={nuovo:'var(--accent)',pronto:'#f6ad55',completato:'#68d391'};
  var h='<div style="padding:8px 0 12px;text-align:center;font-size:12px;font-weight:700;color:#805ad5;">📂 STORICO — '+arch.length+' ordini archiviati</div>';
  arch.forEach(function(ord,ai){
    var nArt=(ord.items||[]).length;
    var tot=0;
    (ord.items||[]).forEach(function(it){tot+=parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);});
    h+='<div style="border:1px solid #2a2a2a;border-radius:10px;margin-bottom:8px;overflow:hidden;border-top:3px solid #805ad5;">';
    h+='<div style="background:#805ad522;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;">';
    h+='<span style="font-size:13px;font-weight:800;color:#d6bcfa;">'+esc(ord.nomeCliente||'—')+'</span>';
    h+='<span style="font-size:11px;color:#805ad5;">'+esc(ord.data||'')+' '+esc(ord.ora||'')+'</span>';
    h+='</div>';
    h+='<div style="padding:8px 12px;">';
    (ord.items||[]).forEach(function(it){
      var pu=parsePriceIT(it.prezzoUnit);
      var q=parseFloat(it.qty||0);
      h+='<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;font-size:12px;">';
      h+='<span style="color:#ccc;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(it.desc||'—')+'</span>';
      h+='<span style="color:#888;margin:0 8px;">x'+q+'</span>';
      h+='<span style="color:var(--accent);font-weight:700;">€'+(pu*q).toFixed(2)+'</span>';
      h+='</div>';
    });
    h+='<div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-weight:900;">';
    h+='<span style="color:#888;font-size:11px;">'+nArt+' articoli</span>';
    h+='<span style="color:#805ad5;font-size:15px;">€'+tot.toFixed(2)+'</span>';
    h+='</div>';
    h+='</div></div>';
  });
  h+='<div style="text-align:center;padding:12px;">';
  h+='<button onclick="clearStorico()" style="padding:6px 16px;border-radius:8px;border:1px solid #e53e3e44;background:transparent;color:#fc8181;font-size:11px;cursor:pointer;">🗑️ Svuota storico</button>';
  h+='</div>';
  sv.innerHTML=h;
}
function clearStorico(){
  showConfirm('Eliminare tutto lo storico archiviato?',function(){
    ordiniArchivio=[];
    lsSet(ORDK_ARCH,[]);
    renderStoricoOrdini();
    showToastGen('purple','Storico svuotato');
  });
}
