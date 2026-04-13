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
function daOrdResetFiltri(){
  _daOrdColorFilter=null;
  renderDaOrdinareView();
}

function renderDaOrdinareView(){
  var wrap=document.getElementById('ord-daordinare-view');
  if(!wrap)return;

  var byColor=typeof daoCollectDaOrdinareByColor==='function'?daoCollectDaOrdinareByColor():{};
  var forniMap=ctGetForniColore();

  var h='';
  h+='<div style="font-size:13px;font-weight:900;color:var(--text);margin-bottom:8px;">🚚 Da ordinare</div>';
  if(typeof ctHtmlBarraFiltriFornitore==='function'){
    h+=ctHtmlBarraFiltriFornitore(byColor,_daOrdColorFilter,{ fnFilter:'daOrdFilterColor', fnReset:'daOrdResetFiltri' });
  }

  if(!Object.keys(byColor).length){
    h+='<div style="text-align:center;padding:28px;color:#555">'+
      'Nessun articolo da ordinare.<br><small>Usa il tasto ORDINA nelle card del carrello.</small></div>';
    h+=typeof daoHtmlBloccoStoricoRecente==='function'?daoHtmlBloccoStoricoRecente():'';
    wrap.innerHTML=h;
    return;
  }

  var coloriDaMostrare=_daOrdColorFilter?[_daOrdColorFilter]:(
    typeof _daoSortedKeysForDisplay==='function'?_daoSortedKeysForDisplay(byColor):Object.keys(byColor)
  );

  coloriDaMostrare.forEach(function(col){
    var items=byColor[col]||[];
    var fornNome=(forniMap[col]&&String(forniMap[col]).trim())?String(forniMap[col]).trim():'';
    var titoloSlot=typeof ctEtichettaFornitore==='function'?ctEtichettaFornitore(col):col;

    h+='<div class="ord-dao-group" style="border-color:'+col+'55">';
    h+='<div class="ord-dao-header" style="border-color:'+col+'">';
    h+='<span class="ord-dao-dot" style="background:'+col+'" title="'+esc(titoloSlot)+'"></span>';
    h+='<input class="ord-dao-forn-inp ord-dao-forn-inp--title" value="'+esc(fornNome)+'" '+
       'placeholder="'+esc(titoloSlot)+'" title="Nome fornitore (salvato)" '+
       'oninput="ctSaveFornNome(\''+col+'\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()">';
    h+='<span class="ord-dao-count">'+items.length+' art.</span>';
    h+='<button type="button" onclick="daoArchiviaColoreGruppo(\''+col+'\')" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid #38a16944;background:#38a16922;color:#68d391;font-size:10px;font-weight:800;cursor:pointer;">Archivia ordinato</button>';
    h+='</div>';

    if(!items.length){
      h+='<div class="ord-dao-empty-msg">Nessun articolo per questo fornitore.</div>';
      h+='</div>';
      return;
    }

    items.forEach(function(entry){
      var it=entry.it;
      var codM=it.codM?(String(it.codM).match(/^\d+$/)?String(it.codM).padStart(7,'0'):it.codM):'';
      var sub=(parsePriceIT(it.prezzoUnit)*(parseFloat(it.qty)||0)).toFixed(2);
      var showFornRow=it._ordFornitoreNome&&String(it._ordFornitoreNome).trim()&&
        String(it._ordFornitoreNome).trim()!==String(titoloSlot).trim();
      h+='<div class="ord-dao-row">';
      if(it.foto) h+='<img class="ord-dao-thumb" src="'+it.foto+'" alt="" onclick="apriModalFoto(this.src)">';
      else h+='<div class="ord-dao-thumb ord-dao-thumb--empty">📦</div>';
      h+='<div class="ord-dao-info">';
      h+='<div class="ord-dao-nome">'+esc(it.desc||'—')+'</div>';
      if(showFornRow) h+='<div class="ord-dao-forn-alt">Fornitore: '+esc(it._ordFornitoreNome)+'</div>';
      h+='<div class="ord-dao-meta">';
      if(codM) h+='<span>Cod.Mag: <b>'+esc(codM)+'</b></span> ';
      if(it.codF) h+='<span>Cod.Forn: <b>'+esc(it.codF)+'</b></span> ';
      h+='<span>Cart: <b>'+esc(entry.cartNome)+'</b></span>';
      h+='</div>';
      if(it.nota) h+='<div class="ord-dao-nota">📝 '+esc(it.nota)+'</div>';
      h+='</div>';
      h+='<div class="ord-dao-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">';
      h+='<button type="button" class="dao-btn-cestino" onclick="daoRipulisciVoceDaOrdinare(\''+entry.cartId+'\','+entry.idx+')" title="Togli da da ordinare">\uD83D\uDDD1\uFE0F</button>';
      h+='<div class="ord-dao-qty">'+(parseFloat(it.qty)||0)+' '+(it.unit||'pz')+'</div>';
      h+='<div class="ord-dao-sub">€'+sub+'</div>';
      h+='</div>';
      h+='</div>';
    });

    h+='</div>';
  });

  h+=typeof daoHtmlBloccoStoricoRecente==='function'?daoHtmlBloccoStoricoRecente():'';
  wrap.innerHTML=h;
}
