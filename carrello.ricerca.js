// --- RICERCA CARRELLO (intelligente con ranking) ---------------
var _cartSearchTimer = null;
function renderCartSearch(){
  // Debounce: evita calcoli su ogni keystroke su cataloghi grandi
  if(_cartSearchTimer) clearTimeout(_cartSearchTimer);
  _cartSearchTimer = setTimeout(_doCartSearch, 120);
}
function _doCartSearch(){
  var q=(document.getElementById('cart-search')||{}).value||'';
  var res=document.getElementById('cart-search-results');if(!res)return;
  if(!q||q.trim().length<2){res.innerHTML='';return;}
  // Database non ancora caricato: avvisa l'utente
  if(!rows||!rows.length){
    res.innerHTML='<div style="padding:12px;color:var(--accent);font-size:13px;text-align:center;">⏳ Database in caricamento, attendi...</div>';
    return;
  }
  var matches=[];
  var qLow=q.toLowerCase();
  var qWords=qLow.split(/\s+/).filter(function(w){return w.length>0;});
  rows.forEach(function(r,i){
    if(!r)return;
    if(removed.has(String(i)))return;
    var m=magazzino[i]||{};
    // Protezione: codF e codM possono essere null/undefined/number
    var codF=String(r.codF||'');
    var codM=String(r.codM||'');
    // Early-exit: ogni parola della query deve essere presente nel testo
    var text=[r.desc,codF,codM,m.marca,m.specs].join(' ').toLowerCase();
    var ok=true;
    for(var w=0;w<qWords.length;w++){
      if(text.indexOf(qWords[w])<0){ok=false;break;}
    }
    if(!ok) return;
    var score=fuzzyScore(q,text);
    if(score>=50)matches.push({r:r,i:i,m:m,score:score});
  });
  // Ordina per score decrescente (migliori in cima)
  matches.sort(function(a,b){return b.score-a.score;});
  if(!matches.length){res.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px;">Nessun risultato per "'+esc(q)+'"</div>';return;}
  var h='<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:300px;overflow-y:auto;">';
  matches.slice(0,15).forEach(function(x){
    var r=x.r,i=x.i,m=x.m;
    var qty=m.qty!==undefined&&m.qty!==''?m.qty:'';
    h+='<div style="padding:10px 12px;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;align-items:center;gap:10px;">';
    h+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(r.desc)+'</div>';
    h+='<div style="font-size:10px;margin-top:2px;">';
    if(r.codF)h+='<span style="color:#fc8181;font-weight:600;">'+esc(r.codF)+'</span> ';
    if(r.codM)h+='<span style="color:var(--accent);font-weight:600;">'+esc(r.codM)+'</span>';
    if(m.marca)h+=' <span style="color:var(--muted);">- '+esc(m.marca)+'</span>';
    h+='</div>';
    if(qty!=='')h+='<div style="font-size:10px;color:#555;margin-top:1px;">Stock: '+qty+' '+(m.unit||'pz')+'</div>';
    if(m.posizione)h+='<div style="font-size:10px;color:#63b3ed;margin-top:1px;">- '+esc(m.posizione)+'</div>';
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">';
    h+='<div style="font-size:15px;font-weight:900;color:var(--accent);">- '+esc(r.prezzo)+'</div>';
    h+='<button onclick="cartAddItem('+i+')" style="padding:6px 16px;border-radius:8px;border:none;background:#38a169;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">+ Aggiungi</button>';
    h+='</div></div>';
  });
  if(matches.length>15)h+='<div style="font-size:10px;color:#555;text-align:center;padding:6px;">...e altri '+(matches.length-15)+'</div>';
  h+='</div>';
  res.innerHTML=h;
}

// --- STORICO CLIENTE ---------------------------------------
function getStoricoCliente(nomeCliente){
  if(!nomeCliente)return[];
  var nome=nomeCliente.toLowerCase().trim();
  return ordini.filter(function(o){
    return(o.nomeCliente||'').toLowerCase().trim()===nome;
  }).slice(0,5);
}
