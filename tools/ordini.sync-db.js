// ordini.sync-db.js - estratto da ordini.js

// ── Sync ordine completato → database articoli ───────────────────────────────
// Aggiorna prezzo e qty (scarico) nel database per ogni articolo dell'ordine.
// Chiamata sia da setStatoOrdine che da _cassaModeFatto — comportamento identico.
function _syncPrezziOrdineAlDB(ord){
  if(!ord || !ord.items || !ord.items.length) return;
  var aggiornatiPrezzi = 0;
  var aggiornatiQty = 0;
  var sottoScortaList = [];

  ord.items.forEach(function(it){
    var prezzoOrd = it.prezzoUnit;
    var qVenduta = parseFloat(it.qty || 0);

    var dbIdx = _ordResolveDbIdx(it);
    if(dbIdx < 0 || !rows[dbIdx]) return;

    var r = rows[dbIdx];
    var m = magazzino[dbIdx] || {};
    var changed = false;

    // ── 1. Aggiorna prezzo ──────────────────────────────────────
    if(prezzoOrd && prezzoOrd !== '0' && prezzoOrd !== '' && r.prezzo !== prezzoOrd){
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
      r.prezzo = prezzoOrd;
      r.data = new Date().toLocaleDateString('it-IT');
      r.size = (typeof autoSize === 'function') ? autoSize(prezzoOrd) : r.size;
      changed = true;
      aggiornatiPrezzi++;
    }

    // ── 2. Scarico magazzino (qty) ──────────────────────────────
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
      changed = true;
      aggiornatiQty++;
    }

    if(changed){
      if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
    }
  });

  if(aggiornatiPrezzi) lsSet(SK, rows);

  // Toast riepilogo
  var parts = [];
  if(aggiornatiPrezzi) parts.push(aggiornatiPrezzi + ' prezz' + (aggiornatiPrezzi === 1 ? 'o' : 'i'));
  if(aggiornatiQty) parts.push(aggiornatiQty + ' qt' + (aggiornatiQty === 1 ? 'à' : 'à'));
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

/** Priorità codM/codF; rowIdx solo se coerente (vedi _findRowIdx in ordini.scheda-cliente.js). */
function _ordResolveDbIdx(it){
  if(!it) return -1;
  if(typeof _findRowIdx === 'function'){
    var byItem = _findRowIdx(it);
    if(byItem >= 0) return byItem;
  }
  if(it.desc && rows && rows.length){
    var d = String(it.desc || '').trim().toLowerCase();
    if(d){
      for(var rd = 0; rd < rows.length; rd++){
        if(rows[rd] && String(rows[rd].desc || '').trim().toLowerCase() === d) return rd;
      }
    }
  }
  return -1;
}
