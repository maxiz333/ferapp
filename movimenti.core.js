// movimenti.core.js - estratto da movimenti.js

// ══ MOVIMENTI & FEATURES ══════════════════════════════════════════
// [SECTION: MOVIMENTI] -----------------------------------------------------
//  Storico movimenti magazzino (vendite, carichi, rettifiche)
var MOVK_MAX = 2000; // max movimenti salvati

function registraMovimento(rowIdx, tipo, delta, qtyPrima, qtyDopo, note){
  // tipo: 'vendita' | 'carico' | 'rettifica' | 'ordine'
  var r = rows[rowIdx] || {};
  var mov = {
    id: 'mv_' + Date.now() + '_' + rowIdx,
    rowIdx: rowIdx,
    desc: r.desc || '',
    codF: r.codF || '',
    tipo: tipo,
    delta: delta,        // es: -1 (vendita) +5 (carico)
    qtyPrima: qtyPrima,
    qtyDopo: qtyDopo,
    note: note || '',
    ts: new Date().toISOString(),
    ora: new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    data: new Date().toLocaleDateString('it-IT')
  };
  movimenti.unshift(mov);
  // Taglia a MOVK_MAX
  if(movimenti.length > MOVK_MAX) movimenti = movimenti.slice(0, MOVK_MAX);
  lsSet(MOVK, movimenti);
  updateMovBadge();
}

function updateMovBadge(){
  // Badge con movimenti di oggi
  var oggi = new Date().toLocaleDateString('it-IT');
  var n = movimenti.filter(function(m){ return m.data === oggi; }).length;
  var b = document.getElementById('mov-badge');
  if(b){ b.textContent = n; b.style.display = n ? '' : 'none'; }
}


// ---------------------------------------------------------------
//  RENDER MOVIMENTI
// ---------------------------------------------------------------
var movFiltro = 'tutti';

function filterMov(f){
  movFiltro = f;
  ['tutti','vendita','carico','ordine','rettifica'].forEach(function(x){
    var btn = document.getElementById('mov-f-'+x);
    if(!btn) return;
    var on = (x===f);
    btn.style.background = on ? 'var(--accent)' : 'transparent';
    btn.style.color = on ? '#111' : 'var(--muted)';
    btn.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
  });
  renderMovimenti();
}

function clearMovimenti(){
  showConfirm('Eliminare tutto lo storico movimenti?', function(){

  movimenti = [];
  lsSet(MOVK, movimenti);
  updateMovBadge();
  renderMovimenti();

  });
}

function renderMovimenti(){
  var list = document.getElementById('mov-list');
  var statsEl = document.getElementById('mov-stats');
  if(!list) return;

  var search = (document.getElementById('mov-search')||{}).value||'';
  var filtered = movimenti.filter(function(m){
    if(movFiltro !== 'tutti' && m.tipo !== movFiltro) return false;
    if(search && !fuzzyMatch(search, m.desc + ' ' + m.codF)) return false;
    return true;
  });

  // Stats
  var oggi = new Date().toLocaleDateString('it-IT');
  var venditeOggi = movimenti.filter(function(m){ return m.data===oggi && (m.tipo==='vendita'||m.tipo==='ordine'); }).length;
  var carichiOggi = movimenti.filter(function(m){ return m.data===oggi && m.tipo==='carico'; }).length;
  var totMovimenti = movimenti.length;
  if(statsEl) statsEl.innerHTML =
    '<div class="sc"><span class="n">'+totMovimenti+'</span>Totale</div>'+
    '<div class="sc r"><span class="n" style="color:#fc8181;">'+venditeOggi+'</span>Vendite oggi</div>'+
    '<div class="sc g"><span class="n" style="color:#68d391;">'+carichiOggi+'</span>Carichi oggi</div>';

  if(!filtered.length){
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">- Nessun movimento</div>';
    return;
  }

  // Raggruppa per data
  var gruppi = {};
  filtered.forEach(function(m){
    if(!gruppi[m.data]) gruppi[m.data] = [];
    gruppi[m.data].push(m);
  });

  var html = '';
  Object.keys(gruppi).forEach(function(data){
    html += '<div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:6px;">'+data+'</div>';
    gruppi[data].forEach(function(m){
      var isVendita = m.tipo==='vendita'||m.tipo==='ordine';
      var isCarico  = m.tipo==='carico';
      var tipoColor = isVendita ? '#fc8181' : isCarico ? '#68d391' : '#888';
      var tipoIcon  = isVendita ? '-' : isCarico ? '-' : m.tipo==='ordine' ? '-' : '--';
      var deltaStr  = (m.delta > 0 ? '+' : '') + m.delta;
      var qStr = (m.qtyPrima!==null&&m.qtyPrima!==undefined ? m.qtyPrima : '?') + ' - ' + (m.qtyDopo!==null&&m.qtyDopo!==undefined ? m.qtyDopo : '?');

      html += '<div onclick="openMovDetail('+m.rowIdx+')" style="background:#1e1e1e;border:1px solid var(--border);border-left:3px solid '+tipoColor+';border-radius:8px;padding:9px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;" onmouseover="this.style.background=\'#252525\'" onmouseout="this.style.background=\'#1e1e1e\'">';
      // Sinistra: ora + prodotto
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="display:flex;align-items:baseline;gap:6px;">';
      html += '<span style="font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;">'+m.ora+'</span>';
      html += '<span style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(m.desc)+'</span>';
      html += '</div>';
      if(m.codF) html += '<div style="font-size:10px;color:#fc8181;margin-top:1px;">'+esc(m.codF)+'</div>';
      if(m.note) html += '<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:1px;">'+esc(m.note)+'</div>';
      html += '</div>';
      // Destra: tipo + delta + qty
      html += '<div style="text-align:right;flex-shrink:0;">';
      html += '<div style="font-size:13px;font-weight:900;color:'+tipoColor+';">'+tipoIcon+' '+deltaStr+'</div>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+qStr+'</div>';
      html += '</div>';
      html += '</div>';
    });
  });

  list.innerHTML = html;
}


function openMovProdotto(i){
  // Vai alla tab movimenti e filtra per descrizione
  goTab('tmov');
  var r=rows[i]||{};
  var search=document.getElementById('mov-search');
  if(search){ search.value=r.desc||r.codF||''; }
  renderMovimenti();
}


function closeMovDetail(){
  var el = document.getElementById('mov-detail');
  if(el) el.classList.remove('open');
}

function openMovDetail(rowIdx){
  var body = document.getElementById('mov-detail-body');
  if(!body) return;
  var r   = rows[rowIdx] || {};
  var m   = magazzino[rowIdx] || {};
  var qty = m.qty !== undefined && m.qty !== '' ? Number(m.qty) : null;
  var soglia = getSoglia(rowIdx);
  var isLow  = qty !== null && qty <= soglia;

  // Calcola valore magazzino
  var prezzoVend = (r.prezzo);
  var prezzoAcq  =  parsePriceIT(m.prezzoAcquisto);
  var valMag     = qty !== null ? (prezzoVend * qty).toFixed(2) : '-';
  var costoMag   = qty !== null && prezzoAcq ? (prezzoAcq * qty).toFixed(2) : '-';
  var margine    = prezzoAcq && prezzoVend ? (((prezzoVend - prezzoAcq) / prezzoVend)*100).toFixed(1) : null;

  // Tutti i movimenti di questo prodotto
  var movProd = movimenti.filter(function(mv){ return mv.rowIdx === rowIdx; });
  var totVenduto = movProd
    .filter(function(mv){ return mv.tipo==='vendita'||mv.tipo==='ordine'; })
    .reduce(function(s,mv){ return s + Math.abs(mv.delta||0); }, 0);
  var totCaricato = movProd
    .filter(function(mv){ return mv.tipo==='carico'; })
    .reduce(function(s,mv){ return s + Math.abs(mv.delta||0); }, 0);
  var primoMov = movProd.length ? movProd[movProd.length-1] : null;
  var ultimoMov = movProd.length ? movProd[0] : null;

  var html = '';

  // -- Intestazione prodotto
  html += '<div style="background:#111;border-radius:10px;padding:12px 14px;margin-bottom:12px;">';
  html += '<div style="font-size:15px;font-weight:900;color:var(--text);margin-bottom:4px;">'+esc(r.desc||'-')+'</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;">';
  html += '<span style="color:#fc8181;">- '+esc(r.codF||'-')+'</span>';
  html += '<span style="color:var(--accent);">-- '+esc(r.codM||'-')+'</span>';
  if(m.marca) html += '<span style="color:var(--muted);">- '+esc(m.marca)+'</span>';
  if(m.nomeFornitore) html += '<span style="color:var(--muted);">- '+esc(m.nomeFornitore)+'</span>';
  html += '</div>';
  if(m.specs) html += '<div style="font-size:11px;color:#2dd4bf;font-style:italic;margin-top:5px;">- '+esc(m.specs)+'</div>';
  if(m.posizione) html += '<div style="font-size:11px;color:#888;margin-top:3px;">- '+esc(m.posizione)+'</div>';
  html += '</div>';

  // -- Dati economici
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">';

  html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">';
  html += '<div style="font-size:10px;color:var(--muted);margin-bottom:2px;">- Prezzo vendita</div>';
  html += '<div style="font-size:20px;font-weight:900;color:var(--accent);">- '+esc(r.prezzo||'0')+'</div>';
  if(r.prezzoOld) html += '<div style="font-size:10px;color:#555;text-decoration:line-through;">era - '+esc(r.prezzoOld)+'</div>';
  html += '</div>';

  html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">';
  html += '<div style="font-size:10px;color:#555;margin-bottom:2px;">- Costo acquisto</div>';
  html += '<div style="font-size:20px;font-weight:900;color:#555;">- '+(m.prezzoAcquisto||'-')+'</div>';
  if(margine) html += '<div style="font-size:10px;color:#68d391;">margine '+margine+'%</div>';
  html += '</div>';

  html += '<div style="background:#1e1e1e;border:1px solid var(--border)';
  html += (isLow?';border-color:#e53e3e':'');
  html += ';border-radius:8px;padding:10px 12px;">';
  html += '<div style="font-size:10px;color:var(--muted);margin-bottom:2px;">- Giacenza attuale</div>';
  html += '<div style="font-size:20px;font-weight:900;color:'+(isLow?'#e53e3e':'var(--accent)')+';">'+(qty!==null?qty:'-')+' '+(m.unit||'pz')+'</div>';
  html += '<div style="font-size:10px;color:'+(isLow?'#e53e3e':'var(--muted)')+';">min: '+soglia+(isLow?' -- SOTTO SCORTA':'')+'</div>';
  html += '</div>';

  html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 12px;">';
  html += '<div style="font-size:10px;color:var(--muted);margin-bottom:2px;">- Valore magazzino</div>';
  html += '<div style="font-size:18px;font-weight:900;color:#68d391;">- '+valMag+'</div>';
  if(costoMag!=='-') html += '<div style="font-size:10px;color:#555;">costo: - '+costoMag+'</div>';
  html += '</div>';

  html += '</div>';

  // -- Statistiche movimenti
  html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px;">';
  html += '<div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">- Statistiche movimenti</div>';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
  html += '<div><div style="font-size:11px;color:var(--muted);">Totale movimenti</div><div style="font-size:18px;font-weight:900;color:var(--text);">'+movProd.length+'</div></div>';
  html += '<div><div style="font-size:11px;color:#fc8181;">Totale venduto</div><div style="font-size:18px;font-weight:900;color:#fc8181;">'+totVenduto+' '+(m.unit||'pz')+'</div></div>';
  html += '<div><div style="font-size:11px;color:#68d391;">Totale caricato</div><div style="font-size:18px;font-weight:900;color:#68d391;">'+totCaricato+' '+(m.unit||'pz')+'</div></div>';
  if(primoMov) html += '<div><div style="font-size:11px;color:var(--muted);">Primo movimento</div><div style="font-size:12px;font-weight:700;color:var(--text);">'+primoMov.data+'</div></div>';
  if(ultimoMov) html += '<div><div style="font-size:11px;color:var(--muted);">Ultimo movimento</div><div style="font-size:12px;font-weight:700;color:var(--text);">'+ultimoMov.data+' '+ultimoMov.ora+'</div></div>';
  html += '</div>';
  html += '</div>';

  // -- Storico prezzi
  if(r.priceHistory && r.priceHistory.length){
    html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px;">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">- Storico prezzi</div>';
    var history = r.priceHistory.slice().reverse();
    history.forEach(function(h){
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">';
      html += '<span style="color:var(--muted);">'+esc(h.data||'')+'</span>';
      html += '<span style="color:var(--text);font-weight:700;">- '+esc(h.prezzo||'')+'</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // -- Ultimi movimenti di questo prodotto
  if(movProd.length){
    html += '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:8px;padding:10px 14px;">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">- Ultimi movimenti</div>';
    movProd.slice(0,20).forEach(function(mv){
      var isV = mv.tipo==='vendita'||mv.tipo==='ordine';
      var col = isV ? '#fc8181' : mv.tipo==='carico' ? '#68d391' : '#888';
      var icon = isV ? '-' : mv.tipo==='carico' ? '-' : '--';
      var dStr = (mv.delta>0?'+':'')+mv.delta;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">';
      html += '<div>';
      html += '<span style="color:var(--muted);font-size:10px;">'+mv.data+' '+mv.ora+'</span>';
      if(mv.note) html += ' <span style="color:var(--muted);font-size:10px;font-style:italic;">- '+esc(mv.note)+'</span>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<span style="color:'+col+';font-weight:900;">'+icon+' '+dStr+'</span>';
      html += '<span style="color:var(--muted);font-size:10px;margin-left:6px;">'+(mv.qtyPrima!==null&&mv.qtyPrima!==undefined?mv.qtyPrima:'?')+' - '+(mv.qtyDopo!==null&&mv.qtyDopo!==undefined?mv.qtyDopo:'?')+'</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px;">Nessun movimento registrato per questo articolo.</div>';
  }

  // -- Bottone modifica
  html += '<div style="margin-top:14px;">';
  html += '<button onclick="closeMovDetail();openEditProdotto('+rowIdx+')" '+
    'style="width:100%;padding:10px;border-radius:10px;border:none;background:var(--accent);color:#111;font-size:13px;font-weight:900;cursor:pointer;">-- Modifica articolo</button>';
  html += '</div>';

  body.innerHTML = html;
  document.getElementById('mov-detail').classList.add('open');
}


// -- Popup verticale Cartellin. ----------------------------------------
var _cartellinTapTimer = null;
var _cartellinPopupOpen = false;

function handleCartellinTap(btn){
  if(_cartellinTapTimer){
    // Secondo tap: apri popup
    clearTimeout(_cartellinTapTimer);
    _cartellinTapTimer = null;
    toggleCartellinPopup(btn);
  } else {
    // Primo tap: aspetta 320ms per vedere se arriva il secondo
    _cartellinTapTimer = setTimeout(function(){
      _cartellinTapTimer = null;
      // Tap singolo confermato - vai ai cartellini
      goTab('t1');
    }, 320);
  }
}

function toggleCartellinPopup(btn){
  var popup = document.getElementById('cartellin-popup');
  var backdrop = document.getElementById('cartellin-popup-backdrop');
  if(!popup) return;
  if(_cartellinPopupOpen){
    closeCartellinPopup();
  } else {
    // Posiziona il popup sopra il bottone
    var rect = btn.getBoundingClientRect();
    popup.style.left = Math.max(4, rect.left - (popup.offsetWidth||110)/2 + rect.width/2) + 'px';
    popup.classList.add('open');
    backdrop.style.display = 'block';
    _cartellinPopupOpen = true;
    // Sincronizza badge pb2
    var pb = document.getElementById('pb2');
    var pbp = document.getElementById('pb2-pop');
    if(pb && pbp){ pbp.textContent=pb.textContent; pbp.style.display=pb.style.display; }
  }
}

function closeCartellinPopup(){
  var popup = document.getElementById('cartellin-popup');
  var backdrop = document.getElementById('cartellin-popup-backdrop');
  if(popup) popup.classList.remove('open');
  if(backdrop) backdrop.style.display = 'none';
  _cartellinPopupOpen = false;
}

// -- Popup verticale Fatture (doppio tap) -----------------------------
var _fattureTapTimer = null;
var _fatturePopupOpen = false;

function handleFattureTap(btn){
  if(_fattureTapTimer){
    clearTimeout(_fattureTapTimer);
    _fattureTapTimer = null;
    toggleFatturePopup(btn);
  } else {
    _fattureTapTimer = setTimeout(function(){
      _fattureTapTimer = null;
      goTab('tfat');
    }, 320);
  }
}

function toggleFatturePopup(btn){
  var popup = document.getElementById('fatture-popup');
  var backdrop = document.getElementById('fatture-popup-backdrop');
  if(!popup) return;
  if(_fatturePopupOpen){
    closeFatturePopup();
  } else {
    var rect = btn.getBoundingClientRect();
    popup.style.left = Math.max(4, rect.left - (popup.offsetWidth||130)/2 + rect.width/2) + 'px';
    popup.classList.add('open');
    backdrop.style.display = 'block';
    _fatturePopupOpen = true;
  }
}

function closeFatturePopup(){
  var popup = document.getElementById('fatture-popup');
  var backdrop = document.getElementById('fatture-popup-backdrop');
  if(popup) popup.classList.remove('open');
  if(backdrop) backdrop.style.display = 'none';
  _fatturePopupOpen = false;
}

// ------------------------------------------------------------------
//  FEATURE 5 - Duplica articolo
// ------------------------------------------------------------------
function duplicaArticolo(i) {
  if (i === null || !rows[i]) return;
  showConfirm('⚠️ Duplicare "' + (rows[i].desc||'Articolo') + '" come NUOVO articolo nel database?', function(){
    var nr = JSON.parse(JSON.stringify(rows[i]));
    nr.desc = (nr.desc || 'Articolo') + ' (copia)';
    nr.codM = '';
    nr.priceHistory = [];
    rows.push(nr);
    var ni = rows.length - 1;
    if (magazzino[i]) {
      magazzino[ni] = JSON.parse(JSON.stringify(magazzino[i]));
      magazzino[ni].qty = 0;
      magazzino[ni].correlati = [];
    } else {
      magazzino[ni] = { qty: 0, unit: 'pz' };
    }
    lsSet(SK, rows);
    lsSet(MAGK, magazzino);
    renderInventario();
    cancelEditProdotto();
    setTimeout(function () { openEditProdotto(ni); }, 80);
    showToastGen('green', '\u2705 Articolo duplicato — modifica la copia');
  });
}

// ------------------------------------------------------------------
//  Toast generico (color = 'green' | 'purple' | 'blue')
// ------------------------------------------------------------------
var _toastGenTimer = null;
var _TOAST_COLORS = { green: '#38a169', purple: '#805ad5', blue: '#3182ce', red: '#e53e3e' };
function showToastGen(color, msg) {
  var el = document.getElementById('scorta-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = _TOAST_COLORS[color] || _TOAST_COLORS.red;
  el.classList.add('show');
  if (_toastGenTimer) clearTimeout(_toastGenTimer);
  _toastGenTimer = setTimeout(function () {
    el.classList.remove('show');
    el.style.background = _TOAST_COLORS.red;
  }, 3800);
}

// -- Dialogo di conferma custom (confirm() bloccato in WebView) ----------
// [dedup rimosso]
function showConfirm(msg, onOk){
  _confirmCb=onOk;
  var ov=document.getElementById('confirm-overlay');
  var txt=document.getElementById('confirm-msg');
  if(!ov) return; // fallback
  if(txt) txt.textContent=msg;
  ov.classList.add('open');
}
function _confirmOk(){
  var ov=document.getElementById('confirm-overlay');
  if(ov) ov.classList.remove('open');
  if(_confirmCb){ _confirmCb(); _confirmCb=null; }
}
function _confirmCancel(){
  var ov=document.getElementById('confirm-overlay');
  if(ov) ov.classList.remove('open');
  _confirmCb=null;
}
