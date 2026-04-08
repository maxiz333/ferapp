// ══ LOCK COLLABORATIVO ORDINI ═══════════════════════════════════
// Nodo Firebase: ordiniLocks/{sanitizedOrdId} = { by, name, at } (at = server timestamp)
var LOCK_EXPIRE = 5 * 60 * 1000; // lock altrui considerato valido se più recente di 5 min
var ORD_LOCKS_FB = 'ordiniLocks';
var _ordLocks = {};
var _ordLocksSnapshotJson = '';
/** Dopo acquisizione lock (transaction): maschera solo se lo snapshot non mostra già un altro titolare */
var _ordLockUiGrace = {};
var LOCK_UI_GRACE_MS = 2500;
/** Dopo forzatura: il listener può essere in ritardo — breve periodo in cui non mostriamo overlay al dispositivo che ha scritto */
var _ordForceLockGrace = {};
var LOCK_FORCE_GRACE_MS = 3000;
var _deviceId = localStorage.getItem(window.AppKeys.DEVICE_ID) || ('dev_' + Date.now() + '_' + Math.random().toString(36).substr(2,6));
localStorage.setItem(window.AppKeys.DEVICE_ID, _deviceId);
var _deviceName = localStorage.getItem(window.AppKeys.DEVICE_NAME) || _deviceId;

function _lockKey(ordId){ return String(ordId).replace(/[.#$/\[\]]/g, '_'); }

function _ordLockPayload(){
  var lockBy = (_currentUser ? _currentUser.key : _deviceId);
  var lockName = (_currentUser ? _currentUser.nome : _deviceName);
  return { by: lockBy, name: lockName, at: firebase.database.ServerValue.TIMESTAMP };
}

function _ordLockLocalCopy(){
  var lockBy = (_currentUser ? _currentUser.key : _deviceId);
  var lockName = (_currentUser ? _currentUser.nome : _deviceName);
  return { by: lockBy, name: lockName, at: Date.now() };
}

/**
 * Acquisisce il lock su Firebase (ordiniLocks). Non modifica rows/ordini[].
 * @param force se true sovrascrive sempre (triplo tap). Se false = first-come: transaction, fallisce se lock fresco altrui.
 * @param callback(ok) opzionale
 */
function ordAcquireOrderLock(ordId, options, callback){
  if(typeof options === 'function'){ callback = options; options = {}; }
  options = options || {};
  var force = !!options.force;
  var cb = typeof callback === 'function' ? callback : function(){};
  var key = _lockKey(ordId);
  var lockBy = (_currentUser ? _currentUser.key : _deviceId);
  var refPath = ORD_LOCKS_FB + '/' + key;

  function finish(ok, isForce){
    if(ok){
      if(isForce) _ordForceLockGrace[key] = Date.now() + LOCK_FORCE_GRACE_MS;
      else _ordLockUiGrace[key] = Date.now() + LOCK_UI_GRACE_MS;
      _accountBusySet(ordId);
    }
    cb(ok);
  }

  if(!_fbReady || !_fbDb){
    if(force || !ordIsLockedByOther(ordId)){
      _ordLocks[key] = _ordLockLocalCopy();
      finish(true, !!force);
    } else {
      finish(false, false);
    }
    return;
  }

  var ref = _fbDb.ref(refPath);

  if(force){
    var pay = _ordLockPayload();
    _ordLocks[key] = _ordLockLocalCopy();
    ref.set(pay, function(err){
      if(err){
        console.error('[LOCK] ordAcquireOrderLock force err:', err);
        delete _ordLocks[key];
        finish(false, false);
        return;
      }
      finish(true, true);
    });
    return;
  }

  ref.transaction(function(current){
    var now = Date.now();
    if(!current) return _ordLockPayload();
    var at = current.at;
    if(typeof at !== 'number' || isNaN(at) || (now - at) > LOCK_EXPIRE) return _ordLockPayload();
    if(String(current.by) === String(lockBy)) return _ordLockPayload();
    return undefined;
  }, function(error, committed, snapshot){
    if(error){
      console.error('[LOCK] transaction err:', error);
      finish(false, false);
      return;
    }
    if(!committed){
      finish(false, false);
      return;
    }
    var v = snapshot.val();
    if(v && typeof v.at === 'number') _ordLocks[key] = v;
    else _ordLocks[key] = _ordLockLocalCopy();
    finish(true, false);
  });
}

/** @deprecated Usare ordAcquireOrderLock; mantenuto per compat: forza lock senza callback */
function ordLock(ordId){
  ordAcquireOrderLock(ordId, { force: true });
}

function ordUnlock(ordId){
  var key = _lockKey(ordId);
  delete _ordLockUiGrace[key];
  delete _ordForceLockGrace[key];
  delete _ordLocks[key];
  if(_fbReady && _fbDb){
    try{ _fbDb.ref(ORD_LOCKS_FB + '/' + key).remove(); }catch(e){}
  }
  _accountBusyClear();
}

function ordIsLockedByOther(ordId){
  var key = _lockKey(ordId);
  var lock = _ordLocks[key];
  var myId = (_currentUser ? _currentUser.key : _deviceId);
  var fg = _ordForceLockGrace[key];
  if(fg && Date.now() < fg) return false;
  var gu = _ordLockUiGrace[key];
  if(gu && Date.now() < gu && (!lock || String(lock.by) === String(myId))) return false;
  if(!lock) return false;
  if(String(lock.by) === String(myId)) return false;
  var at = lock.at;
  if(typeof at !== 'number' || isNaN(at)) return false;
  if(Date.now() - at > LOCK_EXPIRE) return false;
  return lock;
}

// ── LOCK PER-ACCOUNT: segnala su Firebase che questo account è occupato ──────
// Struttura Firebase: accountBusy/{accountKey} = { ordId, name, at }
var _myAccountBusyOrdId = null; // traccia l'ordine su cui siamo occupati

function _accountBusySet(ordId){
  if(!_fbReady || !_fbDb || !_currentUser) return;
  _myAccountBusyOrdId = ordId;
  var data = {
    ordId: ordId,
    name: _currentUser.nome,
    ruolo: _currentUser.ruolo,
    at: Date.now()
  };
  try{ _fbDb.ref('accountBusy/' + _currentUser.key).set(data); }catch(e){}
}

function _accountBusyClear(){
  _myAccountBusyOrdId = null;
  if(!_fbReady || !_fbDb || !_currentUser) return;
  try{ _fbDb.ref('accountBusy/' + _currentUser.key).remove(); }catch(e){}
}

// Restituisce info su account occupati (esclude il proprio)
// Ritorna array di { key, name, ordId } oppure [] se nessuno occupato
var _accountBusyMap = {};

function _initAccountBusyListener(){
  if(!_fbReady || !_fbDb) return;
  _fbDb.ref('accountBusy').on('value', function(snap){
    _accountBusyMap = snap.val() || {};
  });
}

// Ritorna stringa "⚠️ Banco 1 è occupato su Ordine #X" se l'ordine è in lavorazione da un altro account
// Usato nell'UI per mostrare avvisi contestuali (non blocca, solo informa)
function getAccountBusyWarning(ordId){
  var myKey = _currentUser ? _currentUser.key : null;
  var warnings = [];
  Object.keys(_accountBusyMap).forEach(function(k){
    if(k === myKey) return; // ignora se stesso
    var b = _accountBusyMap[k];
    if(!b) return;
    // Avvisa solo se è sullo stesso ordine O se vuoi vedere tutti gli occupati
    if(b.ordId === ordId){
      warnings.push('⚠️ ' + (b.name || k) + ' sta lavorando su questo ordine');
    }
  });
  return warnings.join(' · ');
}

// ordIsLockedByOther — stub sopra (lock disabilitato)

function _initLockListener(){
  if(!_fbReady || !_fbDb) return;
  _fbDb.ref(ORD_LOCKS_FB).on('value', function(snap){
    var d = snap.val();
    var flat = d || {};
    var js = JSON.stringify(flat);
    if(js === _ordLocksSnapshotJson) return;
    _ordLocksSnapshotJson = js;
    _ordLocks = flat;
    if(document.querySelector('.ord-inline-input')) return;
    var t = document.getElementById('to');
    if(t && t.classList.contains('active')){
      try{ renderOrdini(); }catch(e){}
    }
  });
}

/** Dopo forzatura lock: refresh UI subito (tab ordini attiva) */
function ordRefreshLockUI(){
  var t = document.getElementById('to');
  if(t && t.classList.contains('active') && !document.querySelector('.ord-inline-input')){
    try{ renderOrdini(); }catch(e){}
  }
  requestAnimationFrame(function(){
    if(document.querySelector('.ord-inline-input')) return;
    try{ if(typeof renderOrdini === 'function') renderOrdini(); }catch(e){}
  });
}

// ── Cleanup automatico lock alla chiusura della pagina ───────────────────────
// Se l'utente chiude il browser o cambia pagina, rilascia lock e accountBusy
window.addEventListener('beforeunload', function(){
  _accountBusyClear();
  // Rilascia tutti i lock acquisiti da questo account
  if(_fbReady && _fbDb && _currentUser){
    try{ _fbDb.ref('accountBusy/' + _currentUser.key).remove(); }catch(e){}
  }
});
