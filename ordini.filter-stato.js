// ordini.filter-stato.js - estratto da ordini.js

function filterOrdini(f){
  // Chiudi vista "da ordinare"
  if(_daOrdView){
    _daOrdView=false;
    var dbtn=document.getElementById('ord-f-daordinare');
    if(dbtn){dbtn.style.background='transparent';dbtn.style.color='#fc8181';}
    var listEl=document.getElementById('ord-list');if(listEl)listEl.style.display='';
    var daoEl=document.getElementById('ord-daordinare-view');if(daoEl)daoEl.style.display='none';
  }
  // Chiudi cestino
  if(_cestinoOrdOpen){
    _cestinoOrdOpen=false;
    var cb=document.getElementById('ord-f-cestino');
    if(cb){cb.style.background='transparent';cb.style.borderColor='#222';cb.style.color='#444';}
    var cv=document.getElementById('ord-cestino-view');if(cv)cv.style.display='none';
    var ll=document.getElementById('ord-list');if(ll)ll.style.display='';
  }
  // Chiudi storico
  if(_storicoOpen){
    _storicoOpen=false;
    var sb=document.getElementById('ord-f-storico');
    if(sb){sb.style.background='transparent';sb.style.borderColor='#333';}
    var sv=document.getElementById('ord-storico-view');if(sv)sv.style.display='none';
    var ll2=document.getElementById('ord-list');if(ll2)ll2.style.display='';
  }
  ordFiltro=f;
  ['nuovo','lavorazione','pronto','completato','tutti'].forEach(function(x){
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
