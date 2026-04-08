// ordini.calendario.js - estratto da ordini.js

// --- CALENDARIO STORICO ORDINI ---
function toggleOrdCalendario(){
  var cal=document.getElementById('ord-calendario');
  var btn=document.getElementById('ord-cal-btn');
  if(!cal)return;
  var show=cal.style.display==='none';
  cal.style.display=show?'block':'none';
  if(btn){
    btn.style.borderColor=show?'var(--accent)':'#555';
    btn.style.color=show?'var(--accent)':'#aaa';
  }
  if(show){
    var inp=document.getElementById('ord-cal-date');
    if(inp && !inp.value) inp.value=new Date().toISOString().slice(0,10);
    renderOrdiniByDate();
  }
}
function chiudiOrdCalendario(){
  var cal=document.getElementById('ord-calendario');
  var btn=document.getElementById('ord-cal-btn');
  if(cal) cal.style.display='none';
  if(btn){btn.style.borderColor='#555';btn.style.color='#aaa';}
}
function ordCalOggi(){
  var inp=document.getElementById('ord-cal-date');
  if(inp) inp.value=new Date().toISOString().slice(0,10);
  renderOrdiniByDate();
}

function _getOrdDataISO(ord){
  // Prova dataISO diretto
  if(ord.dataISO) return ord.dataISO;
  // Fallback: ricava da createdAt (ISO string)
  if(ord.createdAt) return ord.createdAt.slice(0,10);
  // Fallback: ricava da data italiana "dd/mm/yyyy"
  if(ord.data){
    var p=ord.data.split('/');
    if(p.length===3) return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');
  }
  return '';
}

function renderOrdiniByDate(){
  var wrap=document.getElementById('ord-cal-results');
  if(!wrap)return;
  var inp=document.getElementById('ord-cal-date');
  var selDate=inp?inp.value:'';
  if(!selDate){wrap.innerHTML='';return;}

  var filtered=ordini.filter(function(o){
    return _getOrdDataISO(o)===selDate;
  });

  if(!filtered.length){
    // Formatta data per messaggio
    var dp=selDate.split('-');
    var label=dp[2]+'/'+dp[1]+'/'+dp[0];
    wrap.innerHTML='<div style="text-align:center;padding:30px 16px;color:#555;font-size:13px;">'+
      '<div style="font-size:32px;margin-bottom:8px;">📅</div>'+
      'Nessun ordine trovato per il <b style="color:#888;">'+label+'</b></div>';
    return;
  }

  var SC={nuovo:'#f5c400',lavorazione:'#3182ce',pronto:'#dd6b20',completato:'#38a169'};
  var SL={nuovo:'NUOVO',lavorazione:'IN CORSO',pronto:'PRONTO',completato:'COMPLETATO'};

  var h='<div style="font-size:12px;color:#888;font-weight:800;margin-bottom:10px;letter-spacing:1px;">'+filtered.length+' ORDINE'+(filtered.length>1?'':'')+'</div>';

  filtered.forEach(function(ord){
    var ost=ord.stato;
    var sc=SC[ost]||'#555';
    var tot=0;
    (ord.items||[]).forEach(function(it){tot+=parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);});

    h+='<div class="ord-card" style="border-top:4px solid '+sc+';margin-bottom:14px;">';
    h+='<div class="ord-card-stato" style="background:'+sc+';color:'+(ost==='nuovo'?'#111':'#fff')+'">'+SL[ost]+(ord.modificato?' <span style="background:#553c9a;color:#e9d8fd;font-size:10px;padding:1px 7px;border-radius:8px;letter-spacing:.5px;font-weight:700;vertical-align:middle;">MODIFICATO</span>':'');
    if(ord.numero) h+=' — #'+ord.numero;
    h+='</div>';
    h+='<div class="ord-card-cliente">';
    h+='<div class="ord-cliente-nome">'+esc(ord.nomeCliente||'—')+'</div>';
    h+='<div class="ord-cliente-meta">'+esc(ord.data||'')+(ord.ora?' · '+ord.ora:'')+' · '+(ord.items||[]).length+' articol'+((ord.items||[]).length===1?'o':'i')+'</div>';
    h+='</div>';

    if(ord.nota) h+='<div class="ord-nota" style="white-space:pre-wrap;word-break:break-word;">📝 '+esc(ord.nota)+'</div>';

    // Articoli in grid
    h+='<div class="ord-items-wrap">';
    h+='<div class="ord-grid ord-grid-head">';
    h+='<div class="ord-gh">Prodotto</div><div class="ord-gh ord-gh-c">Qtà</div><div class="ord-gh ord-gh-c">Prezzo</div><div class="ord-gh ord-gh-c">Tot</div>';
    h+='</div>';
    (ord.items||[]).forEach(function(it,ii){
      var pu=parsePriceIT(it.prezzoUnit);var q=parseFloat(it.qty||0);var sub=(pu*q).toFixed(2);
      h+='<div class="ord-grid ord-grid-row'+(ii%2===0?' ord-grid-even':' ord-grid-odd')+'">';
      h+='<div class="ord-gc-desc"><div class="ord-item-name">'+esc(it.desc||'—')+'</div>';
      var codes='';
      if(it.codM) codes+='<span class="ord-code-mag">'+esc(it.codM)+'</span>';
      if(it.codF) codes+='<span class="ord-code-forn">'+esc(it.codF)+'</span>';
      if(codes) h+='<div class="ord-item-codes">'+codes+'</div>';
      h+='</div>';
      h+='<div class="ord-gc-qty">'+q+'<span class="ord-unit">'+esc(it.unit||'pz')+'</span></div>';
      h+='<div class="ord-gc-price">€'+pu.toFixed(2)+'</div>';
      h+='<div class="ord-gc-sub">€'+sub+'</div>';
      h+='</div>';
    });
    h+='</div>';

    h+='<div class="ord-total-bar"><span class="ord-total-label">TOTALE</span><span class="ord-total-value">€ '+tot.toFixed(2)+'</span></div>';
    h+='</div>';
  });

  wrap.innerHTML=h;
}
