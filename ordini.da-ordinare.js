// ordini.da-ordinare.js - estratto da ordini.js

// --- VISTA "DA ORDINARE" — raccoglie tutti gli articoli daOrdinare da carrelli + ordini ---
var _daOrdView=false;

function toggleDaOrdinareView(){
  _daOrdView=!_daOrdView;
  var btn=document.getElementById('ord-f-daordinare');
  var listEl=document.getElementById('ord-list');
  var daoEl=document.getElementById('ord-daordinare-view');
  if(!daoEl)return;
  if(_daOrdView){
    if(btn){btn.style.background='#e53e3e';btn.style.color='#fff';}
    if(listEl)listEl.style.display='none';
    daoEl.style.display='block';
    _daOrdColorFilter=null;
    renderDaOrdinareView();
  } else {
    if(btn){btn.style.background='transparent';btn.style.color='#fc8181';}
    if(listEl)listEl.style.display='';
    daoEl.style.display='none';
  }
}

// Filtro colore per vista "da ordinare" nella tab ordini
var _daOrdColorFilter=null;
function daOrdFilterColor(col){
  _daOrdColorFilter=(_daOrdColorFilter===col)?null:col;
  renderDaOrdinareView();
}

function renderDaOrdinareView(){
  var wrap=document.getElementById('ord-daordinare-view');
  if(!wrap)return;

  // Raccoglie articoli da ordinare SOLO dai carrelli attivi — identico a renderOrdFor
  var byColor={};
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      if(!it.daOrdinare) return;
      if(!it._ordColore || it._ordColore==='#888888') return;
      var col=it._ordColore;
      if(!byColor[col]) byColor[col]=[];
      byColor[col].push({ it:it, cartNome:cart.nome||'' });
    });
  });

  var forniMap=ctGetForniColore();
  var colorNames={'#e53e3e':'Rosso','#38a169':'Verde','#3182ce':'Blu','#e2c400':'Giallo','#888888':'Senza colore'};

  if(!Object.keys(byColor).length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:#555">'+
      'Nessun articolo da ordinare.<br><small>Usa il tasto ORDINA nelle card del carrello.</small></div>';
    return;
  }

  var h='';

  // Barra filtri colore
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">';
  h+='<span style="font-size:13px;font-weight:900;color:var(--text);">🚚 Da ordinare</span>';
  Object.keys(byColor).forEach(function(col){
    var nome=forniMap[col]||colorNames[col]||col;
    var isOn=(_daOrdColorFilter===col);
    h+='<button onclick="daOrdFilterColor(\''+col+'\')" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:14px;border:2px solid '+(isOn?col:'#333')+';background:'+(isOn?col+'22':'transparent')+';color:'+(isOn?col:'#888')+';font-size:11px;font-weight:800;cursor:pointer;">';
    h+='<span style="width:10px;height:10px;border-radius:50%;background:'+col+';display:inline-block;"></span>';
    h+=esc(nome)+' ('+byColor[col].length+')';
    h+='</button>';
  });
  h+='</div>';

  // Filtra per colore se attivo
  var coloriDaMostrare=Object.keys(byColor);
  if(_daOrdColorFilter && byColor[_daOrdColorFilter]){
    coloriDaMostrare=[_daOrdColorFilter];
  }

  coloriDaMostrare.forEach(function(col){
    var items=byColor[col];
    var colLabel=colorNames[col]||col;
    var fornNome=forniMap[col]||'';

    h+='<div class="cof-group" style="border-color:'+col+'55">';
    h+='<div class="cof-header" style="border-color:'+col+'">';
    h+='<span class="cof-dot" style="background:'+col+'"></span>';
    h+='<span class="cof-color-label">'+colLabel+'</span>';
    h+='<input class="cof-forn-inp" value="'+esc(fornNome)+'" placeholder="Nome fornitore..." '+
       'oninput="ctSaveFornNome(\''+col+'\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()">';
    h+='<span class="cof-count">'+items.length+' art.</span>';
    h+='</div>';

    items.forEach(function(entry){
      var it=entry.it;
      var codM=it.codM?(String(it.codM).match(/^\d+$/)?String(it.codM).padStart(7,'0'):it.codM):'';
      var sub=(parsePriceIT(it.prezzoUnit)*(parseFloat(it.qty)||0)).toFixed(2);
      h+='<div class="cof-row">';
      if(it.foto) h+='<img class="cof-thumb" src="'+it.foto+'" alt="" onclick="apriModalFoto(this.src)">';
      else h+='<div class="cof-thumb cof-thumb--empty">📦</div>';
      h+='<div class="cof-info">';
      h+='<div class="cof-nome">'+esc(it.desc||'—')+'</div>';
      h+='<div class="cof-meta">';
      if(codM) h+='<span>Cod.Mag: <b>'+esc(codM)+'</b></span> ';
      if(it.codF) h+='<span>Cod.Forn: <b>'+esc(it.codF)+'</b></span> ';
      h+='<span>Cart: <b>'+esc(entry.cartNome)+'</b></span>';
      h+='</div>';
      if(it.nota) h+='<div class="cof-nota">📝 '+esc(it.nota)+'</div>';
      h+='</div>';
      h+='<div class="cof-right">';
      h+='<div class="cof-qty">'+(parseFloat(it.qty)||0)+' '+(it.unit||'pz')+'</div>';
      h+='<div class="cof-sub">€'+sub+'</div>';
      h+='</div>';
      h+='</div>';
    });

    h+='</div>';
  });

  wrap.innerHTML=h;
}
