// ordini.poll-counter.js - estratto da ordini.js

// --- AUTO-REFRESH ORDINI (polling localStorage ogni 5s) -------
var _autoRefreshInterval=null;
var _lastOrdiniJson='';

var _bozzaBadgeLast = -1; // -1 = primo avvio, non notificare
function _updateBozzaBadge(){
  var nBozze=ordini.filter(function(o){return o.stato==='bozza';}).length;
  // Notifica solo se arrivano bozze NUOVE (non al primo avvio)
  if(_bozzaBadgeLast >= 0 && nBozze > _bozzaBadgeLast){
    var toTab=document.getElementById('to');
    var tabAttiva = toTab && toTab.classList.contains('active');
    if(!tabAttiva){
      var tbbTo=document.getElementById('tbb-to');
      if(tbbTo){ tbbTo.style.color='#63b3ed'; setTimeout(function(){tbbTo.style.color='';},3000); }
    }
  }
  _bozzaBadgeLast = nBozze;
  // Badge 📡 sul tasto tab ordini nella bottom bar
  var bb=document.getElementById('bozza-badge');
  if(!bb){
    var tbbTo=document.getElementById('tbb-to');
    if(tbbTo){
      bb=document.createElement('span');
      bb.id='bozza-badge';
      bb.style.cssText='background:#3182ce;color:#fff;border-radius:8px;padding:1px 5px;font-size:9px;margin-left:2px;';
      tbbTo.appendChild(bb);
    }
  }
  if(bb){
    bb.textContent= nBozze>0 ? '📡'+nBozze : '';
    bb.style.display= nBozze>0 ? '' : 'none';
  }
}

function startAutoRefresh(){
  _lastOrdiniJson=JSON.stringify(ordini);
  _updateBozzaBadge(); // controlla subito all'avvio
  _autoRefreshInterval=setInterval(function(){
    var fresh=lsGet(ORDK,[]);
    var freshJson=JSON.stringify(fresh);
    if(freshJson!==_lastOrdiniJson){
      var prevJson=_lastOrdiniJson;
      var prev=JSON.parse(prevJson)||[];
      var prevBozze=prev.filter(function(o){return o.stato==='bozza';}).length;
      var prevNuovi=prev.filter(function(o){return o.stato==='nuovo';}).length;
      _lastOrdiniJson=freshJson;
      ordini=fresh;
      updateOrdBadge();
      updateOrdCounter();
      _updateBozzaBadge();
      // Se la tab ordini è visibile, aggiorna
      var toTab=document.getElementById('to');
      if(toTab&&toTab.classList.contains('active')){
        renderOrdini();
        // Rileva bozze aggiornate (stessa quantità ma contenuto diverso)
        var freshBozzeIds=fresh.filter(function(o){return o.stato==='bozza';}).map(function(o){return o.id;});
        var prevBozzeMap={};
        prev.filter(function(o){return o.stato==='bozza';}).forEach(function(o){prevBozzeMap[o.id]=JSON.stringify(o);});
        freshBozzeIds.forEach(function(bid){
          var fb=fresh.find(function(o){return o.id===bid;});
          if(fb && prevBozzeMap[bid] && prevBozzeMap[bid]!==JSON.stringify(fb)){
            if(typeof mostraBozzaAggiornata === 'function') mostraBozzaAggiornata(fb);
          }
        });
      } else {
        // Tab non attiva: badge e notifica gestiti da _updateBozzaBadge()
        var nuoveBozze=fresh.filter(function(o){return o.stato==='bozza';}).length;
        if(nuoveBozze>prevBozze){
          var tbbTo=document.getElementById('tbb-to');
          if(tbbTo){
            tbbTo.style.color='#63b3ed';
            setTimeout(function(){tbbTo.style.color='';},3000);
          }
          // Notifica browser + modal per bozza
          var bozzeArr=fresh.filter(function(o){return o.stato==='bozza';});
          if(bozzeArr.length && typeof mostraNotificaBozza === 'function'){
            mostraNotificaBozza(bozzeArr[0]);
          }
        }
      }
      // Notifica sonora per nuovi ordini normali
      var nuovi=fresh.filter(function(o){return o.stato==='nuovo';}).length;
      if(nuovi>prevNuovi){
        feedbackSend();
      }
    }
  },5000);
}

// --- CONTATORE ORDINI IN ATTESA -------------------------------
var _lastBozzeCount = 0;
function updateOrdCounter(){
  _updateBozzaBadge();
  // Se arrivano bozze nuove via Firebase sync, aggiorna il render
  var curBozze = ordini.filter(function(o){ return o.stato==='bozza'; }).length;
  if(curBozze !== _lastBozzeCount){
    _lastBozzeCount = curBozze;
    var toTab = document.getElementById('to');
    if(toTab && toTab.classList.contains('active') && !document.querySelector('.ord-inline-input')){
      renderOrdini();
    }
  }
  var banner=document.getElementById('ord-counter-banner');
  if(!banner)return;

  // Mostra solo il contatore dello stato filtrato attivo
  var count=0;
  var label='';
  var color='';
  var bg='';
  var border='';
  var icon='';

  if(ordFiltro==='nuovo'){
    count=ordini.filter(function(o){return o.stato==='nuovo'||o.stato==='bozza';}).length;
    label='Nuov'+(count===1?'o':'i'); icon='🆕'; color='var(--accent)'; bg='linear-gradient(135deg,#1a1a00,#2a2a00)'; border='2px solid var(--accent)';
  } else if(ordFiltro==='lavorazione'){
    count=ordini.filter(function(o){return o.stato==='lavorazione';}).length;
    label='In corso'; icon='⏳'; color='#63b3ed'; bg='#0d1a2a'; border='1px solid #3182ce44';
  } else if(ordFiltro==='pronto'){
    count=ordini.filter(function(o){return o.stato==='pronto';}).length;
    label='Pront'+(count===1?'o':'i'); icon='📦'; color='#f6ad55'; bg='#1a1500'; border='1px solid #dd6b2044';
  } else if(ordFiltro==='completato'){
    count=ordini.filter(function(o){return o.stato==='completato';}).length;
    label='Fatt'+(count===1?'o':'i'); icon='✅'; color='#68d391'; bg='#0d1a0d'; border='1px solid #38a16944';
  } else {
    // "tutti" — nessun contatore
    banner.style.display='none';
    var fc=document.getElementById('ord-filter-count');
    if(fc){ fc.textContent=ordini.length; }
    return;
  }

  if(count===0){
    banner.style.display='none';
  } else {
    banner.style.display='block';
    banner.innerHTML=
      '<div style="display:flex;justify-content:center;">' +
      '<div style="background:'+bg+';border:'+border+';border-radius:12px;padding:10px 24px;text-align:center;min-width:100px;">' +
      '<div style="font-size:28px;font-weight:900;color:'+color+';">'+count+'</div>' +
      '<div style="font-size:10px;color:'+color+';font-weight:700;text-transform:uppercase;letter-spacing:.5px;">'+icon+' '+label+'</div>' +
      '</div></div>';
  }

  // Contatore filtrato accanto al titolo
  var fc=document.getElementById('ord-filter-count');
  if(fc){
    fc.textContent=count;
  }
}
