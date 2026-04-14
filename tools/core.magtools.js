// ══ ESTRAI CAMPI MAGAZZINO DA FIREBASE (background) ══════════════════════════
// Dopo loadMagazzinoFB, se su Firebase ci sono campi _m_* li sposta in magazzino[]
function _extractMagFromRows(){
  if(!rows || !rows.length) return;
  var changed = false;
  for(var i = 0; i < rows.length; i++){
    var r = rows[i];
    if(!r) continue;
    for(var j = 0; j < _MAG_FIELDS.length; j++){
      var fbKey = '_m_' + _MAG_FIELDS[j];
      if(r[fbKey] !== undefined){
        if(!magazzino[i]) magazzino[i] = {};
        magazzino[i][_MAG_FIELDS[j]] = r[fbKey];
        delete r[fbKey];
        changed = true;
      }
    }
  }
  if(changed) lsSet(MAGK, magazzino);
}

// ══ ESPORTA DATABASE CSV ══════════════════════════════════════════════════════
function esportaDatabaseCSV(){
  if(!rows || !rows.length){ showToastGen('red','❌ Database vuoto'); return; }
  var sep = ';';
  var headers = ['Descrizione','CodMagazzino','CodFornitore','Prezzo','PrezzoOld1','PrezzoOld2','PrezzoOld3','PrezzoAcquisto','Quantita','Unita','Marca','Fornitore'];
  var csvLines = [headers.join(sep)];
  rows.forEach(function(r, i){
    if(!r) return;
    var m = magazzino[i] || {};
    var ph = r.priceHistory || [];
    var old1, old2, old3;
    if(r.prezzoOld){
      old1 = r.prezzoOld;
      old2 = ph[0] ? ph[0].prezzo : '';
      old3 = ph[1] ? ph[1].prezzo : '';
    } else {
      old1 = ph[0] ? ph[0].prezzo : '';
      old2 = ph[1] ? ph[1].prezzo : '';
      old3 = ph[2] ? ph[2].prezzo : '';
    }
    var cols = [
      (r.desc || '').replace(/;/g, ','),
      r.codM || '', r.codF || '', r.prezzo || '',
      old1 || '', old2 || '', old3 || '',
      m.prezzoAcquisto || '',
      m.qty !== undefined && m.qty !== '' ? String(m.qty) : '',
      m.unit || 'pz', m.marca || '', m.nomeFornitore || ''
    ];
    csvLines.push(cols.join(sep));
  });
  var blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rattazzi_database_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToastGen('green', '✅ ' + rows.length + ' articoli esportati!');
}

// ══ SYNC BATCH: salva TUTTO su Firebase con dati magazzino ═══════════════════
function fbSyncTuttoMagazzino(){
  if(!_fbReady || !_fbDb || !rows.length){
    showToastGen('red','❌ Firebase non pronto o database vuoto'); return;
  }
  var updates = {};
  rows.forEach(function(r, idx){
    if(!r) return;
    var obj = JSON.parse(JSON.stringify(r));
    var m = magazzino[idx];
    if(m){
      _MAG_FIELDS.forEach(function(f){
        if(m[f] !== undefined && m[f] !== '') obj['_m_' + f] = m[f];
      });
    }
    updates[MAGEXT_K + '/' + idx] = obj;
  });
  showToastGen('blue', '⏳ Sincronizzazione in corso...');
  _fbDb.ref().update(updates, function(err){
    if(err) showToastGen('red', '❌ Errore: ' + err.message);
    else showToastGen('green', '✅ ' + rows.length + ' articoli sincronizzati!');
  });
}
