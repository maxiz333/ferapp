// ══ FIREBASE INIT & CARICAMENTO ═══════════════════════════════════
// Mostra indicatore di caricamento subito, prima ancora di connettersi
document.addEventListener('DOMContentLoaded', function(){
  _showLoadingBar('Connessione al database...');
  // Mostra login dopo un attimo (aspetta che Firebase carichi i PIN)
  setTimeout(_authInit, 800);
});

(function(){
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
      if(_fbSyncing)return;
      var d=snap.val();if(!d)return;
      var fresh=_fbFix(d);
      // Aggiorna sempre _idKnown al primo sync (prima di confrontare)
      if(_first){
        fresh.forEach(function(o){if(o&&o.id){_idKnown[o.id]=true; if(o.stato==='bozza'){_bozzaKnown[o.id]=true; _bozzaSnap[o.id]=JSON.stringify(o);}}});
        _first=false;
      }
      if(JSON.stringify(fresh)===JSON.stringify(ordini))return;
      _fbSyncing=true;
      try{
        ordini=fresh;lsSet(ORDK,ordini);updateOrdBadge();updateOrdCounter();
        var t=document.getElementById('to');if(t&&t.classList.contains('active')&&!document.querySelector('.ord-inline-input'))renderOrdini();
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
      setTimeout(function(){_fbSyncing=false;},500);
    });
    _fbDb.ref('carrelli').on('value',function(snap){
      // Flag SEPARATO: non interferisce con la sync degli ordini
      if(_fbSyncingCart) return;
      var d = snap.val();
      // Firebase manda null se non ci sono carrelli attivi — normale
      var fresh = d ? _fbFix(d) : [];
      // Fonde i carrelli Firebase con quelli locali già inviati (che non sono su Firebase)
      // Mantiene i carrelli "inviato" che ho già localmente — non li perde
      var inviatiLocali = carrelli.filter(function(c){ return c.stato === 'inviato'; });
      var merged = fresh.concat(inviatiLocali.filter(function(inv){
        return !fresh.find(function(f){ return f.id === inv.id; });
      }));
      if(JSON.stringify(merged) === JSON.stringify(carrelli)) return;
      _fbSyncingCart = true;
      try{
        console.log('[CART] sync Firebase — attivi:', fresh.length, 'inviati locali:', inviatiLocali.length);
        carrelli = merged;
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

    // ── Avvia caricamento catalogo IMMEDIATAMENTE all'apertura ──
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(loadMagazzinoFB, 50); });
    } else {
      setTimeout(loadMagazzinoFB, 50);
    }

    console.log('Firebase connesso');
  }catch(e){console.error('Firebase:',e);_hideLoadingBar();}
})();
