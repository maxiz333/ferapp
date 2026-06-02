// ordini.filter-stato.js - estratto da ordini.js

function ordSetStandardHeaderVisible(show){
  var to=document.getElementById('to');
  if(!to)return;
  var toolbar=to.querySelector('.ord-filter-toolbar');
  if(toolbar){
    Array.prototype.forEach.call(toolbar.children,function(el){
      if(el.classList&&el.classList.contains('ord-filter-actions'))return;
      el.style.display=show?'':'none';
    });
  }
  var wday=document.getElementById('ord-weekday-row');
  if(wday)wday.style.display=show?'':'none';
  var search=document.getElementById('ord-main-search-wrap');
  if(!search){
    var s=document.getElementById('ord-search');
    search=s&&s.parentNode?s.parentNode:null;
  }
  if(search)search.style.display=show?'':'none';
}

/** Chiude viste emoji. except: null | 'daordinare' | 'cestino' | 'storico' */
function ordCloseSpecialViews(except){
  except=except||null;
  if(except!=='daordinare'&&typeof _daOrdView!=='undefined'&&_daOrdView){
    _daOrdView=false;
    var dbtn=document.getElementById('ord-f-daordinare');
    if(dbtn){dbtn.style.background='transparent';dbtn.style.color='#fc8181';}
    var daoEl=document.getElementById('ord-daordinare-view');
    if(daoEl)daoEl.style.display='none';
  }
  if(except!=='cestino'&&typeof _cestinoOrdOpen!=='undefined'&&_cestinoOrdOpen){
    _cestinoOrdOpen=false;
    var cb=document.getElementById('ord-f-cestino');
    if(cb){cb.style.background='transparent';cb.style.borderColor='#222';cb.style.color='#444';}
    var cv=document.getElementById('ord-cestino-view');
    if(cv)cv.style.display='none';
  }
  if(except!=='storico'&&typeof _storicoOpen!=='undefined'&&_storicoOpen){
    _storicoOpen=false;
    var sb=document.getElementById('ord-f-storico');
    if(sb){sb.style.background='transparent';sb.style.borderColor='#333';}
    var sv=document.getElementById('ord-storico-view');
    if(sv)sv.style.display='none';
    if(typeof storicoChiudiDettaglio==='function')storicoChiudiDettaglio();
  }
  if(except==='daordinare'||except==='cestino'||except==='storico'){
    ordSetStandardHeaderVisible(false);
  } else {
    ordSetStandardHeaderVisible(true);
    var listEl=document.getElementById('ord-list');
    if(listEl)listEl.style.display='';
  }
}

function filterOrdini(f){
  if(f==='lavorazione') f='nuovo';
  if(f==='bozza') f='nuovo';
  ordCloseSpecialViews();
  ordFiltro=f;
  ['nuovo','pronto','completato','tutti'].forEach(function(x){
    var btn=document.getElementById('ord-f-'+x);if(!btn)return;
    var on=(x===f);
    btn.style.background=on?'var(--accent)':'transparent';
    btn.style.color=on?'#111':'var(--muted)';
    btn.style.borderColor=on?'var(--accent)':'var(--border)';
  });
  renderOrdini();
}
function setStatoOrdine(gi,stato){
  var o=ordini[gi];if(!o)return;
  if(stato==='lavorazione') stato='nuovo';
  console.log('[LOCK] setStatoOrdine — ordine:', o.id, 'nuovo stato:', stato);
  var lockInfo = ordIsLockedByOther(o.id);
  if(lockInfo){
    console.warn('[LOCK] setStatoOrdine — ordine bloccato da:', lockInfo.name, '— cambio stato bloccato');
    showToastGen('orange','🔒 IN LAVORAZIONE — Triplo tap per forzare');
    return;
  }
  if(stato==='completato'){
    ordUnlock(o.id);
    _syncPrezziOrdineAlDB(o);
  } else if(stato==='pronto'){
    ordUnlock(o.id);
  }
  o.stato=stato;
  if(!o.statiLog)o.statiLog={};
  o.statiLog[stato]={ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),data:new Date().toLocaleDateString('it-IT')};
  if(stato==='completato') o.completatoAtISO=new Date().toISOString();
  saveOrdini();renderOrdini();
}

// ── Sync ordine completato → database articoli ───────────────────────────────
// Aggiorna prezzo, qty (scarico), unit nel database per ogni articolo dell'ordine.
// Chiamata sia da setStatoOrdine che da _cassaModeFatto — comportamento identico.
