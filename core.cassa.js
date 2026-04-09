// ══ MODALITÀ CASSA ══════════════════════════════════════════════════
var _cassaModeActive = false;

function _cassaModeOpen(){
  _cassaModeActive = true;
  // Nascondi overlay login
  var ov = document.getElementById('auth-login-ov');
  if(ov) ov.style.display = 'none';
  // Nascondi header, bottom bar, tutte le tab
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('tab-bottom').style.display = 'none';
  document.querySelectorAll('.tab-content').forEach(function(t){ t.classList.remove('active'); });
  // Crea/mostra overlay cassa-mode
  var cm = document.getElementById('cassa-mode-ov');
  if(!cm){
    cm = document.createElement('div');
    cm.id = 'cassa-mode-ov';
    document.body.appendChild(cm);
  }
  cm.style.display = 'flex';
  // Carica database articoli se non ancora caricato (serve per sync prezzi al completamento)
  if(!rows.length && typeof loadMagazzinoFB === 'function'){
    _magExtLoaded = false;
    loadMagazzinoFB();
  }
  // Avvia auto-refresh ordini in cassa
  _cassaModeRender();
  _cassaModeStartRefresh();
}

function _cassaModeClose(){
  _cassaModeActive = false;
  _cassaModeStopRefresh();
  var cm = document.getElementById('cassa-mode-ov');
  if(cm) cm.style.display = 'none';
  // Ripristina header e bottom bar
  document.getElementById('app-header').style.display = '';
  document.getElementById('tab-bottom').style.display = '';
  // Torna alla schermata login
  _authShowLogin();
}

// Auto-refresh cassa (polling localStorage ogni 3s)
var _cassaRefreshInt = null;
var _cassaLastJson = '';

function _cassaModeStartRefresh(){
  _cassaLastJson = JSON.stringify(ordini);
  _cassaRefreshInt = setInterval(function(){
    var fresh = lsGet(ORDK, []);
    var freshJson = JSON.stringify(fresh);
    if(freshJson !== _cassaLastJson){
      _cassaLastJson = freshJson;
      ordini = fresh;
      _cassaModeRender();
    }
  }, 3000);
}

function _cassaModeStopRefresh(){
  if(_cassaRefreshInt){ clearInterval(_cassaRefreshInt); _cassaRefreshInt = null; }
}

// Render lista ordini per la cassa
function _cassaModeRender(){
  var cm = document.getElementById('cassa-mode-ov');
  if(!cm) return;
  // Filtra ordini da mostrare: nuovo + pronto (non completati, non bozze)
  var lista = ordini.filter(function(o){
    return o.stato === 'nuovo' || o.stato === 'lavorazione' || o.stato === 'pronto';
  });
  lista.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });

  var h = '';
  // Header cassa
  h += '<div class="cassa-mode-header">';
  h += '<div style="display:flex;align-items:center;gap:12px;">';
  h += '<span style="font-size:28px;">💰</span>';
  h += '<div><div style="font-size:20px;font-weight:900;color:#68d391;">CASSA</div>';
  h += '<div style="font-size:11px;color:#555;">' + lista.length + ' ordin' + (lista.length===1?'e':'i') + '</div></div>';
  h += '</div>';
  h += '<button onclick="_cassaModeClose()" style="padding:10px 16px;border-radius:10px;border:1px solid #333;background:#1a1a1a;color:#888;font-size:13px;font-weight:700;cursor:pointer;">🔓 Esci</button>';
  h += '</div>';

  // Lista ordini
  h += '<div class="cassa-mode-list">';
  if(!lista.length){
    h += '<div style="text-align:center;padding:60px 20px;color:#555;">';
    h += '<div style="font-size:48px;margin-bottom:12px;">✅</div>';
    h += '<div style="font-size:16px;font-weight:700;">Nessun ordine da fare</div>';
    h += '<div style="font-size:12px;margin-top:6px;color:#444;">Gli ordini completati non appaiono qui</div>';
    h += '</div>';
  }
  lista.forEach(function(ord){
    var gi = ordini.indexOf(ord);
    var nArt = (ord.items||[]).length;
    var tot = ordTotaleSenzaCongelati(ord);
    var SC_C = {nuovo:'#f5c400', pronto:'#dd6b20'};
    var SL_C = {nuovo:'NUOVO', pronto:'PRONTO'};
    var statoNorm = (ord.stato === 'lavorazione') ? 'nuovo' : ord.stato;
    var sc = (ord.promozione && statoNorm==='nuovo') ? '#e53e3e' : (SC_C[statoNorm]||'#555');
    var sl = (ord.promozione && statoNorm==='nuovo') ? 'ORDINE IN ARRIVO' : (SL_C[statoNorm]||'');

    h += '<div class="cassa-mode-card" onclick="_cassaModeApri('+gi+')" style="border-left:5px solid '+sc+';">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    h += '<div>';
    h += '<div style="font-size:17px;font-weight:900;color:var(--text);">'+esc(ord.nomeCliente||'—')+'</div>';
    h += '<div style="font-size:11px;color:#666;margin-top:2px;">' + sl;
    if(ord.numero) h += ' #'+ord.numero;
    h += ' · '+nArt+' art. · '+esc(ord.data||'')+' '+esc(ord.ora||'')+'</div>';
    h += '</div>';
    h += '<div style="text-align:right;">';
    h += '<div style="font-size:22px;font-weight:900;color:var(--accent);">€ '+tot.toFixed(2)+'</div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
  });
  h += '</div>';

  cm.innerHTML = h;
}

// Apri dettaglio ordine nella cassa
function _cassaModeApri(gi){
  var ord = ordini[gi];
  if(!ord) return;
  var cm = document.getElementById('cassa-mode-ov');
  if(!cm) return;

  var nArt = (ord.items||[]).length;
  var tot = 0;
  (ord.items||[]).forEach(function(it){ tot += parsePriceIT(it.prezzoUnit) * parseFloat(it.qty||0); });

  var h = '';
  // Header con tasto indietro
  h += '<div class="cassa-mode-header">';
  h += '<div style="display:flex;align-items:center;gap:12px;">';
  h += '<button onclick="_cassaModeRender()" style="background:none;border:none;color:var(--accent);font-size:24px;cursor:pointer;padding:4px 8px;">←</button>';
  h += '<div>';
  h += '<div style="font-size:18px;font-weight:900;color:var(--text);">'+esc(ord.nomeCliente||'—')+'</div>';
  h += '<div style="font-size:11px;color:#666;">';
  if(ord.numero) h += 'Ordine #'+ord.numero+' · ';
  h += esc(ord.data||'')+' '+esc(ord.ora||'')+' · '+nArt+' articol'+(nArt===1?'o':'i');
  h += '</div></div></div>';
  h += '<button onclick="_cassaModeClose()" style="padding:8px 12px;border-radius:10px;border:1px solid #333;background:#1a1a1a;color:#888;font-size:12px;cursor:pointer;">🔓 Esci</button>';
  h += '</div>';

  // Lista articoli
  h += '<div class="cassa-mode-list">';
  (ord.items||[]).forEach(function(it, i){
    var pu = parsePriceIT(it.prezzoUnit);
    var q = parseFloat(it.qty||0);
    var sub = (pu*q).toFixed(2);
    h += '<div class="cassa-mode-item">';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-size:15px;font-weight:700;color:var(--text);">'+esc(it.desc||'—')+'</div>';
    h += '<div style="font-size:11px;color:#666;margin-top:2px;">';
    h += q + ' ' + esc(it.unit||'pz') + ' × €' + pu.toFixed(2);
    if(it.codM) h += ' · <span style="color:var(--accent);">'+esc(it.codM)+'</span>';
    if(it.codF) h += ' <span style="color:#888;">'+esc(it.codF)+'</span>';
    h += ' <span class="ord-item-del" onclick="event.stopPropagation();_cassaModeDelItem(this,'+gi+','+i+')" title="Rimuovi">×</span>';
    h += '</div>';
    if(it.nota) h += '<div style="font-size:10px;color:#f6ad55;margin-top:2px;">📝 '+esc(it.nota)+'</div>';
    if(it.scampolo) h += '<div style="font-size:10px;color:var(--accent);font-weight:700;">✂ SCAMPOLO</div>';
    if(it.fineRotolo) h += '<div style="font-size:10px;color:#f6ad55;font-weight:700;">🔄 FINE ROTOLO</div>';
    h += '</div>';
    h += '<div style="text-align:right;flex-shrink:0;">';
    h += '<div style="font-size:18px;font-weight:900;color:var(--accent);">€ '+sub+'</div>';
    h += '</div></div>';
  });
  // Nota ordine
  if(ord.nota){
    h += '<div style="padding:12px 0;font-size:13px;color:#f6ad55;border-top:1px solid #222;margin-top:8px;">📋 '+esc(ord.nota)+'</div>';
  }
  h += '</div>';

  // Footer: totale + tasto FATTO
  h += '<div class="cassa-mode-footer">';
  h += '<div>';
  h += '<div style="font-size:32px;font-weight:900;color:var(--accent);">€ '+tot.toFixed(2)+'</div>';
  h += '<div style="font-size:12px;color:#666;">'+nArt+' articol'+(nArt===1?'o':'i');
  if(ord.scontoGlobale) h += ' · sconto -'+ord.scontoGlobale+'%';
  h += '</div></div>';
  h += '<button class="cassa-mode-fatto-btn" onclick="_cassaModeFatto(this,'+gi+')" data-taps="0">✅ FATTO</button>';
  h += '</div>';

  cm.innerHTML = h;
}

// Doppio tap per completare
function _cassaModeFatto(btn, gi){
  var taps = parseInt(btn.getAttribute('data-taps')||'0') + 1;
  btn.setAttribute('data-taps', taps);
  if(taps === 1){
    btn.textContent = '⚠️ TAP ANCORA';
    btn.style.background = '#dd6b20';
    setTimeout(function(){
      if(btn.getAttribute('data-taps') === '1'){
        btn.setAttribute('data-taps', '0');
        btn.textContent = '✅ FATTO';
        btn.style.background = '#38a169';
      }
    }, 2000);
    return;
  }
  // Secondo tap — completa
  var ord = ordini[gi];
  if(ord){
    if(ord.id && typeof ordUnlock === 'function') ordUnlock(ord.id);
    ord.stato = 'completato';
    if(!ord.statiLog) ord.statiLog = {};
    ord.statiLog.completato = {
      ora: new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
      data: new Date().toLocaleDateString('it-IT')
    };
    ord.completatoAtISO = new Date().toISOString();
    // Sync prezzi al database
    if(typeof _syncPrezziOrdineAlDB === 'function') _syncPrezziOrdineAlDB(ord);
    saveOrdini();
  }
  _cassaLastJson = JSON.stringify(ordini);
  _cassaModeRender();
  showToastGen('green', '✅ Ordine completato!');
}

// Elimina articolo dalla cassa — doppio tap
function _cassaModeDelItem(el, gi, ii){
  if(el._confirm){
    // Secondo tap — elimina
    var ord = ordini[gi];
    if(!ord || !ord.items[ii]) return;
    ord.items.splice(ii, 1);
    var tot = ord.items.reduce(function(s,x){ return s + parsePriceIT(x.prezzoUnit)*parseFloat(x.qty||0); }, 0);
    ord.totale = tot.toFixed(2);
    ord.modificato = true;
    ord.modificatoAt = new Date().toLocaleString('it-IT');
    saveOrdini();
    _cassaLastJson = JSON.stringify(ordini);
    // Se non ci sono più articoli, torna alla lista
    if(!ord.items.length){
      _cassaModeRender();
    } else {
      _cassaModeApri(gi);
    }
    showToastGen('red', 'Articolo rimosso');
    return;
  }
  // Primo tap — conferma
  el._confirm = true;
  el.textContent = '?';
  el.classList.add('ord-item-del--confirm');
  setTimeout(function(){
    el._confirm = false;
    el.textContent = '×';
    el.classList.remove('ord-item-del--confirm');
  }, 2500);
}
