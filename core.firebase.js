// ══ FIREBASE INIT & CARICAMENTO ═══════════════════════════════════
// Mostra indicatore di caricamento subito, prima ancora di connettersi
document.addEventListener('DOMContentLoaded', function(){
  _showLoadingBar('Connessione al database...');
  // Mostra login dopo un attimo (aspetta che Firebase carichi i PIN)
  setTimeout(_authInit, 800);
});

(function(){
  function _safeLsGet(k, d){
    try{
      var v = localStorage.getItem(k);
      return v != null ? JSON.parse(v) : d;
    }catch(e){ return d; }
  }
  function _applySharedValue(path, key, globalVarName, fallbackDefault){
    _fbDb.ref(path).on('value', function(snap){
      var d = snap.val();
      if(d == null){
        if(typeof window[globalVarName] !== 'undefined'){
          // Primo bootstrap: se Firebase è vuoto ma esiste locale, pubblica il locale.
          var local = _safeLsGet(key, fallbackDefault);
          if(local != null && (Array.isArray(local) ? local.length : Object.keys(local || {}).length)){
            _fbSharedSyncing[path] = true;
            try{ _fbDb.ref(path).set(local); }catch(e){}
            setTimeout(function(){ _fbSharedSyncing[path] = false; }, 250);
          }
        }
        return;
      }
      if(_fbSharedSyncing[path]) return;
      _fbSharedSyncing[path] = true;
      try{
        window[globalVarName] = d;
        window.AppStorage.set(key, d);
        if(globalVarName === 'categorie'){
          if(typeof renderCatTree === 'function') renderCatTree();
          if(typeof invRefreshT0 === 'function') invRefreshT0();
          else{
            if(typeof renderMagazzino === 'function') renderMagazzino();
            if(typeof renderInventario === 'function') renderInventario();
          }
        } else if(globalVarName === 'carrelliCestino' || globalVarName === 'ordiniCestino'){
          if(typeof renderCestino === 'function') renderCestino();
        } else if(globalVarName === 'movimenti'){
          if(typeof renderMovimenti === 'function') renderMovimenti();
        }
      }catch(e){
        console.error('FB shared sync apply errore:', path, e);
      }
      setTimeout(function(){ _fbSharedSyncing[path] = false; }, 250);
    });
  }

  try{
    if(firebase && firebase.apps && firebase.apps.length){
      _fb = firebase.app();
    } else {
      _fb=firebase.initializeApp({
        apiKey:"AIzaSyAOCzTjXWAkYEsCkHEMNYQCdnzf6HGaDWY",
        authDomain:"ferramenta-2b546.firebaseapp.com",
        databaseURL:"https://ferramenta-2b546-default-rtdb.europe-west1.firebasedatabase.app",
        projectId:"ferramenta-2b546",
        storageBucket:"ferramenta-2b546.firebasestorage.app",
        messagingSenderId:"103703473598",
        appId:"1:103703473598:web:8f505c79eea852f324ddef"
      });
    }
    _fbDb=firebase.database();
    _fbReady=true;
    _authLoad(); // ricarica nomi/PIN/colori da Firebase ora che la connessione è disponibile
    _initLockListener();
    _initAccountBusyListener();
    // Snapshot degli ID già presenti PRIMA di connettersi — al primo sync non scattano notifiche
    var _idKnown={};
    var _bozzaKnown={};
    var _bozzaSnap={}; // snapshot JSON delle bozze per rilevare aggiornamenti
    ordini.forEach(function(o){if(o&&o.id){_idKnown[o.id]=true; if(o.stato==='bozza'){_bozzaKnown[o.id]=true; _bozzaSnap[o.id]=JSON.stringify(o);}}});
    var _first=true;
    _fbDb.ref('ordini').on('value',function(snap){
      var d=snap.val();
      var fresh=d ? _fbFix(d) : [];
      // Aggiorna sempre _idKnown al primo sync (prima di confrontare)
      if(_first){
        fresh.forEach(function(o){if(o&&o.id){_idKnown[o.id]=true; if(o.stato==='bozza'){_bozzaKnown[o.id]=true; _bozzaSnap[o.id]=JSON.stringify(o);}}});
        _first=false;
      }
      if(JSON.stringify(fresh)===JSON.stringify(ordini)) return;
      _fbSyncing=true;
      try{
        ordini=fresh;lsSet(ORDK,ordini);updateOrdBadge();updateOrdCounter();
        var t=document.getElementById('to');
        if(t&&t.classList.contains('active')) renderOrdini();
        // Solo ordini con stato 'nuovo' che NON erano già noti
        var nuovi=fresh.filter(function(o){return o.stato==='nuovo'&&!_idKnown[o.id];});
        if(nuovi.length){
          nuovi.forEach(function(o){_idKnown[o.id]=true;});
          feedbackSend();
          // Notifica solo per l'ULTIMO ordine arrivato
          mostraNotificaOrdine(nuovi[nuovi.length-1]);
        }
        // Aggiorna _idKnown anche per ordini non-nuovi appena arrivati
        fresh.forEach(function(o){if(o&&o.id)_idKnown[o.id]=true;});
        // Bozze nuove — notifica browser + modal (come per gli ordini normali)
        var nuoveBozze=fresh.filter(function(o){return o.stato==='bozza'&&!_bozzaKnown[o.id];});
        if(nuoveBozze.length){
          nuoveBozze.forEach(function(o){_bozzaKnown[o.id]=true; _bozzaSnap[o.id]=JSON.stringify(o);});
          if(typeof mostraNotificaBozza === 'function'){
            mostraNotificaBozza(nuoveBozze[nuoveBozze.length-1]);
          }
        }
        // Bozze aggiornate — toast in-app per chi sta nella tab ordini
        fresh.forEach(function(o){
          if(o.stato==='bozza' && _bozzaKnown[o.id]){
            var newSnap=JSON.stringify(o);
            if(_bozzaSnap[o.id] && _bozzaSnap[o.id]!==newSnap){
              _bozzaSnap[o.id]=newSnap;
              if(typeof mostraBozzaAggiornata === 'function') mostraBozzaAggiornata(o);
            }
            _bozzaSnap[o.id]=newSnap;
          }
        });
      }catch(e){console.error('FB ordini:',e);}
      _fbSyncing=false;
    });
    _fbDb.ref('carrelli').on('value',function(snap){
      // Flag SEPARATO: non interferisce con la sync degli ordini
      if(_fbSyncingCart) return;
      var d = snap.val();
      // Firebase manda null se non ci sono carrelli — normale
      var fresh = d ? _fbFix(d) : [];
      if(JSON.stringify(fresh) === JSON.stringify(carrelli)) return;
      _fbSyncingCart = true;
      try{
        console.log('[CART] sync Firebase — totale condiviso:', fresh.length);
        carrelli = fresh;
        lsSet(CARTK, carrelli);
        updateCartBadge();
        // Se activeCartId non esiste più tra i carrelli attivi, prendi l'ultimo attivo
        var cartAttivoEsiste = carrelli.find(function(c){ return c.id === activeCartId && c.stato !== 'inviato'; });
        if(!cartAttivoEsiste){
          var attivi = carrelli.filter(function(c){ return c.stato !== 'inviato'; });
          activeCartId = attivi.length ? attivi[attivi.length-1].id : (carrelli.length ? carrelli[carrelli.length-1].id : null);
          console.log('[CART] activeCartId corretto a:', activeCartId);
        }
        var t = document.getElementById('tc');
        if(t && t.classList.contains('active')) renderCartTabs();
      }catch(e){ console.error('[CART] sync Firebase errore:', e); }
      setTimeout(function(){ _fbSyncingCart = false; }, 300);
    });

    // Dataset condivisi: identici su tutti gli account/dispositivi
    _applySharedValue('shared/categorie', window.AppKeys.CATEGORIE, 'categorie', []);
    _applySharedValue('shared/carrelli_cestino', window.AppKeys.CARRELLI_CESTINO, 'carrelliCestino', []);
    _applySharedValue('shared/ordini_archivio', window.AppKeys.ORDINI_ARCHIVIO, 'ordiniArchivio', []);
    _applySharedValue('shared/ordini_cestino', window.AppKeys.ORDINI_CESTINO, 'ordiniCestino', []);
    _applySharedValue('shared/movimenti', window.AppKeys.MOVIMENTI, 'movimenti', []);
    _applySharedValue('shared/clienti', window.AppKeys.CLIENTI, 'clienti', {});
    _applySharedValue('shared/fatture', window.AppKeys.FATTURE, 'fatture', []);
    _applySharedValue('shared/ordini_fornitori', window.AppKeys.ORDFORNITORI, 'ordFornitori', []);
    _applySharedValue('shared/forni_colore', window.AppKeys.FORNI_COLORE, 'forniColore', {});
    _applySharedValue('shared/ord_forn_storico', window.AppKeys.ORD_FORN_STORICO, 'ordFornStorico', []);

    // ── Avvia caricamento catalogo IMMEDIATAMENTE all'apertura ──
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(loadMagazzinoFB, 50); });
    } else {
      setTimeout(loadMagazzinoFB, 50);
    }

    console.log('Firebase connesso');
  }catch(e){console.error('Firebase:',e);_hideLoadingBar();}
})();
