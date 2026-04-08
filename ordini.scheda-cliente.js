// ordini.scheda-cliente.js - estratto da ordini.js

// ══ SCHEDA RAPIDA PRODOTTO — popup con foto, desc, posizione ════════════════
// Si apre cliccando sul nome articolo sia dalla tab ordini che inventario
function openSchedaRapida(rowIdx){
  if(!rows[rowIdx]) return;
  var r = rows[rowIdx];
  var m = magazzino[rowIdx] || {};
  
  // Crea overlay
  var ov = document.getElementById('scheda-rapida-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'scheda-rapida-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(ov);
  }
  
  var h = '<div style="background:#1a1a1a;border:1px solid var(--border);border-radius:14px;max-width:360px;width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.8);">';
  
  // Header con X
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #2a2a2a;">';
  h += '<span style="font-size:14px;font-weight:800;color:var(--accent);">Scheda Prodotto</span>';
  h += '<button onclick="closeSchedaRapida()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;">✕</button>';
  h += '</div>';
  
  // Foto
  h += '<div id="sr-foto" style="text-align:center;padding:12px;min-height:60px;">';
  h += '<div style="color:#555;font-size:11px;">Caricamento foto...</div>';
  h += '</div>';
  
  // Nome prodotto
  h += '<div style="padding:0 16px 8px;">';
  h += '<div style="font-size:18px;font-weight:900;color:var(--accent);line-height:1.3;">'+esc(r.desc||'—')+'</div>';
  h += '</div>';
  
  // Codici
  h += '<div style="padding:0 16px 10px;display:flex;gap:8px;flex-wrap:wrap;">';
  if(r.codM) h += '<span style="background:#2a2500;color:var(--accent);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">M: '+esc(r.codM)+'</span>';
  if(r.codF) h += '<span style="background:#2a1015;color:#fc8181;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">F: '+esc(r.codF)+'</span>';
  h += '</div>';
  
  // Prezzo
  if(r.prezzo){
    h += '<div style="padding:0 16px 10px;">';
    h += '<span style="font-size:22px;font-weight:900;color:var(--accent);">€ '+esc(r.prezzo)+'</span>';
    h += '</div>';
  }
  
  // Specs
  if(m.specs){
    h += '<div style="padding:0 16px 10px;font-size:12px;color:#aaa;line-height:1.4;">'+esc(m.specs)+'</div>';
  }
  
  // Posizione — piccola, discreta, editabile
  h += '<div style="padding:4px 16px 6px;display:flex;align-items:center;gap:6px;">';
  h += '<span style="font-size:9px;color:#555;">📍</span>';
  h += '<input type="text" id="sr-pos" value="'+esc(m.posizione||'')+'" placeholder="posizione..." ';
  h += 'style="flex:1;padding:3px 6px;border:none;border-bottom:1px dashed #333;background:transparent;color:#666;font-size:10px;box-sizing:border-box;outline:none;" ';
  h += 'onchange="salvaPosizioneRapida('+rowIdx+',this.value)">';
  h += '</div>';
  
  // Quantità in magazzino
  h += '<div style="padding:8px 16px 14px;display:flex;justify-content:space-between;align-items:center;">';
  h += '<span style="font-size:11px;color:#888;">Quantità in magazzino</span>';
  h += '<span style="font-size:15px;font-weight:800;color:'+(m.qty>0?'#68d391':'#fc8181')+';">'+(m.qty!==undefined&&m.qty!==''?m.qty:'—')+'</span>';
  h += '</div>';
  
  h += '</div>';
  
  ov.innerHTML = h;
  ov.style.display = 'flex';
  ov.onclick = function(e){ if(e.target === ov) closeSchedaRapida(); };
  
  // Carica foto da IndexedDB
  if(typeof idbGetFoto === 'function'){
    idbGetFoto(rowIdx).then(function(dataURL){
      var fotoEl = document.getElementById('sr-foto');
      if(!fotoEl) return;
      if(dataURL){
        fotoEl.innerHTML = '<img src="'+dataURL+'" style="max-width:100%;max-height:200px;border-radius:8px;object-fit:contain;">';
      } else {
        fotoEl.innerHTML = '<div style="color:#444;font-size:11px;padding:20px;">Nessuna foto</div>';
      }
    });
  }
}

function closeSchedaRapida(){
  var ov = document.getElementById('scheda-rapida-ov');
  if(ov) ov.style.display = 'none';
}

function salvaPosizioneRapida(rowIdx, val){
  if(!magazzino[rowIdx]) magazzino[rowIdx] = {};
  magazzino[rowIdx].posizione = val;
  lsSet(MAGK, magazzino);
  // Salva anche su Firebase
  _fbSaveArticolo(rowIdx);
  showToastGen('green','📍 Posizione salvata');
}

// Trova l'indice in rows[] da un item ordine (tramite codM o codF+desc)
function _findRowIdx(it){
  if(it.rowIdx !== undefined && it.rowIdx !== null && rows[it.rowIdx]) return it.rowIdx;
  // Cerca per codice magazzino
  if(it.codM){
    for(var i=0;i<rows.length;i++){
      if(rows[i] && rows[i].codM === it.codM) return i;
    }
  }
  // Cerca per codice fornitore + desc
  if(it.codF){
    for(var i=0;i<rows.length;i++){
      if(rows[i] && rows[i].codF === it.codF) return i;
    }
  }
  return -1;
}

function openSchedaFromOrdine(gi, ii){
  var ord = ordini[gi];
  if(!ord || !ord.items[ii]) return;
  var it = ord.items[ii];
  var idx = _findRowIdx(it);
  if(idx >= 0){
    openSchedaRapida(idx);
  } else {
    showToastGen('orange','Articolo non trovato nel database');
  }
}

// ── Modifica nome cliente ordine ─────────────────────────────────
function ordEditCliente(gi){
  var ord = ordini[gi];
  if(!ord) return;
  var nome = prompt('Nome cliente:', ord.nomeCliente || '');
  if(nome === null) return;
  ord.nomeCliente = nome.trim();
  ord.modificato = true;
  ord.modificatoAt = new Date().toLocaleString('it-IT');
  saveOrdini();
  // Aggiorna anche il carrello collegato
  var cart = carrelli.find(function(c){ return c.ordId === ord.id; });
  if(cart){ cart.nome = nome.trim(); saveCarrelli(); }
  renderOrdini();
  showToastGen('green', '✏️ Cliente aggiornato');
}


// ── Stampa / WhatsApp doppio tap ─────────────────────────────────
var _stampaDblTimer = null;
var _stampaDblGi = null;
