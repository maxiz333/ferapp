// ── Carica articoli Firebase on-demand (lazy + chunked per Chrome) ───────────

// ── Watchdog & retry caricamento articoli ──
var _magFbWatchdog = null;   // timer watchdog attivo
var _magFbAttempt  = 0;      // tentativo corrente (0 = primo)
var _magFbGen      = 0;      // token anti "callback fantasma"
var MAG_FB_MAX_RETRY  = 3;   // max retry automatici dopo il primo tentativo
var MAG_FB_TIMEOUT_MS = [6000, 12000, 25000, 25000]; // timeout per tentativo

function _magFbClearWatchdog(){
  if(_magFbWatchdog){ clearTimeout(_magFbWatchdog); _magFbWatchdog = null; }
}

function loadMagazzinoFB(){
  if(_magExtLoaded || !_fbReady || !_fbDb) return;
  _magExtLoaded = true;
  var gen = ++_magFbGen;            // identifica QUESTO tentativo
  _magFbClearWatchdog();            // mai due watchdog insieme
  var lblTent = _magFbAttempt > 0
    ? ' (tentativo ' + (_magFbAttempt + 1) + '/' + (MAG_FB_MAX_RETRY + 1) + ')'
    : '';
  // Mostra barra di caricamento
  _showLoadingBar('⏳ Caricamento database articoli...' + lblTent);

  var tmo = MAG_FB_TIMEOUT_MS[Math.min(_magFbAttempt, MAG_FB_TIMEOUT_MS.length - 1)];
  _magFbWatchdog = setTimeout(function(){
    _magFbWatchdog = null;
    if(gen !== _magFbGen) return;   // nel frattempo è partito un altro caricamento: non interferire
    _magFbGen++;                    // invalida il callback del once() rimasto appeso
    _magExtLoaded = false;          // sblocca il flag
    if(_magFbAttempt < MAG_FB_MAX_RETRY){
      _magFbAttempt++;
      loadMagazzinoFB();            // retry automatico
    } else {
      _magFbAttempt = 0;            // consente il retry manuale (cambio tab / cassa)
      _hideLoadingBar();
      showToastGen('red', '📶 Wi-Fi assente o instabile — articoli non caricati. Apri la tab Database per riprovare.');
    }
  }, tmo);

  _fbDb.ref(MAGEXT_K).once('value', function(snap){
    if(gen !== _magFbGen) return;   // risposta "fantasma" di un tentativo già scaduto: ignora
    _magFbClearWatchdog();          // download riuscito: spegni il timer
    _magFbAttempt = 0;              // azzera il contatore per i caricamenti futuri
    var d = snap.val();
    if(!d){ showToastGen('yellow','⚠ Nessun articolo su Firebase'); _magExtLoaded=false; _hideLoadingBar(); return; }
    var keys = Object.keys(d);
    keys.sort(function(a, b){
      var na = parseInt(a, 10), nb = parseInt(b, 10);
      var aNum = String(na) === a && !isNaN(na);
      var bNum = String(nb) === b && !isNaN(nb);
      if(aNum && bNum) return na - nb;
      if(aNum && !bNum) return -1;
      if(!aNum && bNum) return 1;
      return String(a).localeCompare(String(b));
    });
    var total = keys.length;
    var arr = [];
    var pos = 0;
    var CHUNK = 500;
    function nextChunk(){
      var end = Math.min(pos + CHUNK, total);
      for(var i = pos; i < end; i++){
        var v = d[keys[i]];
        if(v != null) arr.push(v);
      }
      pos = end;
      if(pos < total){
        // Aggiorna barra ogni 1000 articoli
        if(pos % 1000 === 0 || pos === CHUNK){
          var pct = Math.round(pos/total*100);
          _updateLoadingBar(pct);
        }
        setTimeout(nextChunk, 0);
      } else {
        rows = arr;
        _tableShowAll = false;
        _filterIndices = null;
        // Invalida l'indice vecchio e ne costruisce uno nuovo in background
        _invIdxBuilt = false;
        setTimeout(_invBuildIndex, 0);
        _hideLoadingBar();
        showToastGen('green','✅ ' + rows.length + ' articoli pronti');
        renderTable();
        updateStats();
        updateStockBadge();
        // Estrai campi _m_* da Firebase → magazzino[] (in background, non blocca)
        setTimeout(_extractMagFromRows, 200);
      }
    }
    nextChunk();
  }, function(err){
    if(gen !== _magFbGen) return;
    _magFbClearWatchdog();
    _magFbAttempt = 0;
    _magExtLoaded = false;
    _hideLoadingBar();
    showToastGen('red','❌ Errore Firebase: '+(err?err.message:'sconosciuto'));
  });
}
