// ══ PUSH FIREBASE + SALVA CARRELLI / ORDINI ═══════════════════════
function _fbPush(ref,data){
  // Non bloccare le scritture durante una fase di sync UI locale:
  // altrimenti alcune modifiche (es. bozza da carrello) non arrivano agli altri device.
  if(!_fbReady) return;
  try{ _fbDb.ref(ref).set(data); }catch(e){}
}

// ══ ORDINI: meta Firebase + guard anti-sovrascrittura (cassa obsoleta) ══
var _ordRemoteMeta = null;
var _ordLocalSyncedAt = 0;
var _ordSavePending = false;

function _ordNormStato(stato){
  if(stato === 'lavorazione') return 'nuovo';
  return String(stato || '');
}

function _ordIsReopenTargetStato(st){
  return st === 'nuovo' || st === 'pronto' || st === 'bozza' || st === 'annullato';
}

function _ordCountMetrics(arr){
  arr = arr || [];
  var m = { total: 0, completati: 0, pronti: 0, nuovi: 0, bozze: 0 };
  arr.forEach(function(o){
    if(!o) return;
    m.total++;
    var st = _ordNormStato(o.stato);
    if(st === 'completato') m.completati++;
    else if(st === 'pronto') m.pronti++;
    else if(st === 'bozza') m.bozze++;
    else if(st === 'nuovo') m.nuovi++;
  });
  return m;
}

/** Ordini completati sul server ma non più in locale (riapertura volontaria). */
function _ordCollectCompletatoDowngradeIds(localArr, remoteArr){
  var remoteById = {};
  (remoteArr || []).forEach(function(ro){
    if(ro && ro.id) remoteById[ro.id] = ro;
  });
  var ids = [];
  (localArr || []).forEach(function(lo){
    if(!lo || !lo.id) return;
    var ro = remoteById[lo.id];
    if(!ro) return;
    if(_ordNormStato(ro.stato) !== 'completato') return;
    if(_ordNormStato(lo.stato) === 'completato') return;
    if(_ordIsReopenTargetStato(_ordNormStato(lo.stato))) ids.push(lo.id);
  });
  return ids;
}

function _ordLocalIdSet(arr){
  var set = {};
  (arr || []).forEach(function(o){
    if(o && o.id) set[o.id] = true;
  });
  return set;
}

/** ID presenti sul server ma rimossi in locale (cancellazione / cestino). */
function _ordCollectRemovedIds(localArr, remoteArr){
  var localIds = _ordLocalIdSet(localArr);
  var removed = [];
  (remoteArr || []).forEach(function(ro){
    if(ro && ro.id && !localIds[ro.id]) removed.push(ro.id);
  });
  return removed;
}

function _ordDeclaredDeleteIds(opts){
  if(!opts || !opts.intentionalDelete) return [];
  var d = opts.intentionalDelete;
  if(d.ids && d.ids.length) return d.ids.slice();
  if(d.id) return [d.id];
  return [];
}

/** Consente push se il totale cala solo per ordini eliminati volutamente. */
function _ordAllowsTotalDecrease(localArr, remoteArr, opts){
  var localM = _ordCountMetrics(localArr);
  var remoteM = _ordCountMetrics(remoteArr);
  if(remoteM.total <= localM.total) return false;

  var delta = remoteM.total - localM.total;
  var removedIds = _ordCollectRemovedIds(localArr, remoteArr);
  if(removedIds.length !== delta) return false;

  var declared = _ordDeclaredDeleteIds(opts);
  if(declared.length){
    for(var i = 0; i < declared.length; i++){
      if(removedIds.indexOf(declared[i]) < 0) return false;
    }
    return true;
  }

  if(delta === 1 && removedIds.length === 1) return true;
  return false;
}

/** Calo completati spiegato solo da ordini rimossi (non riapertura). */
function _ordCompletatiDecreaseFromRemoval(localArr, remoteArr, removedIds){
  if(!removedIds || !removedIds.length) return false;
  var remoteById = {};
  (remoteArr || []).forEach(function(ro){
    if(ro && ro.id) remoteById[ro.id] = ro;
  });
  var lostCompletati = 0;
  removedIds.forEach(function(id){
    var ro = remoteById[id];
    if(ro && _ordNormStato(ro.stato) === 'completato') lostCompletati++;
  });
  var localM = _ordCountMetrics(localArr);
  var remoteM = _ordCountMetrics(remoteArr);
  return (remoteM.completati - localM.completati) === lostCompletati;
}

/** Consente push se il calo dei completati è solo da riaperture, non da client obsoleto. */
function _ordAllowsCompletatiDecrease(localArr, remoteArr, opts){
  var localM = _ordCountMetrics(localArr);
  var remoteM = _ordCountMetrics(remoteArr);
  if(remoteM.completati <= localM.completati) return false;

  var delta = remoteM.completati - localM.completati;
  var downgradeIds = _ordCollectCompletatoDowngradeIds(localArr, remoteArr);
  if(downgradeIds.length !== delta) return false;

  if(opts && opts.intentionalReopen && opts.intentionalReopen.id){
    if(downgradeIds.indexOf(opts.intentionalReopen.id) < 0) return false;
    if(downgradeIds.length === 1) return true;
  }

  // Client allineato: un solo ordine riaperto (es. Riapri in tab Ordini)
  if(delta === 1 && downgradeIds.length === 1) return true;

  return false;
}

/** Opzioni saveOrdini quando si esce da completato verso nuovo/pronto/bozza. */
function _ordSaveOptsForStateChange(prevStato, nextStato, orderId){
  var prev = _ordNormStato(prevStato);
  var next = _ordNormStato(nextStato);
  if(prev !== 'completato' || next === 'completato') return null;
  if(!orderId || !_ordIsReopenTargetStato(next)) return null;
  return { intentionalReopen: { id: orderId, from: 'completato', to: next } };
}
window._ordSaveOptsForStateChange = _ordSaveOptsForStateChange;

/** Opzioni saveOrdini per eliminazione ordine (cestino o rimozione definitiva da ordini[]). */
function _ordSaveOptsForDelete(orderOrIds){
  if(!orderOrIds) return null;
  if(Array.isArray(orderOrIds)){
    var ids = orderOrIds.filter(function(id){ return !!id; });
    return ids.length ? { intentionalDelete: { ids: ids } } : null;
  }
  var id = (typeof orderOrIds === 'object' && orderOrIds.id) ? orderOrIds.id : orderOrIds;
  return id ? { intentionalDelete: { ids: [id] } } : null;
}
window._ordSaveOptsForDelete = _ordSaveOptsForDelete;

function _ordSaveOptsForArchive(orderIds){
  if(!orderIds || !orderIds.length) return null;
  var ids = orderIds.filter(function(id){ return !!id; });
  return ids.length ? { intentionalDelete: { ids: ids } } : null;
}
window._ordSaveOptsForArchive = _ordSaveOptsForArchive;

function _ordShouldBlockFirebasePush(localArr, remoteArr, remoteMeta, opts){
  if(opts && opts.reconciliation) return false;
  var localM = _ordCountMetrics(localArr);
  var remoteM = _ordCountMetrics(remoteArr);
  if(!remoteM.total) return false;

  var removedIds = _ordCollectRemovedIds(localArr, remoteArr);
  var allowDelete = remoteM.total > localM.total &&
    _ordAllowsTotalDecrease(localArr, remoteArr, opts);

  if(remoteM.completati > localM.completati){
    if(_ordAllowsCompletatiDecrease(localArr, remoteArr, opts)) return false;
    if(allowDelete && _ordCompletatiDecreaseFromRemoval(localArr, remoteArr, removedIds)) return false;
    return true;
  }
  if(remoteM.total > localM.total){
    if(allowDelete) return false;
    if(remoteM.completati >= localM.completati) return true;
    return true;
  }

  return false;
}

function _ordApplyRemoteSnapshot(fresh, meta, opts){
  opts = opts || {};
  if(typeof _fbFix === 'function') fresh = _fbFix(fresh);
  else if(!Array.isArray(fresh)) fresh = [];
  if(Array.isArray(fresh)){
    fresh.forEach(function(o){
      if(!o) return;
      if(typeof o.visto !== 'boolean' && typeof _ordVistoCoerceBool === 'function'){
        o.visto = _ordVistoCoerceBool(o.visto);
      }
    });
  }
  ordini = fresh;
  lsSet(ORDK, ordini);
  if(meta) _ordRemoteMeta = meta;
  if(meta && meta.updatedAt) _ordLocalSyncedAt = Number(meta.updatedAt);
  if(typeof updateOrdBadge === 'function') updateOrdBadge();
  if(typeof updateOrdCounter === 'function') updateOrdCounter();
  if(opts.renderOrdini !== false && typeof renderOrdini === 'function'){
    var to = document.getElementById('to');
    if(!opts.onlyIfTabActive || (to && to.classList.contains('active'))) renderOrdini();
  }
  if(typeof _cassaModeActive !== 'undefined' && _cassaModeActive && typeof _cassaModeRender === 'function'){
    if(typeof _cassaModeOpenOrdId !== 'undefined' && _cassaModeOpenOrdId){
      // dettaglio aperto: dati aggiornati in memoria, DOM congelato
    } else {
      _cassaModeRender();
    }
  }
  if(typeof renderCartTabs === 'function'){
    var tc = document.getElementById('tc');
    if(tc && tc.classList.contains('active') &&
       !(typeof cartNoteFieldHasFocus === 'function' && cartNoteFieldHasFocus()) &&
       !(typeof cartSearchFieldActive === 'function' && cartSearchFieldActive())){
      renderCartTabs();
    }
  }
}

function fetchOrdiniFromFirebase(opts, cb){
  if(typeof opts === 'function'){ cb = opts; opts = {}; }
  opts = opts || {};
  if(!_fbReady || !_fbDb){ if(cb) cb(false); return; }
  var metaRef = _fbDb.ref('ordini_meta');
  var ordRef = _fbDb.ref('ordini');
  metaRef.once('value', function(metaSnap){
    ordRef.once('value', function(ordSnap){
      var fresh = ordSnap.val();
      var meta = metaSnap.val() || _ordRemoteMeta || null;
      _ordApplyRemoteSnapshot(fresh, meta, { renderOrdini: opts.renderOrdini !== false });
      if(opts.toast && typeof showToastGen === 'function'){
        showToastGen('blue', 'Ordini aggiornati dal server');
      }
      if(cb) cb(true);
    });
  });
}
window.fetchOrdiniFromFirebase = fetchOrdiniFromFirebase;
window._ordApplyRemoteSnapshot = _ordApplyRemoteSnapshot;

function _ordPushToFirebase(localSnapshot, opts){
  opts = opts || {};
  if(!_fbReady || !_fbDb) return;
  if(_ordSavePending) return;
  _ordSavePending = true;

  var ordRef = _fbDb.ref('ordini');
  var metaRef = _fbDb.ref('ordini_meta');

  ordRef.once('value', function(snap){
    var remoteArr = typeof _fbFix === 'function' ? _fbFix(snap.val()) : (snap.val() || []);
    var localM = _ordCountMetrics(localSnapshot);
    var remoteM = _ordCountMetrics(remoteArr);

    metaRef.once('value', function(metaSnap){
      var remoteMeta = metaSnap.val() || _ordRemoteMeta || null;
      if(!remoteMeta && remoteArr.length){
        remoteMeta = { updatedAt: 0, completati: remoteM.completati, total: remoteM.total };
      }

      if(_ordShouldBlockFirebasePush(localSnapshot, remoteArr, remoteMeta, opts)){
        _ordSavePending = false;
        _ordApplyRemoteSnapshot(remoteArr, remoteMeta, { renderOrdini: true });
        if(typeof showToastGen === 'function'){
          showToastGen('orange',
            'Salvataggio bloccato: il server ha più ordini completati (' + remoteM.completati +
            ' vs ' + localM.completati + '). Lista aggiornata.');
        }
        if(opts.onBlocked) opts.onBlocked(remoteArr, remoteMeta);
        return;
      }

      var now = Date.now();
      var deviceId = (window.AppKeys && localStorage.getItem(window.AppKeys.DEVICE_ID)) || '';
      var metaOut = {
        updatedAt: now,
        completati: localM.completati,
        total: localM.total,
        pronti: localM.pronti,
        by: deviceId
      };
      try{
        metaRef.set(metaOut);
        ordRef.set(localSnapshot);
        _ordRemoteMeta = metaOut;
        _ordLocalSyncedAt = now;
      }catch(e){
        console.error('FB ordini save:', e);
      }
      _ordSavePending = false;
    });
  });
}

// Sync unificata localStorage -> Firebase per dataset condivisi globali
var _fbSharedSyncing = {};
function _fbSharedPathForKey(k){
  var AK = window.AppKeys || {};
  var map = {};
  map[AK.CATEGORIE] = 'shared/categorie';
  map[AK.CARRELLI_CESTINO] = 'shared/carrelli_cestino';
  map[AK.ORDINI_ARCHIVIO] = 'shared/ordini_archivio';
  map[AK.ORDINI_CESTINO] = 'shared/ordini_cestino';
  map[AK.MOVIMENTI] = 'shared/movimenti';
  map[AK.CLIENTI] = 'shared/clienti';
  map[AK.FATTURE] = 'shared/fatture';
  map[AK.ANAGRAFICA_CLIENTI] = 'shared/anagrafica_clienti';
  map[AK.ORDFORNITORI] = 'shared/ordini_fornitori';
  map[AK.FORNI_COLORE] = 'shared/forni_colore';
  map[AK.ORD_FORN_STORICO] = 'shared/ord_forn_storico';
  if(AK.SETTINGS_FORNITORI) map[AK.SETTINGS_FORNITORI] = 'settings/fornitori';
  return map[k] || null;
}

if(typeof lsSet === 'function' && !window.__LSSET_FB_SHARED_PATCHED__){
  window.__LSSET_FB_SHARED_PATCHED__ = true;
  var _origLsSet = lsSet;
  lsSet = function(k, v){
    _origLsSet(k, v);
    var path = _fbSharedPathForKey(k);
    if(!path) return;
    if(_fbSharedSyncing[path]) return;
    if(!_fbReady || !_fbDb) return;
    try{
      _fbDb.ref(path).set(v == null ? null : v);
    }catch(e){
      console.error('FB shared sync save errore:', path, e);
    }
  };
}

function saveCarrelli(){
  _takeSnapshot();
  lsSet(CARTK, carrelli);
  updateCartBadge();
  if(_fbReady && _fbDb && !_fbSyncingCart){
    try{
      _fbDb.ref('carrelli').set(carrelli.length ? carrelli : null);
      console.log('[CART] saveCarrelli — Firebase aggiornato, totale condiviso:', carrelli.length);
    }catch(e){ console.error('[CART] saveCarrelli Firebase FALLITO:', e); }
  }
  if(typeof renderOrdini==='function'){
    if(typeof cartNoteFieldHasFocus!=='function' || !cartNoteFieldHasFocus()) renderOrdini();
  }
  if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
    window.dispatchEvent(new CustomEvent('sync-orders',{detail:{source:'saveCarrelli'}}));
  }
}
function saveOrdini(opts){
  opts = opts || {};
  _takeSnapshot();
  lsSet(ORDK, ordini);
  updateOrdBadge();
  var snapshot = (ordini || []).slice();
  _ordPushToFirebase(snapshot, opts);
  if(typeof renderOrdini === 'function') renderOrdini();
  if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
    window.dispatchEvent(new CustomEvent('sync-orders', { detail: { source: 'saveOrdini' } }));
  }
}

// ══ SALVATAGGIO SINGOLO ARTICOLO SU FIREBASE ═════════════════════
// Salva l'articolo modificato CON i dati magazzino (qty, prezzoAcquisto, ecc.)
var _MAG_FIELDS = ['qty','soglia','prezzoAcquisto','marca','specs',
                   'posizione','cat','subcat','nomeFornitore','descrizione','note_tecniche',
                   'correlati','scaglioni','tot_u','peso_u','mt_rot'];

function _fbSaveArticolo(idx){
  if(!_fbReady || !_fbDb || !rows[idx]) return;
  try{
    if(typeof sanitizeCodiceMagazzinoInput === 'function'){
      rows[idx].codM = sanitizeCodiceMagazzinoInput(rows[idx].codM);
    }else{
      rows[idx].codM = String(rows[idx].codM == null ? '' : rows[idx].codM).trim();
    }
    if(rows[idx].codM && typeof findDuplicateCodMagazzino === 'function'){
      var dup = findDuplicateCodMagazzino(rows[idx].codM, idx);
      if(dup){
        if(typeof showCodiceMagazzinoDuplicateError === 'function') showCodiceMagazzinoDuplicateError(rows[idx].codM, dup.desc);
        return false;
      }
    }
    var obj = JSON.parse(JSON.stringify(rows[idx]));
    var m = magazzino[idx];
    if(m){
      _MAG_FIELDS.forEach(function(f){
        if(m[f] !== undefined && m[f] !== '') obj['_m_' + f] = m[f];
      });
    }
    _fbDb.ref(MAGEXT_K + '/' + idx).set(obj);
    return true;
  }catch(e){ console.error('Firebase save articolo:', e); }
  return false;
}

// Traccia ultimo articolo modificato per sync automatico
var _lastModifiedIdx = null;

// Wrappa save() (database.cartellini.js) per sincronizzare su Firebase
// Viene eseguito dopo il caricamento dei moduli database.*.js
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    if(typeof save === 'function'){
      var _origSave = save;
      save = function(){
        _origSave();
        // Se c'è un articolo appena modificato, salvalo su Firebase
        if(_lastModifiedIdx !== null){
          _fbSaveArticolo(_lastModifiedIdx);
          _lastModifiedIdx = null;
        }
      };
    }
    // Wrappa quickEditPrice per tracciare l'indice modificato
    if(typeof quickEditPrice === 'function'){
      var _origQEP = quickEditPrice;
      quickEditPrice = function(idx){
        _lastModifiedIdx = idx;
        _origQEP(idx);
      };
    }
  }, 100);
});
