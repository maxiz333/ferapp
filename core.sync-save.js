// ══ PUSH FIREBASE + SALVA CARRELLI / ORDINI ═══════════════════════
function _fbPush(ref,data){if(!_fbReady||_fbSyncing)return;try{_fbDb.ref(ref).set(data);}catch(e){}}

function saveCarrelli(){
  _takeSnapshot();
  lsSet(CARTK, carrelli);
  updateCartBadge();
  // Su Firebase vanno SOLO i carrelli attivi (non inviati e non eliminati)
  // I carrelli "inviato" restano solo in localStorage — su Firebase spariscono
  // Questo è lo stesso comportamento degli ordini: una volta processato, esce dalla coda condivisa
  var daCondividere = carrelli.filter(function(c){
    return c.stato !== 'inviato';
  });
  if(_fbReady && _fbDb && !_fbSyncingCart){
    try{
      _fbDb.ref('carrelli').set(daCondividere.length ? daCondividere : null);
      console.log('[CART] saveCarrelli — Firebase aggiornato, attivi:', daCondividere.length, 'totale locale:', carrelli.length);
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

// Wrappa save() di database.js per sincronizzare su Firebase
// Viene eseguito dopo che database.js è caricato
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
