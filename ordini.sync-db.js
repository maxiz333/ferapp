// ordini.sync-db.js - estratto da ordini.js

// ── Sync ordine completato → database articoli ───────────────────────────────
// Aggiorna prezzo, qty (scarico), unit nel database per ogni articolo dell'ordine.
// Chiamata sia da setStatoOrdine che da _cassaModeFatto — comportamento identico.
function _syncPrezziOrdineAlDB(ord){
  if(!ord || !ord.items || !ord.items.length) return;
  var aggiornatiPrezzi = 0;
  var aggiornatiQty = 0;
  var aggiornateUm = 0;
  var sottoScortaList = [];
  var productTouched = false;
  var magTouched = false;

  ord.items.forEach(function(it){
    var prezzoOrd = it.prezzoUnit;
    var prezzoDaSalvare = prezzoOrd;
    if(it && typeof itemUsesPrezzoPerBaseUm === 'function' && itemUsesPrezzoPerBaseUm(it.unit)){
      var pb = parsePriceIT(it._prezzoUnitaBase);
      if(pb > 0){
        prezzoDaSalvare = itemFormatPrezzoLineStr(pb);
      }
    }
    var qVenduta = parseFloat(String(it.qty == null ? 0 : it.qty).replace(',', '.')) || 0;
    var dbIdx = _ordResolveDbIdx(it);
    if(dbIdx < 0 || !rows[dbIdx]) return;

    var r = rows[dbIdx];
    var m = magazzino[dbIdx] || {};
    var changed = false;

    // ── 1. Aggiorna prezzo ──────────────────────────────────────
    if(prezzoDaSalvare && prezzoDaSalvare !== '0' && prezzoDaSalvare !== '' && r.prezzo !== prezzoDaSalvare){
      if(r.prezzo){
        if(!r.priceHistory) r.priceHistory = [];
        if(r.prezzoOld && r.prezzoOld !== r.prezzo){
          var giaNello = r.priceHistory.some(function(p){ return p.prezzo === r.prezzoOld; });
          if(!giaNello) r.priceHistory.push({ prezzo: r.prezzoOld, data: '' });
        }
        r.prezzoOld = r.prezzo;
        r.priceHistory.unshift({ prezzo: r.prezzo, data: r.data || '' });
        if(r.priceHistory.length > 5) r.priceHistory.length = 5;
      }
      r.prezzo = prezzoDaSalvare;
      r.data = new Date().toLocaleDateString('it-IT');
      r.size = (typeof autoSize === 'function') ? autoSize(prezzoDaSalvare) : r.size;
      if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
      changed = true;
      productTouched = true;
      aggiornatiPrezzi++;
    }

    // ── 2. Aggiorna unità di misura ─────────────────────────────
    if(it.unit){
      var unitOrd = (typeof normalizeUmValue === 'function') ? normalizeUmValue(it.unit) : it.unit;
      var unitMag = (typeof normalizeUmValue === 'function') ? normalizeUmValue(m.unit || 'pz') : (m.unit || 'pz');
      if(unitOrd !== unitMag){
        m.unit = unitOrd;
        magazzino[dbIdx] = m; // persiste UM anche se non cambia la qty
        changed = true;
        magTouched = true;
        aggiornateUm++;
      }
    }

    // ── 3. Scarico magazzino (qty) ──────────────────────────────
    if(qVenduta > 0 && m.qty !== undefined && m.qty !== ''){
      var prevQty = Number(m.qty);
      var nuovaQty = Math.max(0, prevQty - qVenduta);
      m.qty = nuovaQty;
      magazzino[dbIdx] = m;
      lsSet(MAGK, magazzino);
      if(typeof updateStockBadge === 'function') updateStockBadge();
      if(typeof registraMovimento === 'function'){
        registraMovimento(dbIdx, 'ordine', -qVenduta, prevQty, nuovaQty, 'Ordine #' + (ord.numero || ord.id));
      }
      // Controlla scorta minima
      var soglia = (typeof getSoglia === 'function') ? getSoglia(dbIdx) : (m.soglia !== undefined ? Number(m.soglia) : 1);
      if(nuovaQty <= soglia){
        sottoScortaList.push({ desc: r.desc || it.desc || '?', qty: nuovaQty, soglia: soglia });
      }
      if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
      changed = true;
      productTouched = true;
      magTouched = true;
      aggiornatiQty++;
    }

    if(changed){
      if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
    }
  });

  if(productTouched){
    lsSet(SK, rows);
  }
  if(productTouched || magTouched){
    lsSet(MAGK, magazzino);
  }

  // Toast riepilogo
  var parts = [];
  if(aggiornatiPrezzi) parts.push(aggiornatiPrezzi + ' prezz' + (aggiornatiPrezzi === 1 ? 'o' : 'i'));
  if(aggiornatiQty) parts.push(aggiornatiQty + ' qt' + (aggiornatiQty === 1 ? 'à' : 'à'));
  if(aggiornateUm) parts.push(aggiornateUm + ' UM');
  if(parts.length){
    showToastGen('green', '💰 Aggiornati: ' + parts.join(' · '));
  }

  // Avvisi scorta bassa (ritardati per non sovrapporsi al toast completato)
  if(sottoScortaList.length){
    setTimeout(function(){
      var msg = '⚠️ SOTTO SCORTA:\n' + sottoScortaList.map(function(s){
        return s.desc + ' — rimasti ' + s.qty + ' (min: ' + s.soglia + ')';
      }).join('\n');
      showToastGen('red', msg.trim());
    }, 1800);
  }
}

/** Ritorna indice articolo database da riga ordine (rowIdx/codM). */
function _ordResolveDbIdx(it){
  if(!it) return -1;
  if(it.rowIdx !== undefined && it.rowIdx !== null && rows[it.rowIdx]){
    var byIdx = parseInt(it.rowIdx, 10);
    return isNaN(byIdx) ? it.rowIdx : byIdx;
  }
  if(it.codM){
    for(var ri = 0; ri < rows.length; ri++){
      if(!rows[ri]) continue;
      if(typeof codiciMagazzinoUguali === 'function'){
        if(codiciMagazzinoUguali(rows[ri].codM, it.codM)) return ri;
      } else if(String(rows[ri].codM || '').trim() === String(it.codM || '').trim()){
        return ri;
      }
    }
  }
  if(it.codF){
    var codF = String(it.codF || '').trim();
    if(codF){
      for(var rf = 0; rf < rows.length; rf++){
        if(rows[rf] && String(rows[rf].codF || '').trim() === codF) return rf;
      }
    }
  }
  if(it.desc){
    var d = String(it.desc || '').trim().toLowerCase();
    if(d){
      for(var rd = 0; rd < rows.length; rd++){
        if(rows[rd] && String(rows[rd].desc || '').trim().toLowerCase() === d) return rd;
      }
    }
  }
  return -1;
}

/** Riporta a magazzino le quantità vendute quando un ordine torna Nuovo/Annullato. */
function _revertSyncPrezziOrdineAlDB(ord){
  if(!ord || !ord.items || !ord.items.length) return;
  var reintegrati = 0;
  var touched = false;

  ord.items.forEach(function(it){
    var qVenduta = parseFloat(String(it.qty == null ? 0 : it.qty).replace(',', '.')) || 0;
    if(!(qVenduta > 0)) return;

    var dbIdx = _ordResolveDbIdx(it);
    if(dbIdx < 0 || !rows[dbIdx]) return;

    var r = rows[dbIdx];
    var m = magazzino[dbIdx] || {};
    if(m.qty === undefined || m.qty === '') return;

    var prevQty = Number(m.qty);
    if(!isFinite(prevQty)) return;
    var nuovaQty = prevQty + qVenduta;
    m.qty = nuovaQty;
    magazzino[dbIdx] = m;
    if(typeof registraMovimento === 'function'){
      registraMovimento(dbIdx, 'annullo-fatto', qVenduta, prevQty, nuovaQty, 'Ordine #' + (ord.numero || ord.id));
    }
    if(typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(r);
    if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
    reintegrati++;
    touched = true;
  });

  if(touched){
    lsSet(SK, rows);
    lsSet(MAGK, magazzino);
    if(typeof updateStockBadge === 'function') updateStockBadge();
  }
  if(reintegrati){
    showToastGen('green', '↩️ Magazzino reintegrato su ' + reintegrati + ' articol' + (reintegrati === 1 ? 'o' : 'i'));
  }
}
