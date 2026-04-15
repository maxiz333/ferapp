// ══ FIREBASE INIT & CARICAMENTO ═══════════════════════════════════
// Mostra indicatore di caricamento subito, prima ancora di connettersi
document.addEventListener('DOMContentLoaded', function(){
  _showLoadingBar('Connessione al database...');
  // Mostra login dopo un attimo (aspetta che Firebase carichi i PIN)
  setTimeout(_authInit, 800);
});

var _dbMaintRunning = false;
var _dbMaintTimer = null;
var _dbMaintInterval = null;
var DB_MAINT_LAST_KEY = 'cp4_db_maintenance_last_run';
var DB_MAINT_CFG_KEY = 'cp4_db_maintenance_cfg';
var DB_MAINT_DEFAULT_CFG = {
  rowsLimitTotal: 1200,
  rowsLimitLocks: 300,
  rowsLimitAlerts: 500,
  rowsLimitTmp: 500
};
function _dbMaintReadCfg(){
  var cfg = {};
  try{
    cfg = JSON.parse(localStorage.getItem(DB_MAINT_CFG_KEY) || '{}') || {};
  }catch(e){ cfg = {}; }
  if(typeof window !== 'undefined' && window.AppDbMaintenanceConfig && typeof window.AppDbMaintenanceConfig === 'object'){
    Object.keys(window.AppDbMaintenanceConfig).forEach(function(k){ cfg[k] = window.AppDbMaintenanceConfig[k]; });
  }
  return Object.assign({}, DB_MAINT_DEFAULT_CFG, cfg);
}
var _dbMaintCfg = _dbMaintReadCfg();
var DB_MAINT_DAY_MS = 24 * 60 * 60 * 1000;
var DB_MAINT_LOCK_MAX_AGE = 24 * 60 * 60 * 1000;
var DB_MAINT_ALERT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
var DB_MAINT_TMP_MAX_AGE = 48 * 60 * 60 * 1000;
var DB_MAINT_ROWS_LIMIT_TOTAL = Number(_dbMaintCfg.rowsLimitTotal) || DB_MAINT_DEFAULT_CFG.rowsLimitTotal;
var DB_MAINT_ROWS_LIMIT_LOCKS = Number(_dbMaintCfg.rowsLimitLocks) || DB_MAINT_DEFAULT_CFG.rowsLimitLocks;
var DB_MAINT_ROWS_LIMIT_ALERTS = Number(_dbMaintCfg.rowsLimitAlerts) || DB_MAINT_DEFAULT_CFG.rowsLimitAlerts;
var DB_MAINT_ROWS_LIMIT_TMP = Number(_dbMaintCfg.rowsLimitTmp) || DB_MAINT_DEFAULT_CFG.rowsLimitTmp;

function _dbMaintGetLastRun(){
  try{
    return Number(localStorage.getItem(DB_MAINT_LAST_KEY) || 0) || 0;
  }catch(e){
    return 0;
  }
}

function _dbMaintSetLastRun(ts){
  try{ localStorage.setItem(DB_MAINT_LAST_KEY, String(ts || Date.now())); }catch(e){}
}

function _dbMaintObjectCount(v){
  if(!v || typeof v !== 'object') return 0;
  return Object.keys(v).length;
}

function _dbMaintPickTimestamp(v){
  if(v == null) return 0;
  if(typeof v === 'number' && isFinite(v) && v > 0) return v;
  if(typeof v === 'string'){
    var asNum = Number(v);
    if(isFinite(asNum) && asNum > 0) return asNum;
    var asDate = Date.parse(v);
    if(isFinite(asDate) && asDate > 0) return asDate;
  }
  if(typeof v !== 'object') return 0;
  var keys = [
    'at','ts','time','timestamp','updatedAt','createdAt','lastUpdate','lastUpdatedAt',
    'date','data','readAt','seenAt','completedAt','doneAt'
  ];
  for(var i=0;i<keys.length;i++){
    var n = _dbMaintPickTimestamp(v[keys[i]]);
    if(n > 0) return n;
  }
  return 0;
}

function _dbMaintIsReadOrCompleted(v){
  if(!v || typeof v !== 'object') return false;
  if(v.letta === true || v.letto === true || v.visto === true || v.read === true || v.seen === true) return true;
  if(v.completata === true || v.completato === true || v.completed === true || v.done === true || v.chiusa === true) return true;
  var stato = String(v.stato || '').toLowerCase();
  if(stato === 'completato' || stato === 'completata' || stato === 'chiuso' || stato === 'chiusa' || stato === 'letto' || stato === 'letta') return true;
  return false;
}

function _dbMaintNeedsRun(meta, force){
  _dbMaintCfg = _dbMaintReadCfg();
  DB_MAINT_ROWS_LIMIT_TOTAL = Number(_dbMaintCfg.rowsLimitTotal) || DB_MAINT_DEFAULT_CFG.rowsLimitTotal;
  DB_MAINT_ROWS_LIMIT_LOCKS = Number(_dbMaintCfg.rowsLimitLocks) || DB_MAINT_DEFAULT_CFG.rowsLimitLocks;
  DB_MAINT_ROWS_LIMIT_ALERTS = Number(_dbMaintCfg.rowsLimitAlerts) || DB_MAINT_DEFAULT_CFG.rowsLimitAlerts;
  DB_MAINT_ROWS_LIMIT_TMP = Number(_dbMaintCfg.rowsLimitTmp) || DB_MAINT_DEFAULT_CFG.rowsLimitTmp;
  if(force) return true;
  var now = Date.now();
  var last = _dbMaintGetLastRun();
  if(!last || (now - last) >= DB_MAINT_DAY_MS) return true;
  if(meta.total > DB_MAINT_ROWS_LIMIT_TOTAL) return true;
  if(meta.locks > DB_MAINT_ROWS_LIMIT_LOCKS) return true;
  if(meta.alerts > DB_MAINT_ROWS_LIMIT_ALERTS) return true;
  if(meta.tmp > DB_MAINT_ROWS_LIMIT_TMP) return true;
  return false;
}

function dbSystemMaintenance(options){
  options = options || {};
  if(_dbMaintRunning) return Promise.resolve(false);
  if(!_fbReady || !_fbDb) return Promise.resolve(false);

  _dbMaintRunning = true;
  var now = Date.now();
  var force = !!options.force;
  var rootRef = _fbDb.ref();

  return Promise.all([
    _fbDb.ref('ordiniLocks').once('value'),
    _fbDb.ref('segnalazioniUfficio').once('value'),
    _fbDb.ref('notifiche/segnalazioniUfficio').once('value'),
    _fbDb.ref('movimentiTemporanei').once('value'),
    _fbDb.ref('logTemporanei').once('value')
  ]).then(function(snaps){
    var locks = snaps[0].val() || {};
    var segnalazioni = snaps[1].val() || {};
    var segnalazioniNotif = snaps[2].val() || {};
    var movTmp = snaps[3].val() || {};
    var logTmp = snaps[4].val() || {};

    var meta = {
      locks: _dbMaintObjectCount(locks),
      alerts: _dbMaintObjectCount(segnalazioni) + _dbMaintObjectCount(segnalazioniNotif),
      tmp: _dbMaintObjectCount(movTmp) + _dbMaintObjectCount(logTmp)
    };
    meta.total = meta.locks + meta.alerts + meta.tmp;

    if(!_dbMaintNeedsRun(meta, force)) return false;

    var updates = {};
    var removed = 0;

    Object.keys(locks).forEach(function(k){
      var row = locks[k];
      var at = _dbMaintPickTimestamp(row);
      if(at > 0 && (now - at) > DB_MAINT_LOCK_MAX_AGE){
        updates['ordiniLocks/' + k] = null;
        removed++;
      }
    });

    function cleanSegnalazioni(path, data){
      Object.keys(data).forEach(function(k){
        var row = data[k];
        if(!_dbMaintIsReadOrCompleted(row)) return;
        var at = _dbMaintPickTimestamp(row);
        if(at > 0 && (now - at) > DB_MAINT_ALERT_MAX_AGE){
          updates[path + '/' + k] = null;
          removed++;
        }
      });
    }
    cleanSegnalazioni('segnalazioniUfficio', segnalazioni);
    cleanSegnalazioni('notifiche/segnalazioniUfficio', segnalazioniNotif);

    function cleanTmp(path, data){
      Object.keys(data).forEach(function(k){
        var row = data[k];
        var at = _dbMaintPickTimestamp(row);
        if(at > 0 && (now - at) > DB_MAINT_TMP_MAX_AGE){
          updates[path + '/' + k] = null;
          removed++;
        }
      });
    }
    cleanTmp('movimentiTemporanei', movTmp);
    cleanTmp('logTemporanei', logTmp);

    var done = function(){
      _dbMaintSetLastRun(now);
      console.log('Manutenzione Database: Rimossi ' + removed + ' elementi obsoleti. Database ottimizzato.');
      return true;
    };
    if(!removed) return done();
    return new Promise(function(resolve){
      rootRef.update(updates, function(err){
        if(err) console.warn('Manutenzione Database: aggiornamento incompleto', err);
        resolve(done());
      });
    });
  }).catch(function(err){
    console.warn('Manutenzione Database: errore durante la pulizia', err);
    return false;
  }).then(function(res){
    _dbMaintRunning = false;
    return res;
  }, function(err){
    _dbMaintRunning = false;
    throw err;
  });
}

function _scheduleDbSystemMaintenance(){
  if(_dbMaintTimer) clearTimeout(_dbMaintTimer);
  if(_dbMaintInterval) clearInterval(_dbMaintInterval);
  _dbMaintTimer = setTimeout(function(){ dbSystemMaintenance({ reason: 'startup' }); }, 1500);
  _dbMaintInterval = setInterval(function(){ dbSystemMaintenance({ reason: 'health-check' }); }, 30 * 60 * 1000);
}

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
      if(Array.isArray(fresh)){
        fresh.forEach(function(o){
          if(!o) return;
          if(typeof o.visto !== 'boolean') o.visto = typeof _ordVistoCoerceBool === 'function' ? _ordVistoCoerceBool(o.visto) : !!o.visto;
        });
      }
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

    _scheduleDbSystemMaintenance();
    console.log('Firebase connesso');
  }catch(e){console.error('Firebase:',e);_hideLoadingBar();}
})();
