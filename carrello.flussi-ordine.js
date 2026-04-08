// --- RIPETI ORDINE DALLO STORICO -------------------------------
function ripetiOrdine(ordIdx,cartId){
  var ord=ordini[ordIdx];
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!ord||!cart)return;
  (ord.items||[]).forEach(function(it){
    var copy=JSON.parse(JSON.stringify(it));
    delete copy._checked;delete copy._scaglioniAperti;
    (cart.items=cart.items||[]).push(copy);
  });
  saveCarrelli();renderCartTabs();
  feedbackAdd();
  showToastGen('green','- '+(ord.items||[]).length+' articoli aggiunti dallo storico');
}

// --- INVIA ORDINE -------------------------------------------
// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB "ORDINARE" — pannello scorrevole dal basso con articoli da ordinare
// Si apre con doppio tap sull'icona carrello nel menu in basso (DOM = Document Object Model).
// Raggruppa gli articoli contrassegnati "daOrdinare" per fornitore (codF).
// ══════════════════════════════════════════════════════════════════════════════

// Variabile per gestire il doppio tap sull'icona del carrello nella bottom bar
var _cartDoubleTapTimer = null;

// Intercetta tap sull'icona carrello: singolo tap = vai alla tab, doppio tap = apri sub-tab ordinare
function handleCartTap(){
  if(_cartDoubleTapTimer){
    // Secondo tap rilevato entro 350ms: apre la Sub-Tab Ordinare
    clearTimeout(_cartDoubleTapTimer);
    _cartDoubleTapTimer = null;
    apriSubTabOrdinare();
  } else {
    // Primo tap: aspetta 350ms per vedere se arriva il secondo
    _cartDoubleTapTimer = setTimeout(function(){
      _cartDoubleTapTimer = null;
      goTab('tc'); // tap singolo: vai normalmente al carrello (tab tc)
    }, 350);
  }
}

// Apre la Sub-Tab "Ordinare": pannello che scorre dal basso verso l'alto
// coprendo parzialmente il carrello, con lista articoli da ordinare per fornitore.
function apriSubTabOrdinare(){
  // Raccoglie tutti gli articoli "daOrdinare" da tutti i carrelli attivi
  var daOrdinare = [];
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      if(it.daOrdinare){
        daOrdinare.push({
          desc: it.desc || '—',
          codM: it.codM || '',   // codice interno (magazzino)
          codF: it.codF || '',   // codice fornitore (recuperato da Firebase NoSQL)
          qty:  it.qty  || 1,
          unit: it.unit || 'pz',
          cartNome: cart.nome || ''
        });
      }
    });
  });

  // Raggruppa per codice fornitore (codF); se assente usa "Fornitore sconosciuto"
  var gruppi = {};
  daOrdinare.forEach(function(it){
    var key = it.codF || '__nessuno__';
    if(!gruppi[key]) gruppi[key] = { codF: it.codF, articoli: [] };
    gruppi[key].articoli.push(it);
  });

  // Costruisce l'HTML del pannello
  var h = '';
  h += '<div id="ord-forn-handle"><div class="ord-forn-handle-bar"></div></div>';
  h += '<div class="ord-forn-header">';
  h += '<span style="font-size:18px;font-weight:900;color:var(--accent);">📦 Da Ordinare</span>';
  h += '<button onclick="chiudiSubTabOrdinare()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:4px;">✕</button>';
  h += '</div>';

  if(!daOrdinare.length){
    h += '<div style="padding:40px 20px;text-align:center;color:var(--muted);">Nessun articolo marcato "Da ordinare".<br><small>Premi 📦 Imballo su un articolo del carrello.</small></div>';
  } else {
    h += '<div class="ord-forn-body">';
    // Itera i gruppi per fornitore
    Object.keys(gruppi).forEach(function(key){
      var g = gruppi[key];
      var nomeForn = g.codF || 'Fornitore sconosciuto';
      h += '<div class="ord-forn-vendor-group">';
      h += '<div class="ord-forn-vendor-title">';
      h += '<span style="font-weight:800;color:var(--text);">🏭 ' + esc(nomeForn) + '</span>';
      if(g.codF) h += '<span style="font-size:9px;color:var(--muted);margin-left:6px;">COD: ' + esc(g.codF) + '</span>';
      h += '</div>';
      g.articoli.forEach(function(it){
        h += '<div class="ord-forn-line">';
        h += '<div style="flex:1;min-width:0;">';
        h += '<div style="font-size:13px;font-weight:700;color:var(--text);">' + esc(it.desc) + '</div>';
        if(it.codM) h += '<div style="font-size:10px;color:var(--accent);">' + esc(it.codM) + '</div>';
        h += '<div style="font-size:10px;color:var(--muted);">Carrello: ' + esc(it.cartNome) + '</div>';
        h += '</div>';
        h += '<div style="text-align:right;font-weight:700;color:var(--accent);">' + it.qty + ' ' + esc(it.unit) + '</div>';
        h += '</div>';
      });
      h += '</div>';
    });
    h += '</div>';
  }

  // Tasto grande CONFERMA ORDINE A FORNITORI in fondo al pannello
  h += '<div class="ord-forn-footer">';
  h += '<button class="ord-forn-confirm" onclick="confermaOrdineAFornitori()">';
  h += '📋 CONFERMA ORDINE A FORNITORI</button>';
  h += '</div>';

  // Crea o aggiorna il pannello nel DOM (Document Object Model = struttura HTML della pagina)
  var panel = document.getElementById('ord-forn-panel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'ord-forn-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = h;
  panel.classList.add('ord-forn-panel--open');

  // Gesture: swipe verso il basso chiude il pannello
  var startY = 0;
  panel.addEventListener('touchstart', function(e){ startY = e.touches[0].clientY; }, {passive:true});
  panel.addEventListener('touchend', function(e){
    var dy = e.changedTouches[0].clientY - startY;
    if(dy > 60) chiudiSubTabOrdinare(); // swipe giù > 60px = chiudi
  }, {passive:true});
}

// Chiude la Sub-Tab Ordinare rimuovendo la classe "open"
function chiudiSubTabOrdinare(){
  var panel = document.getElementById('ord-forn-panel');
  if(panel) panel.classList.remove('ord-forn-panel--open');
}

// Conferma e invia l'ordine a tutti i fornitori con articoli "daOrdinare"
// Per ora mostra un riepilogo testuale e notifica — espandibile con invio email/WhatsApp
function confermaOrdineAFornitori(){
  var daOrd = [];
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      if(it.daOrdinare) daOrd.push(it);
    });
  });
  if(!daOrd.length){ showToastGen('yellow','Nessun articolo da ordinare'); return; }
  showToastGen('green','✅ Ordine confermato a ' + daOrd.length + ' articoli');
  chiudiSubTabOrdinare();
}

// ── AVVISA UFFICIO — crea bozza ordine visibile in tab ordini ──────
function avvisaUfficio(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||(!(cart.items||[]).length)){showToastGen('red','Aggiungi almeno un articolo prima');return;}

  if(cart.bozzaOrdId){
    // Bozza già attiva: aggiorna
    _aggiornaBozzaOrdine(cart);
    showToastGen('green','📢 Ufficio aggiornato!');
    return;
  }

  var bozzaId='bozza_'+Date.now();
  var bozza={
    id:bozzaId,
    numero:null,
    nomeCliente:cart.nome||'—',
    ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    data:new Date().toLocaleDateString('it-IT'),
    dataISO:new Date().toISOString().slice(0,10),
    createdAt:new Date().toISOString(),
    items:JSON.parse(JSON.stringify(cart.items||[])),
    nota:cart.nota||'',
    totale:'0',
    stato:'bozza',
    commesso:cart.commesso||''
  };
  ordini.unshift(bozza);
  saveOrdini();
  cart.bozzaOrdId=bozzaId;
  saveCarrelli();
  renderCartTabs();
  showToastGen('green','📢 Ufficio avvisato! Vedono già gli articoli.');
}

// Aggiorna la bozza con gli articoli correnti del carrello
function _aggiornaBozzaOrdine(cart){
  if(!cart||!cart.bozzaOrdId)return;
  var bozza=ordini.find(function(o){return o.id===cart.bozzaOrdId;});
  if(!bozza||bozza.stato!=='bozza')return;
  bozza.items=JSON.parse(JSON.stringify(cart.items||[]));
  bozza.nomeCliente=cart.nome||'—';
  bozza.nota=cart.nota||'';
  saveOrdini();
}

// Elimina la bozza collegata (chiamata quando si invia l'ordine vero)
function _rimuoviBozzaOrdine(cart){
  if(!cart||!cart.bozzaOrdId)return;
  // Rilascia il lock sulla bozza prima di eliminarla
  ordUnlock(cart.bozzaOrdId);
  ordini=ordini.filter(function(o){return o.id!==cart.bozzaOrdId;});
  delete cart.bozzaOrdId;
}

function inviaOrdine(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!(cart.items||[]).length){showToastGen('red','-- Carrello vuoto!');return;}
  // Rimuovi bozza se presente
  _rimuoviBozzaOrdine(cart);
  var tot=(cart.items||[]).reduce(function(s,it){return s+(_prezzoEffettivo(it)*parseFloat(it.qty||0));},0);
  var numOrd=getNextOrdNum();
  var ord={
    id:'ord_'+Date.now(),
    numero:numOrd,
    nomeCliente:cart.nome,
    ora:new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
    data:new Date().toLocaleDateString('it-IT'),
    dataISO:new Date().toISOString().slice(0,10),
    createdAt:new Date().toISOString(),
    items:(function(){
      var cpy=JSON.parse(JSON.stringify(cart.items));
      cpy.forEach(function(it){
        ensurePrezzoOriginaleDaListino(it, true);
        var sc=it._scontoApplicato||0;
        var base=parsePriceIT(it._prezzoOriginale);
        if(base<=0) return;
        var scOn=it.scampolo||it.fineRotolo;
        if(scOn&&sc>0){
          it.prezzoUnit=(base*(1-sc/100)).toFixed(2);
        }
        if(it._scaglionato&&sc>0){
          var q=parseFloat(it.qty||0);
          if(q>=(it._scaglioneQta||10)){
            it.prezzoUnit=(base*(1-sc/100)).toFixed(2);
          } else {
            it.prezzoUnit=it._prezzoOriginale;
          }
        }
      });
      return cpy;
    })(),
    nota:cart.nota||'',
    totale:tot.toFixed(2),
    stato:'nuovo',
    scontoGlobale:cart.scontoGlobale||null,
    commesso:cart.commesso||''
  };
  ordini.unshift(ord);
  saveOrdini();

  // -- Scarico automatico magazzino --
  var sottoScortaList=[];
  (cart.items||[]).forEach(function(it){
    if(it.rowIdx===undefined||it.rowIdx===null)return;
    var m=magazzino[it.rowIdx];
    if(!m)return;
    var prevQty=m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
    if(prevQty===null)return; // se non ha qty impostata, non scaricare
    var venduto=parseFloat(it.qty||0);
    var nuovaQty=Math.max(0, prevQty - venduto);
    m.qty=nuovaQty;
    lsSet(MAGK, magazzino);
    // Controlla soglia
    var soglia=getSoglia(it.rowIdx);
    if(nuovaQty<=soglia){
      var desc=(rows[it.rowIdx]&&rows[it.rowIdx].desc)||it.desc||'Articolo';
      sottoScortaList.push({desc:desc,qty:nuovaQty,soglia:soglia});
    }
  });
  // Notifica sotto scorta
  if(sottoScortaList.length){
    var msg='- SOTTO SCORTA:\n';
    sottoScortaList.forEach(function(s){
      msg+=s.desc+' - rimasti '+s.qty+' (min: '+s.soglia+')\n';
    });
    setTimeout(function(){
      showToastGen('red',msg.trim());
    },1500);
  }

  // Segna il carrello come "inviato" localmente (read-only, non va su Firebase)
  // saveCarrelli() filtra automaticamente i carrelli inviati — non li condivide
  cart.stato='inviato';
  cart.ordId=ord.id;
  cart.locked=true;
  saveCarrelli();   // ← scrive su Firebase solo i carrelli ancora attivi
  _lastAddedItem=null;
  feedbackSend();
  renderCartTabs();
  showToastGen('green','✅ Ordine #'+numOrd+' inviato! — '+ord.nomeCliente+' — €'+tot.toFixed(2));
}


// ── Modifica nome cliente dal carrello ───────────────────────────
function ctEditClienteName(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart) return;
  var nome = prompt('Nome cliente:', cart.nome || '');
  if(nome === null) return;
  cart.nome = nome.trim();
  saveCarrelli();
  // Aggiorna anche l'ordine collegato
  if(cart.ordId){
    var ord = ordini.find(function(o){ return o.id === cart.ordId; });
    if(ord){ ord.nomeCliente = nome.trim(); saveOrdini(); }
  }
  renderCartTabs();
  showToastGen('green', '✏️ Cliente aggiornato');
}

// ── Imposta quantità minima scaglione (carrello) ─────────────────
function cartSetScaglioneQta(cartId, idx, val){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items[idx]) return;
  cart.items[idx]._scaglioneQta = parseInt(val) || 10;
  saveCarrelli(); renderCartTabs();
}

// ── Override saveCarrelli: aggiorna automaticamente le bozze attive ──
// (core.js definisce saveCarrelli; qui la estendiamo senza toccare database.js)
(function(){
  var _origSaveCarrelli = saveCarrelli;
  saveCarrelli = function(){
    _origSaveCarrelli();
    // Per ogni carrello con bozza attiva, aggiorna la bozza ordine
    (carrelli||[]).forEach(function(cart){
      if(cart.bozzaOrdId && (cart.items||[]).length){
        _aggiornaBozzaOrdine(cart);
      }
    });
  };
})();
