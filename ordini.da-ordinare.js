// ordini.da-ordinare.js - estratto da ordini.js

// --- VISTA "DA ORDINARE" — raccoglie tutti gli articoli daOrdinare da carrelli + ordini ---
var _daOrdView=false;

function toggleDaOrdinareView(){
  var btn=document.getElementById('ord-f-daordinare');
  var listEl=document.getElementById('ord-list');
  var daoEl=document.getElementById('ord-daordinare-view');
  if(!daoEl)return;
  if(_daOrdView){
    _daOrdView=false;
    if(btn){btn.style.background='transparent';btn.style.color='#fc8181';}
    daoEl.style.display='none';
    ordCloseSpecialViews();
  } else {
    ordCloseSpecialViews('daordinare');
    _daOrdView=true;
    if(btn){btn.style.background='#e53e3e';btn.style.color='#fff';}
    if(listEl)listEl.style.display='none';
    daoEl.style.display='block';
    _daOrdColorFilter=null;
    renderDaOrdinareView();
  }
}

// Filtro colore per vista "da ordinare" nella tab ordini
var _daOrdColorFilter=null;
function daOrdFilterColor(col){
  col = typeof ctNormalizeHex === 'function' ? (ctNormalizeHex(col) || col) : col;
  _daOrdColorFilter=(_daOrdColorFilter===col)?null:col;
  renderDaOrdinareView();
}
function daOrdResetFiltri(){
  _daOrdColorFilter=null;
  renderDaOrdinareView();
}

function renderDaOrdinareView(forceRender){
  if(typeof daoRenderFornitoreView !== 'function') return;
  daoRenderFornitoreView({
    wrapId: 'ord-daordinare-view',
    activeFilter: _daOrdColorFilter,
    filterCfg: {
      fnFilter: 'daOrdFilterColor',
      fnReset: 'daOrdResetFiltri'
    },
    mode: 'ordini-tab',
    showArchiveSearch: false,
    forceRender: !!forceRender
  });
}
