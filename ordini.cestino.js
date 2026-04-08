// ordini.cestino.js - estratto da ordini.js

var ORDK_CESTINO = window.AppKeys.ORDINI_CESTINO;
var ordiniCestino = lsGet(ORDK_CESTINO) || [];
var _cestinoOrdOpen = false;

function deleteOrdine(gi){
  showConfirm('Eliminare questo ordine?',function(){
    var ord = ordini.splice(gi,1)[0];
    if(ord){
      ord.eliminatoAt = new Date().toLocaleString('it-IT');
      ordiniCestino.unshift(ord);
      lsSet(ORDK_CESTINO, ordiniCestino);
      // Rimuovi anche il carrello collegato
      if(ord.id) _rimuoviCarrelloDaOrdine(ord.id);
      saveCarrelli();
    }
    saveOrdini();renderOrdini();showToastGen('red','Ordine spostato nel cestino');
  });
}

function toggleCestinoOrdini(){
  _cestinoOrdOpen = !_cestinoOrdOpen;
  var btn = document.getElementById('ord-f-cestino');
  if(btn){
    btn.style.background = _cestinoOrdOpen ? '#e53e3e22' : 'transparent';
    btn.style.borderColor = _cestinoOrdOpen ? '#e53e3e' : '#222';
    btn.style.color = _cestinoOrdOpen ? '#fc8181' : '#444';
  }
  var listEl = document.getElementById('ord-list');
  if(_cestinoOrdOpen){
    if(listEl) listEl.style.display = 'none';
    renderCestinoOrdini();
  } else {
    var cv = document.getElementById('ord-cestino-view');
    if(cv) cv.style.display = 'none';
    if(listEl) listEl.style.display = '';
  }
}

function renderCestinoOrdini(){
  var cv = document.getElementById('ord-cestino-view');
  if(!cv){
    cv = document.createElement('div');
    cv.id = 'ord-cestino-view';
    var listEl = document.getElementById('ord-list');
    if(listEl) listEl.parentNode.insertBefore(cv, listEl.nextSibling);
    else return;
  }
  cv.style.display = 'block';
  if(!ordiniCestino.length){
    cv.innerHTML = '<div style="text-align:center;color:#555;padding:30px;font-size:13px;">Cestino vuoto.</div>';
    return;
  }
  var h = '<div style="padding:8px 0 12px;text-align:center;font-size:12px;font-weight:700;color:#fc8181;">🗑️ CESTINO — ' + ordiniCestino.length + ' ordini eliminati</div>';
  ordiniCestino.forEach(function(ord,ci){
    var nArt = (ord.items||[]).length;
    var tot = 0;
    (ord.items||[]).forEach(function(it){tot += parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);});
    h += '<div style="border:1px solid #2a2a2a;border-radius:10px;margin-bottom:8px;overflow:hidden;border-top:3px solid #e53e3e;">';
    h += '<div style="background:#e53e3e22;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;">';
    h += '<span style="font-size:13px;font-weight:800;color:#fc8181;">'+esc(ord.nomeCliente||'—')+'</span>';
    h += '<span style="font-size:10px;color:#888;">'+esc(ord.eliminatoAt||ord.data||'')+'</span>';
    h += '</div>';
    h += '<div style="padding:6px 12px;display:flex;justify-content:space-between;align-items:center;">';
    h += '<span style="font-size:11px;color:#888;">'+nArt+' articoli — €'+tot.toFixed(2)+'</span>';
    h += '<div style="display:flex;gap:6px;">';
    h += '<button onclick="ripristinaOrdine('+ci+')" style="padding:4px 10px;border-radius:6px;border:1px solid #38a16944;background:transparent;color:#68d391;font-size:11px;cursor:pointer;">↩️ Ripristina</button>';
    h += '<button onclick="eliminaDefinitivo('+ci+')" style="padding:4px 10px;border-radius:6px;border:1px solid #e53e3e44;background:transparent;color:#fc8181;font-size:11px;cursor:pointer;">✕</button>';
    h += '</div></div></div>';
  });
  h += '<div style="text-align:center;padding:12px;">';
  h += '<button onclick="svuotaCestinoOrdini()" style="padding:6px 16px;border-radius:8px;border:1px solid #e53e3e44;background:transparent;color:#fc8181;font-size:11px;cursor:pointer;">🗑️ Svuota cestino</button>';
  h += '</div>';
  cv.innerHTML = h;
}

function ripristinaOrdine(ci){
  var ord = ordiniCestino.splice(ci,1)[0];
  if(ord){
    delete ord.eliminatoAt;
    ord.stato = 'nuovo';
    ordini.unshift(ord);
    saveOrdini();
    lsSet(ORDK_CESTINO, ordiniCestino);
    renderCestinoOrdini();
    showToastGen('green','↩️ Ordine ripristinato');
  }
}

function eliminaDefinitivo(ci){
  showConfirm('Eliminare definitivamente?',function(){
    ordiniCestino.splice(ci,1);
    lsSet(ORDK_CESTINO, ordiniCestino);
    renderCestinoOrdini();
    showToastGen('red','Eliminato definitivamente');
  });
}

function svuotaCestinoOrdini(){
  showConfirm('Svuotare tutto il cestino?',function(){
    ordiniCestino = [];
    lsSet(ORDK_CESTINO, []);
    renderCestinoOrdini();
    showToastGen('red','Cestino svuotato');
  });
}
