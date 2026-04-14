// ── Carica articoli Firebase on-demand (lazy + chunked per Chrome) ───────────
function loadMagazzinoFB(){
  if(_magExtLoaded || !_fbReady || !_fbDb) return;
  _magExtLoaded = true;
  // Mostra barra di caricamento
  _showLoadingBar('⏳ Caricamento database articoli...');
  _fbDb.ref(MAGEXT_K).once('value', function(snap){
    var d = snap.val();
    if(!d){ showToastGen('yellow','⚠ Nessun articolo su Firebase'); _magExtLoaded=false; _hideLoadingBar(); return; }
    var keys = Object.keys(d);
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
    _magExtLoaded = false;
    _hideLoadingBar();
    showToastGen('red','❌ Errore Firebase: '+(err?err.message:'sconosciuto'));
  });
}
