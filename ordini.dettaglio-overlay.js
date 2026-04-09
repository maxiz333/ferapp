// ordini.dettaglio-overlay.js - estratto da ordini.js

function openOrdDetail(gi){
  try{
    var ord=ordini[gi];
    if(!ord){console.error('Ordine non trovato indice:',gi);return;}
    _ordDetailId=ord.id;
    _odRender(ord);
    var ov=document.getElementById('ord-detail-overlay');
    if(ov)ov.classList.add('open');
  }catch(e){console.error('openOrdDetail:',e);}
}
function closeOrdDetail(){
  var ov=document.getElementById('ord-detail-overlay');
  if(ov)ov.classList.remove('open');
  _ordDetailId=null;
  renderOrdini();
}
function _odTot(ord){
  return ordTotaleSenzaCongelati(ord);
}
function _odRender(ord){
  try{
    var COLORI={nuovo:'#f5c400',pronto:'#dd6b20',completato:'#38a169'};
    var LABEL={nuovo:'Nuovo',pronto:'Pronto',completato:'Completato'};
    var statoNorm=(ord.stato==='lavorazione')?'nuovo':ord.stato;
    var sc=COLORI[statoNorm]||'#888';
    var el;
    el=document.getElementById('odh-cliente');
    if(el)el.textContent=ord.nomeCliente||'-';
    el=document.getElementById('odh-info');
    if(el)el.textContent=(ord.data||'')+(ord.ora?' - '+ord.ora:'');
    var tot=_odTot(ord);
    el=document.getElementById('odh-totale');
    if(el)el.textContent='- '+tot.toFixed(2);
    el=document.getElementById('odh-stato-badge');
    if(el){el.textContent=LABEL[statoNorm]||statoNorm;el.style.color=sc;}
    el=document.getElementById('ord-detail-stato');
    if(el)el.value=statoNorm||'nuovo';
    el=document.getElementById('ord-detail-nota');
    if(el)el.value=ord.nota||'';
    _odRenderItems(ord);
  }catch(e){console.error('_odRender:',e);}
}
function _odRenderItems(ord){
  var el=document.getElementById('ord-detail-items');
  if(!el)return;
  var h='';
  var idxs=ordineIndiciOrdineDisplay(ord);
  for(var k=0;k<idxs.length;k++){
    var i=idxs[k];
    var it=(ord.items||[])[i];
    if(!it) continue;
    var isFz=ordItemCongelato(it);
    var desc=it.desc||'';
    var qty=parseFloat(it.qty||1);
    var unit=it.unit||'pz';
    var pu=(it.prezzoUnit||'0').toString();
    var sub=(parseFloat(pu.replace(',','.'))*qty).toFixed(2);
    var isSc=it.scampolo||false;
    var isHs=it.hasScaglioni||false;
    var expanded=it._expanded||false;

    if(isFz){
      h+='<div style="opacity:.88;background:#1a1a22;border:1px solid #353540;border-radius:10px;margin-bottom:8px;overflow:hidden;" id="odi-'+i+'">';
      h+='<div style="padding:8px 10px;">';
      h+='<div style="font-size:10px;color:#9ca3af;margin-bottom:6px;font-weight:800;letter-spacing:.3px;">Rimosso dal banco</div>';
      h+='<div style="font-size:13px;font-weight:700;color:#a0a0a8;">'+esc(desc)+'</div>';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;">';
      h+='<span style="color:#888;font-size:12px;">'+qty+' '+esc(unit)+'</span>';
      h+='<span style="color:#444;">×</span>';
      h+='<input type="text" value="'+esc(pu)+'" oninput="odUpd('+i+',\'prezzoUnit\',this.value)" style="width:56px;background:#111;border:1px solid #444;border-radius:6px;color:#63b3ed;font-size:12px;font-weight:700;text-align:right;padding:4px;">';
      h+='<span style="color:#666;font-size:11px;margin-left:auto;">escluso da totale</span>';
      h+='</div></div></div>';
      continue;
    }

    h+='<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:8px;overflow:hidden;" id="odi-'+i+'">';

    // -- RIGA COMPATTA (sempre visibile) --
    h+='<div style="padding:8px 10px;">';

    // Nome articolo (con emoji - se ci sono specs/foto)
    var _odHasInfo=(it.rowIdx!==undefined&&((_idbCache[it.rowIdx])||((magazzino[it.rowIdx]||{}).specs)));
    if(_odHasInfo){
      h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
      h+='<button onclick="mostraFotoSpecifiche('+it.rowIdx+')" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:0;flex-shrink:0;line-height:1;" title="Vedi specifiche">-</button>';
      h+='<input value="'+esc(desc)+'" oninput="odUpd('+i+',\'desc\',this.value)" placeholder="Articolo..." style="background:transparent;border:none;border-bottom:1px solid #2a2a2a;color:var(--text);font-size:13px;font-weight:700;flex:1;outline:none;font-family:inherit;padding:2px 0;">';
      h+='</div>';
    } else {
      h+='<input value="'+esc(desc)+'" oninput="odUpd('+i+',\'desc\',this.value)" placeholder="Articolo..." style="background:transparent;border:none;border-bottom:1px solid #2a2a2a;color:var(--text);font-size:13px;font-weight:700;width:100%;outline:none;font-family:inherit;padding:2px 0;margin-bottom:6px;">';
    }

    // Riga: codici
    h+='<div style="display:flex;gap:6px;margin-bottom:6px;">';
    h+='<input value="'+esc(it.codM||'')+'" oninput="odUpd('+i+',\'codM\',this.value)" placeholder="Cod. articolo" style="flex:1;background:#111;border:1px solid #2a2a2a;border-radius:6px;color:var(--accent);font-size:11px;font-weight:700;padding:4px 7px;outline:none;font-family:inherit;">';
    h+='<input value="'+esc(it.codF||'')+'" oninput="odUpd('+i+',\'codF\',this.value)" placeholder="Cod. fornitore" style="flex:1;background:#111;border:1px solid #2a2a2a;border-radius:6px;color:#fc8181;font-size:11px;font-weight:700;padding:4px 7px;outline:none;font-family:inherit;">';
    h+='</div>';

    // Riga: qt- + unit- + prezzo + subtotale
    h+='<div style="display:flex;align-items:center;gap:6px;">';
    // Qt- -/+
    h+='<div style="display:flex;align-items:center;background:#111;border-radius:7px;border:1px solid #2a2a2a;overflow:hidden;flex-shrink:0;">';
    h+='<button onclick="odDQ('+i+',-1)" style="background:transparent;border:none;color:#aaa;width:26px;height:26px;cursor:pointer;font-size:16px;line-height:1;font-family:inherit;">-</button>';
    h+='<span style="min-width:24px;text-align:center;color:var(--accent);font-size:13px;font-weight:800;" id="odq-'+i+'">'+qty+'</span>';
    h+='<button onclick="odDQ('+i+',1)" style="background:transparent;border:none;color:#aaa;width:26px;height:26px;cursor:pointer;font-size:16px;line-height:1;font-family:inherit;">+</button>';
    h+='</div>';
    // Unit-
    h+='<select onchange="odUpd('+i+',\'unit\',this.value)" style="background:#111;border:1px solid #2a2a2a;border-radius:6px;color:var(--text);font-size:11px;padding:4px 4px;outline:none;font-family:inherit;flex-shrink:0;">';
    ['pz','mt','kg','lt','conf','rot','sc'].forEach(function(u){ h+='<option'+(unit===u?' selected':'')+'>'+u+'</option>'; });
    h+='</select>';
    // Prezzo
    h+='<span style="font-size:10px;color:#444;flex-shrink:0;">-</span>';
    h+='<input type="text" value="'+esc(pu)+'" oninput="odUpd('+i+',\'prezzoUnit\',this.value)" style="width:52px;background:transparent;border:none;border-bottom:1px solid #2a2a2a;color:#63b3ed;font-size:12px;font-weight:700;text-align:right;outline:none;font-family:inherit;padding:1px 2px;flex-shrink:0;">';
    // Subtotale
    h+='<span style="font-size:13px;font-weight:800;color:var(--accent);min-width:44px;text-align:right;flex-shrink:0;" id="ods-'+i+'">-'+sub+'</span>';
    // - rimuovi
    h+='<button onclick="odRmv('+i+')" style="background:transparent;border:none;color:#333;font-size:16px;cursor:pointer;padding:0 2px;flex-shrink:0;transition:color .1s;" onmouseover="this.style.color=\'#e53e3e\'" onmouseout="this.style.color=\'#333\'">-</button>';
    // + espandi
    h+='<button onclick="odToggleExpand('+i+')" style="background:transparent;border:none;color:'+(expanded?'var(--accent)':'#444')+';font-size:18px;cursor:pointer;padding:0 2px;flex-shrink:0;font-weight:900;" title="Mostra pi- campi">'+(expanded?'-':'-')+'</button>';
    h+='</div>';
    h+='</div>'; // fine riga compatta

    // -- SEZIONE ESPANSA (nascosta di default) --
    h+='<div style="display:'+(expanded?'block':'none')+';padding:0 10px 10px;border-top:1px solid #222;" id="odi-exp-'+i+'">';

    // Fornitore
    h+='<div style="margin-top:8px;">';
    h+='<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Fornitore</div>';
    h+='<input value="'+esc(it.fornitore||'')+'" oninput="odUpd('+i+',\'fornitore\',this.value)" placeholder="Nome fornitore..." style="width:100%;background:#111;border:1px solid #2a2a2a;border-radius:6px;color:#e8e8e8;font-size:11px;padding:5px 8px;outline:none;font-family:inherit;">';
    h+='</div>';

    // Specifiche
    h+='<div style="margin-top:6px;">';
    h+='<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Specifiche</div>';
    h+='<input value="'+esc(it.specs||'')+'" oninput="odUpd('+i+',\'specs\',this.value)" placeholder="es. colore, dimensione..." style="width:100%;background:#111;border:1px solid #2a2a2a;border-radius:6px;color:#2dd4bf;font-size:11px;padding:5px 8px;outline:none;font-family:inherit;">';
    h+='</div>';

    // Nota
    h+='<div style="margin-top:6px;">';
    h+='<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Nota</div>';
    h+='<input value="'+esc(it.nota||'')+'" oninput="odUpd('+i+',\'nota\',this.value)" placeholder="nota articolo..." style="width:100%;background:#111;border:1px solid #2a2a2a;border-radius:6px;color:#888;font-size:11px;padding:5px 8px;outline:none;font-family:inherit;">';
    h+='</div>';

    // Badge scampolo + scaglionati
    h+='<div style="display:flex;gap:6px;margin-top:8px;">';
    h+='<button onclick="odToggleScampolo('+i+')" style="padding:5px 10px;border-radius:6px;border:1px solid '+(isSc?'var(--accent)':'#333')+';background:'+(isSc?'rgba(245,196,0,0.15)':'transparent')+';color:'+(isSc?'var(--accent)':'#666')+';font-size:11px;font-weight:700;cursor:pointer;">-- Scampolo</button>';
    h+='<button onclick="odToggleScaglioni('+i+')" style="padding:5px 10px;border-radius:6px;border:1px solid '+(isHs?'#3182ce':'#333')+';background:'+(isHs?'rgba(49,130,206,0.15)':'transparent')+';color:'+(isHs?'#63b3ed':'#666')+';font-size:11px;font-weight:700;cursor:pointer;">- Scaglionati</button>';
    h+='</div>';

    // Form scaglioni (visibile se hasScaglioni)
    if(isHs){
      if(!it.scaglioni) it.scaglioni=[];
      var sgBase=parsePriceIT(it.prezzoUnit);
      h+='<div style="background:#0d1420;border:1px solid #3182ce44;border-radius:8px;padding:8px;margin-top:8px;">';
      h+='<div style="font-size:10px;color:#63b3ed;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">- Prezzi a scaglioni</div>';
      h+='<div style="display:flex;gap:6px;margin-bottom:3px;"><div style="flex:1;font-size:9px;color:#555;text-transform:uppercase;">Da qt-</div><div style="flex:1;font-size:9px;color:#555;text-transform:uppercase;">Sconto %</div><div style="flex:1;font-size:9px;color:#555;text-transform:uppercase;">Prezzo -</div><div style="flex:0 0 24px;"></div></div>';
      for(var si=0;si<it.scaglioni.length;si++){
        var sg=it.scaglioni[si];
        h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">';
        h+='<input type="number" min="1" placeholder="qt-" value="'+esc(String(sg.qtaMin||''))+'" oninput="odUpdScag('+i+','+si+',\'qtaMin\',this.value)" style="flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:#e8e8e8;font-size:12px;font-weight:700;min-width:0;outline:none;">';
        h+='<input type="number" min="0" max="100" placeholder="%" value="'+esc(String(sg.sconto||''))+'" oninput="odUpdScag('+i+','+si+',\'sconto\',this.value)" style="flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:#68d391;font-size:12px;font-weight:700;min-width:0;outline:none;">';
        h+='<input type="text" placeholder="-" value="'+esc(String(sg.prezzo||''))+'" oninput="odUpdScag('+i+','+si+',\'prezzo\',this.value)" style="flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:var(--accent);font-size:12px;font-weight:700;min-width:0;outline:none;">';
        h+='<button onclick="odRmvScag('+i+','+si+')" style="width:24px;height:24px;border-radius:4px;border:none;background:#e53e3e22;color:#e53e3e;font-size:14px;cursor:pointer;flex-shrink:0;">-</button>';
        h+='</div>';
      }
      h+='<button onclick="odAddScag('+i+')" style="width:100%;padding:5px;border-radius:6px;border:1px dashed #3182ce44;background:transparent;color:#3182ce;font-size:11px;font-weight:700;cursor:pointer;margin-top:2px;">+ Aggiungi scaglione</button>';
      h+='</div>';
    }
    h+='</div>'; // fine sezione espansa

    h+='</div>'; // fine card item
  }
  el.innerHTML=h;
}
function odUpd(i,field,val){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[i])return;
  if(ordItemCongelato(ord.items[i])&&field!=='prezzoUnit') return;
  ord.items[i][field]=val;
  if(field==='qty'||field==='prezzoUnit'){
    var pu=(ord.items[i].prezzoUnit||'0').toString().replace(',','.');
    var sub=(parseFloat(pu)*parseFloat(ord.items[i].qty||0)).toFixed(2);
    var elS=document.getElementById('ods-'+i);
    if(elS) elS.textContent=ordItemCongelato(ord.items[i])?'—':'-'+sub;
    var elQ=document.getElementById('odq-'+i);
    if(elQ&&field==='qty')elQ.textContent=val;
    var tot=_odTot(ord);
    var elT=document.getElementById('odh-totale');
    if(elT)elT.textContent='- '+tot.toFixed(2);
  }
  ord.totale=_odTot(ord).toFixed(2);
  saveOrdini();
  _odSyncCartFromOrdIfBozza(ord);
}
function odDQ(i,delta){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[i])return;
  if(ordItemCongelato(ord.items[i])) return;
  var cur=parseFloat(ord.items[i].qty||1);
  var nv=Math.max(1,Math.round(cur+delta));
  ord.items[i].qty=nv;
  // Applica prezzo scaglione se attivo
  _odApplicaScaglione(ord.items[i]);
  var elQ=document.getElementById('odq-'+i);
  if(elQ)elQ.textContent=nv;
  var pu=(ord.items[i].prezzoUnit||'0').toString().replace(',','.');
  var sub=(parseFloat(pu)*nv).toFixed(2);
  var elS=document.getElementById('ods-'+i);
  if(elS)elS.textContent='-'+sub;
  var tot=_odTot(ord);
  var elT=document.getElementById('odh-totale');
  if(elT)elT.textContent='- '+tot.toFixed(2);
  ord.totale=tot.toFixed(2);
  saveOrdini();
  _odSyncCartFromOrdIfBozza(ord);
}
function _odSyncCartFromOrdIfBozza(ord){
  if(!ord||ord.stato!=='bozza') return;
  var cB=carrelli.find(function(x){ return x.bozzaOrdId===ord.id; });
  if(cB){ cB.items=ordItemsSoloAttiviDeep(ord.items); saveCarrelli(); }
}
function _odApplicaScaglione(it){
  if(!it.hasScaglioni || !it.scaglioni || !it.scaglioni.length) return;
  var qty=parseFloat(it.qty)||1;
  var sorted=it.scaglioni.slice().sort((a,b)=>(b.qtaMin||0)-(a.qtaMin||0));
  for(var sg of sorted){
    if(qty>=(sg.qtaMin||0) && sg.prezzo){
      it.prezzoUnit=String(sg.prezzo);
      return;
    }
  }
}
function odRmv(i){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord)return;
  ord.items.splice(i,1);
  ord.totale=_odTot(ord).toFixed(2);
  saveOrdini();
  _odRender(ord);
}
function odToggleExpand(i){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[i]) return;
  ord.items[i]._expanded=!ord.items[i]._expanded;
  _odRenderItems(ord);
}
function odToggleScampolo(i){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[i]) return;
  if(ordItemCongelato(ord.items[i])) return;
  ord.items[i].scampolo=!ord.items[i].scampolo;
  saveOrdini(); _odRenderItems(ord); renderOrdini();
}
function odToggleScaglioni(i){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[i]) return;
  if(ordItemCongelato(ord.items[i])) return;
  ord.items[i].hasScaglioni=!ord.items[i].hasScaglioni;
  if(ord.items[i].hasScaglioni && !ord.items[i].scaglioni) ord.items[i].scaglioni=[];
  saveOrdini(); _odRenderItems(ord); renderOrdini();
}
function odUpdScag(itemIdx, sgIdx, field, val){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[itemIdx]||!ord.items[itemIdx].scaglioni) return;
  var sg=ord.items[itemIdx].scaglioni[sgIdx];
  if(!sg) return;
  var base= parsePriceIT(ord.items[itemIdx].prezzoUnit);
  if(field==='qtaMin') sg.qtaMin=parseFloat(val)||0;
  else if(field==='sconto'){
    sg.sconto=parseFloat(val)||0;
    if(base>0 && sg.sconto>0) sg.prezzo=(base*(1-sg.sconto/100)).toFixed(2);
  } else if(field==='prezzo'){
    sg.prezzo=val;
    var pr=parseFloat(val.replace(',','.'));
    if(base>0 && pr>0) sg.sconto=((1-pr/base)*100).toFixed(1);
  }
  saveOrdini(); _odRenderItems(ord);
}
function odRmvScag(itemIdx, sgIdx){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[itemIdx]||!ord.items[itemIdx].scaglioni) return;
  ord.items[itemIdx].scaglioni.splice(sgIdx,1);
  _odApplicaScaglione(ord.items[itemIdx]);
  saveOrdini(); _odRenderItems(ord);
}
function odAddScag(itemIdx){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord||!ord.items[itemIdx]) return;
  if(!ord.items[itemIdx].scaglioni) ord.items[itemIdx].scaglioni=[];
  ord.items[itemIdx].scaglioni.push({qtaMin:1,sconto:0,prezzo:''});
  saveOrdini(); _odRenderItems(ord);
}
function ordDetailAddItem(){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord)return;
  if(!ord.items)ord.items=[];
  ord.items.push({desc:'',qty:1,unit:'pz',prezzoUnit:'0',scampolo:false,hasScaglioni:false,_expanded:true});
  saveOrdini();
  _odRenderItems(ord);
}
function ordDetailSaveNota(){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord)return;
  var el=document.getElementById('ord-detail-nota');
  if(el)ord.nota=el.value;
  saveOrdini();
}
function ordDetailSetStato(stato){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord)return;
  if(stato==='lavorazione') stato='nuovo';
  ord.stato=stato;
  saveOrdini();
  var SC={nuovo:'#f5c400',pronto:'#dd6b20',completato:'#38a169'};
  var LABEL={nuovo:'Nuovo',pronto:'Pronto',completato:'Completato'};
  var el=document.getElementById('odh-stato-badge');
  if(el){el.textContent=LABEL[stato];el.style.color=SC[stato]||'#888';}
}
function ordDetailElimina(){
  showConfirm('Eliminare questo ordine?', function(){
    var ord=ordini.find(function(o){return o.id===_ordDetailId;});
    if(ord) _rimuoviCarrelloDaOrdine(ord.id);
    ordini=ordini.filter(function(o){return o.id!==_ordDetailId;});
    saveOrdini(); closeOrdDetail(); renderOrdini();
  });
}
function ordDetailStampa(){
  var ord=ordini.find(function(o){return o.id===_ordDetailId;});
  if(!ord)return;
  var w=window.open('','_blank');
  if(!w){showToastGen('red','-- Popup bloccato');return;}
  var tot=_odTot(ord).toFixed(2);
  var righe='';
  (ord.items||[]).forEach(function(it){
    if(ordItemCongelato(it)) return;
    var sub=( parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0)).toFixed(2);
    righe+='<tr><td>'+esc(it.desc||'')+'</td><td style="text-align:center;">'+it.qty+' '+esc(it.unit||'pz')+'</td><td style="text-align:right;">-'+esc(it.prezzoUnit||'0')+'</td><td style="text-align:right;font-weight:bold;">-'+sub+'</td></tr>';
  });
  w.document.write('<html><head><title>Ordine</title><style>body{font-family:Arial;padding:16mm;font-size:11pt;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px 8px;}th{background:#f5f5f5;}.tot{font-size:14pt;font-weight:bold;text-align:right;margin-top:12px;}</style></head><body>');
  w.document.write('<h2>Ordine - '+esc(ord.nomeCliente||'')+'</h2>');
  w.document.write('<p>Data: '+esc(ord.data||'')+' '+esc(ord.ora||'')+(ord.nota?'<br>Nota: '+esc(ord.nota):'')+'</p>');
  w.document.write('<table><tr><th>Articolo</th><th>Qt-</th><th>Prezzo unit.</th><th>Subtotale</th></tr>'+righe+'</table>');
  w.document.write('<div class="tot">TOTALE: - '+tot+'</div></body></html>');
  w.document.close();w.print();
}
