// database.idb.js - estratto da database.js

/**
 * -----------------------------------------------------------------------
 *  RATTAZZI - database.js
 *  - IndexedDB foto - Undo/Redo - Chiavi localStorage (SK, HK -)
 *  - lsGet / lsSet  - rows / magazzino / categorie / movimenti
 *  - UTILS: parsePriceIT, gf, esc, norm, fuzzy -
 *  - CARTELLINI: renderTable, makeTag, genTags, stampa -
 *  - IMPORT/CSV: parser, drop-zone -
 *  - MAGAZZINO: render, edit, filtri, scorte -
 * -----------------------------------------------------------------------
 */
// --- Error handling -------------------------------------------
window.addEventListener('unhandledrejection', function(e){ console.error('Promise:', e.reason); });
'use strict';

// -----------------------------------------------------------
//  INDEXEDDB PER FOTO ARTICOLI
//  Le foto non vanno in localStorage (limite ~5MB) ma in IndexedDB
//  che supporta decine di GB senza problemi
// -----------------------------------------------------------
var _idb = null;
var _idbCache = {}; // cache in memoria: rowIdx - dataURL

function _idbOpen(){
  return new Promise(function(resolve, reject){
    if(_idb){ resolve(_idb); return; }
    var req = indexedDB.open('cp4_foto', 1);
    req.onupgradeneeded = function(e){
      e.target.result.createObjectStore('foto');
    };
    req.onsuccess = function(e){
      _idb = e.target.result;
      resolve(_idb);
    };
    req.onerror = function(){ reject(req.error); };
  });
}

function idbSalvaFoto(rowIdx, dataURL){
  _idbCache[rowIdx] = dataURL;
  _idbOpen().then(function(db){
    var tx = db.transaction('foto','readwrite');
    tx.objectStore('foto').put(dataURL, String(rowIdx));
  });
}

function idbRimoviFoto(rowIdx){
  delete _idbCache[rowIdx];
  _idbOpen().then(function(db){
    var tx = db.transaction('foto','readwrite');
    tx.objectStore('foto').delete(String(rowIdx));
  });
}

function idbGetFoto(rowIdx){
  if(_idbCache[rowIdx] !== undefined) return Promise.resolve(_idbCache[rowIdx]||null);
  return _idbOpen().then(function(db){
    return new Promise(function(resolve){
      var tx = db.transaction('foto','readonly');
      var req = tx.objectStore('foto').get(String(rowIdx));
      req.onsuccess = function(){
        _idbCache[rowIdx] = req.result||null;
        resolve(_idbCache[rowIdx]);
      };
      req.onerror = function(){ resolve(null); };
    });
  });
}

// Precarica tutte le foto in cache all'avvio (per render veloce)
function idbPreloadAll(){
  return _idbOpen().then(function(db){
    return new Promise(function(resolve){
      var tx = db.transaction('foto','readonly');
      var req = tx.objectStore('foto').openCursor();
      req.onsuccess = function(e){
        var cursor = e.target.result;
        if(cursor){
          _idbCache[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = function(){ resolve(); };
    });
  }).catch(function(){ return Promise.resolve(); });
}

/** Dopo rows.splice(deleteIdx,1): riallinea foto IndexedDB agli indici riga. */
function idbShiftPhotosAfterRowDelete(deleteIdx, oldRowCount){
  if(oldRowCount <= 0 || deleteIdx < 0 || deleteIdx >= oldRowCount) return;
  var oldCache = {};
  Object.keys(_idbCache).forEach(function(k){
    oldCache[k] = _idbCache[k];
  });
  function pickVal(src){
    var v = oldCache[String(src)];
    return v !== undefined ? v : oldCache[src];
  }
  var newCount = oldRowCount - 1;
  _idbCache = {};
  for(var j = 0; j < newCount; j++){
    var src = j < deleteIdx ? j : j + 1;
    var blob = pickVal(src);
    if(blob !== undefined) _idbCache[j] = blob;
  }
  _idbOpen().then(function(db){
    var tx = db.transaction('foto','readwrite');
    var store = tx.objectStore('foto');
    for(var k = deleteIdx; k < oldRowCount; k++){
      store.delete(String(k));
    }
    Object.keys(_idbCache).forEach(function(key){
      store.put(_idbCache[key], String(key));
    });
  });
}
