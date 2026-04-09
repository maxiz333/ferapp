// ══ PUSH FIREBASE + SALVA CARRELLI / ORDINI ═══════════════════════
function _fbPush(ref,data){if(!_fbReady||_fbSyncing)return;try{_fbDb.ref(ref).set(data);}catch(e){}}

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
  map[AK.ORDFORNITORI] = 'shared/ordini_fornitori';
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
}
function saveOrdini(){ _takeSnapshot(); lsSet(ORDK,ordini); updateOrdBadge(); _fbPush('ordini',ordini); }

// ══ SALVATAGGIO SINGOLO ARTICOLO SU FIREBASE ═════════════════════
// Salva l'articolo modificato CON i dati magazzino (qty, prezzoAcquisto, ecc.)
var _MAG_FIELDS = ['qty','unit','soglia','prezzoAcquisto','marca','specs',
                   'posizione','cat','subcat','nomeFornitore'];

function _fbSaveArticolo(idx){
  if(!_fbReady || !_fbDb || !rows[idx]) return;
  try{
    var obj = JSON.parse(JSON.stringify(rows[idx]));
    var m = magazzino[idx];
    if(m){
      _MAG_FIELDS.forEach(function(f){
        if(m[f] !== undefined && m[f] !== '') obj['_m_' + f] = m[f];
      });
    }
    _fbDb.ref(MAGEXT_K + '/' + idx).set(obj);
  }catch(e){ console.error('Firebase save articolo:', e); }
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
