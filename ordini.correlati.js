// ordini.correlati.js - estratto da ordini.js

// --- PRODOTTI CORRELATI PER ORDINE ----------------------------
function openCorrelatiOrdine(gi){
  var ord=ordini[gi];
  if(!ord||!ord.items||!(ord.items||[]).length){showToastGen('red','Nessun articolo');return;}
  document.getElementById('correlati-subtitle').textContent='Suggerimenti basati sugli articoli di '+esc(ord.nomeCliente||'-');
  var suggestions=[];
  var alreadyInOrder={};
  (ord.items||[]).forEach(function(it){if(it.rowIdx!==undefined)alreadyInOrder[it.rowIdx]=true;});

  // Per ogni articolo dell'ordine, cerca articoli simili per categoria, marca, descrizione
  (ord.items||[]).forEach(function(it){
    if(it.rowIdx===undefined)return;
    var m=magazzino[it.rowIdx]||{};
    var r=rows[it.rowIdx]||{};
    // 1. Correlati espliciti (se magazzino ha correlati)
    if(m.correlati&&m.correlati.length){
      m.correlati.forEach(function(ri){
        if(!alreadyInOrder[ri]&&rows[ri]&&!suggestions.find(function(s){return s.i===ri;})){
          suggestions.push({i:ri,r:rows[ri],m:magazzino[ri]||{},reason:'correlato a '+esc(r.desc||'').substring(0,25)});
        }
      });
    }
    // 2. Stessa categoria
    if(m.cat){
      rows.forEach(function(r2,i2){
        if(alreadyInOrder[i2]||removed.has(String(i2)))return;
        var m2=magazzino[i2]||{};
        if(m2.cat===m.cat&&!suggestions.find(function(s){return s.i===i2;})&&i2!==it.rowIdx){
          suggestions.push({i:i2,r:r2,m:m2,reason:'stessa categoria'});
        }
      });
    }
    // 3. Stessa marca
    if(m.marca){
      rows.forEach(function(r2,i2){
        if(alreadyInOrder[i2]||removed.has(String(i2)))return;
        var m2=magazzino[i2]||{};
        if(m2.marca&&m2.marca.toLowerCase()===m.marca.toLowerCase()&&!suggestions.find(function(s){return s.i===i2;})&&i2!==it.rowIdx){
          suggestions.push({i:i2,r:r2,m:m2,reason:'stesso brand '+esc(m.marca)});
        }
      });
    }
  });

  var listEl=document.getElementById('correlati-list');
  if(!suggestions.length){
    listEl.innerHTML='<div style="text-align:center;padding:20px;color:#555;">Nessun suggerimento disponibile.<br><span style="font-size:11px;">Imposta categorie e correlati nell\'inventario per avere suggerimenti.</span></div>';
  } else {
    var h='';
    suggestions.slice(0,15).forEach(function(s){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:6px;background:#111;">';
      h+='<div style="flex:1;min-width:0;">';
      h+='<div style="font-size:12px;font-weight:700;color:var(--text);">'+esc(s.r.desc||'')+'</div>';
      h+='<div style="font-size:10px;margin-top:2px;">';
      if(s.r.codM)h+='<span style="color:var(--accent);font-weight:600;">'+esc(s.r.codM)+'</span> ';
      if(s.r.codF)h+='<span style="color:#fc8181;">'+esc(s.r.codF)+'</span>';
      h+='</div>';
      h+='<div style="font-size:9px;color:#2dd4bf;margin-top:2px;">'+esc(s.reason)+'</div>';
      h+='</div>';
      h+='<div style="flex-shrink:0;text-align:right;">';
      h+='<div style="font-size:14px;font-weight:900;color:var(--accent);">- '+esc(s.r.prezzo||'')+'</div>';
      h+='<button onclick="addCorrelato('+s.i+');closeCorrelati()" style="margin-top:4px;padding:5px 12px;border-radius:6px;border:none;background:#38a169;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">+ Aggiungi</button>';
      h+='</div></div>';
    });
    listEl.innerHTML=h;
  }
  document.getElementById('correlati-overlay').style.display='flex';
}

function closeCorrelati(){
  document.getElementById('correlati-overlay').style.display='none';
}

function openCorrelatiCarrello(cartId, idx){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !cart.items || !cart.items[idx]){ showToastGen('orange','Riga carrello non trovata'); return; }
  var it = cart.items[idx] || {};
  var rowIdx = parseInt(it.rowIdx, 10);
  if(isNaN(rowIdx) || !rows[rowIdx]){ showToastGen('orange','Articolo non collegato al listino'); return; }

  var correlatiIdx = [];
  if(typeof cartGetExplicitCorrelati === 'function'){
    correlatiIdx = cartGetExplicitCorrelati(rowIdx);
  }else{
    var m = magazzino[rowIdx] || {};
    correlatiIdx = Array.isArray(m.correlati) ? m.correlati.slice() : [];
  }

  var subtitle = document.getElementById('correlati-subtitle');
  if(subtitle){
    subtitle.textContent = 'Correlati di ' + esc(rows[rowIdx].desc || '-') + ' (' + correlatiIdx.length + ')';
  }

  var listEl = document.getElementById('correlati-list');
  if(!listEl) return;
  if(!correlatiIdx.length){
    listEl.innerHTML = '<div style="text-align:center;padding:18px;color:#666;">Nessun correlato disponibile</div>';
    document.getElementById('correlati-overlay').style.display='flex';
    return;
  }

  var h = '';
  correlatiIdx.forEach(function(ri){
    var r = rows[ri];
    if(!r) return;
    var cod = r.codM || r.codF || '—';
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid #2a2a2a;border-radius:9px;margin-bottom:6px;background:#111;">';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(r.desc || '') + '</div>';
    h += '<div style="font-size:10px;color:#8a94a6;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(cod) + '</div>';
    h += '</div>';
    h += '<div style="flex-shrink:0;text-align:right;display:flex;align-items:center;gap:7px;">';
    h += '<div style="font-size:12px;font-weight:800;color:var(--accent);white-space:nowrap;">€ ' + esc(r.prezzo || '0') + '</div>';
    h += '<button onclick="addCorrelato(' + ri + ')" style="padding:6px 10px;min-width:32px;border-radius:7px;border:none;background:#38a169;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">+</button>';
    h += '</div></div>';
  });
  listEl.innerHTML = h;
  document.getElementById('correlati-overlay').style.display='flex';
}

function addCorrelato(rowIdx){
  // Aggiunge al carrello attivo se esiste, altrimenti noop
  if(activeCartId){
    cartAddItem(rowIdx);
  } else {
    showToastGen('orange','Apri un carrello per aggiungere');
  }
}
