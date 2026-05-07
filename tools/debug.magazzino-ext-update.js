// ══ DEBUG: magazzino_unificato.json → Firebase magazzino_ext (CARICO PURO) ═══
// Uso: debug_pickMagazzinoUnificatoFile() oppure debug_updateMagazzinoExt(array)
//
// - Azzera PRIMA l'intero nodo magazzino_ext (set null).
// - Carica SOLO i campi presenti in ciascun oggetto del JSON (clone profondo).
// - Rimuove eventuali chiavi _m_* dal sorgente prima dell'upload (non si preserva nulla dal vecchio FB).
// - Un solo campo UM: `unit` (valore dal JSON, trim).
//
// Opzioni: debug_updateMagazzinoExt(arr, { skipWipe: true }) — non cancellare il nodo (solo per test).
(function(){
  var FB_MAG_PATH = 'magazzino_ext';
  var CHUNK_WRITE = 200;

  function _db(){
    return (typeof window._fbDb !== 'undefined' && window._fbDb) ? window._fbDb : (typeof _fbDb !== 'undefined' ? _fbDb : null);
  }

  function _cloneRow(obj){
    try{
      return JSON.parse(JSON.stringify(obj));
    }catch(e){
      return Object.assign({}, obj);
    }
  }

  /** Solo dati listino: niente _m_*, unit unico dal JSON. */
  function _pureRowFromJson(raw){
    if(!raw || typeof raw !== 'object') return {};
    var o = _cloneRow(raw);
    Object.keys(o).forEach(function(k){
      if(k.indexOf('_m_') === 0) delete o[k];
    });
    if(o.unit != null && o.unit !== '') o.unit = String(o.unit).trim();
    return o;
  }

  function _buildPayloadPure(arr){
    var out = {};
    for(var i = 0; i < arr.length; i++){
      out[String(i)] = _pureRowFromJson(arr[i]);
    }
    return out;
  }

  function _chunkKeys(obj, size){
    var keys = Object.keys(obj);
    var chunks = [];
    for(var i = 0; i < keys.length; i += size){
      chunks.push(keys.slice(i, i + size));
    }
    return chunks;
  }

  function _runChunkedUpdate(ref, payload, label){
    var parts = _chunkKeys(payload, CHUNK_WRITE);
    var chain = Promise.resolve();
    for(var pi = 0; pi < parts.length; pi++){
      (function(keyPart, idx){
        chain = chain.then(function(){
          var batch = {};
          for(var p = 0; p < keyPart.length; p++) batch[keyPart[p]] = payload[keyPart[p]];
          return new Promise(function(res, rej){
            ref.update(batch, function(err){
              if(err) rej(err);
              else res();
            });
          });
        }).then(function(){
          console.log('debug_updateMagazzinoExt:', label, 'chunk', idx + 1, '/', parts.length);
        });
      })(parts[pi], pi);
    }
    return chain;
  }

  /**
   * @param {Array} arr
   * @param {{ skipWipe?: boolean }} [options]
   */
  window.debug_updateMagazzinoExt = function(arr, options){
    options = options || {};
    var db = _db();
    if(!db){
      console.error('debug_updateMagazzinoExt: Firebase DB non disponibile');
      return Promise.reject(new Error('no db'));
    }
    if(!Array.isArray(arr) || !arr.length){
      console.error('debug_updateMagazzinoExt: serve un array non vuoto');
      return Promise.reject(new Error('bad array'));
    }

    var ref = db.ref(FB_MAG_PATH);
    var payload = _buildPayloadPure(arr);
    var n = Object.keys(payload).length;

    var wipePromise = options.skipWipe
      ? Promise.resolve()
      : new Promise(function(res, rej){
          console.log('debug_updateMagazzinoExt: azzeramento', FB_MAG_PATH, '…');
          ref.set(null, function(err){
            if(err) rej(err);
            else res();
          });
        });

    return wipePromise.then(function(){
      console.log('debug_updateMagazzinoExt: caricamento puro', n, 'articoli…');
      return _runChunkedUpdate(ref, payload, 'dati');
    }).then(function(){
      console.log('debug_updateMagazzinoExt: fine — ricarica la pagina per rileggere magazzino_ext.');
      if(typeof showToastGen === 'function') showToastGen('green', 'magazzino_ext sostituito (' + n + ' righe)');
    }).catch(function(err){
      console.error('debug_updateMagazzinoExt:', err);
      if(typeof showToastGen === 'function') showToastGen('red', 'Errore magazzino_ext');
      throw err;
    });
  };

  window.debug_pickMagazzinoUnificatoFile = function(){
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.onchange = function(){
      var f = inp.files && inp.files[0];
      if(!f){
        if(inp.parentNode) inp.parentNode.removeChild(inp);
        return;
      }
      var r = new FileReader();
      r.onload = function(){
        if(inp.parentNode) inp.parentNode.removeChild(inp);
        try{
          var data = JSON.parse(r.result);
          if(!Array.isArray(data)){
            console.error('Il JSON deve essere un array di articoli');
            return;
          }
          window.debug_updateMagazzinoExt(data).catch(function(){});
        }catch(e){
          console.error('JSON non valido', e);
        }
      };
      r.onerror = function(){
        if(inp.parentNode) inp.parentNode.removeChild(inp);
        console.error('Lettura file fallita');
      };
      r.readAsText(f, 'UTF-8');
    };
    document.body.appendChild(inp);
    inp.click();
  };
})();
