// =============================================================================
//  TAB ORDINI PER COLORE/FORNITORE — #t-ordfor
// =============================================================================

// Salva/carica nomi fornitori per colore in localStorage
function ctGetForniColore(){
  try{ return JSON.parse(localStorage.getItem(CT_FORN_KEY)||'{}'); }catch(e){ return {}; }
}
function ctSaveForniColore(map){
  localStorage.setItem(CT_FORN_KEY, JSON.stringify(map));
  // Sincronizza su Firebase se disponibile
  try{ _fbPush('forniColore', map); }catch(e){}
}

// renderOrdFor: renderizza la tab Ordini Fornitore raggruppati per colore
var _ordForColorFilter=null;
function ordForFilterColor(col){
  _ordForColorFilter=(_ordForColorFilter===col)?null:col;
  renderOrdFor();
}

function renderOrdFor(){
  var wrap = document.getElementById('t-ordfor-body');
  if(!wrap) return;

  // Raccoglie tutti gli articoli "daOrdinare" da tutti i carrelli
  var byColor = {};
  carrelli.forEach(function(cart){
    (cart.items||[]).forEach(function(it){
      // Mostra SOLO articoli con colore reale assegnato (non '#888888' = senza colore)
      if(!it.daOrdinare) return;
      if(!it._ordColore || it._ordColore === '#888888') return;
      var col = it._ordColore;
      if(!byColor[col]) byColor[col] = [];
      byColor[col].push({ it: it, cartNome: cart.nome||'' });
    });
  });

  var forniMap = ctGetForniColore();
  var colorNames = {
    '#e53e3e':'Rosso', '#38a169':'Verde', '#3182ce':'Blu',
    '#e2c400':'Giallo', '#888888':'Senza colore'
  };

  if(!Object.keys(byColor).length){
    wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#555">' +
      'Nessun articolo da ordinare.<br><small>Usa il tasto ORDINA nelle card del carrello.</small></div>';
    return;
  }

  var h = '';

  // Barra filtri colore
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">';
  Object.keys(byColor).forEach(function(col){
    var nome=forniMap[col]||colorNames[col]||col;
    var isOn=(_ordForColorFilter===col);
    h+='<button onclick="ordForFilterColor(\''+col+'\')" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:14px;border:2px solid '+(isOn?col:'#333')+';background:'+(isOn?col+'22':'transparent')+';color:'+(isOn?col:'#888')+';font-size:11px;font-weight:800;cursor:pointer;">';
    h+='<span style="width:10px;height:10px;border-radius:50%;background:'+col+';display:inline-block;"></span>';
    h+=esc(nome)+' ('+byColor[col].length+')';
    h+='</button>';
  });
  h+='</div>';

  // Filtra per colore se attivo
  var coloriDaMostrare=Object.keys(byColor);
  if(_ordForColorFilter && byColor[_ordForColorFilter]){
    coloriDaMostrare=[_ordForColorFilter];
  }

  coloriDaMostrare.forEach(function(col){
    var items     = byColor[col];
    var colLabel  = colorNames[col] || col;
    var fornNome  = forniMap[col] || '';

    h += '<div class="cof-group" style="border-color:' + col + '55">';
    // Intestazione gruppo: pallino colore + nome fornitore MODIFICABILE
    h += '<div class="cof-header" style="border-color:' + col + '">';
    h += '<span class="cof-dot" style="background:' + col + '"></span>';
    h += '<span class="cof-color-label">' + colLabel + '</span>';
    // Campo nome fornitore — input cliccabile, si salva onblur/enter
    h += '<input class="cof-forn-inp" ' +
         'value="' + esc(fornNome) + '" ' +
         'placeholder="Nome fornitore..." ' +
         'title="Clicca per modificare il nome del fornitore" ' +
         'oninput="ctSaveFornNome(\'' + col + '\',this.value)" ' +
         'onkeydown="if(event.key===\'Enter\')this.blur()">';
    h += '<span class="cof-count">' + items.length + ' art.</span>';
    h += '</div>'; // fine cof-header

    // Lista articoli del gruppo
    items.forEach(function(entry){
      var it   = entry.it;
      var codM = it.codM ? (String(it.codM).match(/^\d+$/) ? String(it.codM).padStart(7,'0') : it.codM) : '';
      var sub  = (parsePriceIT(it.prezzoUnit)*(parseFloat(it.qty)||0)).toFixed(2);
      h += '<div class="cof-row">';
      if(it.foto) h += '<img class="cof-thumb" src="' + it.foto + '" alt="" onclick="apriModalFoto(this.src)">';
      else        h += '<div class="cof-thumb cof-thumb--empty">📦</div>';
      h += '<div class="cof-info">';
      h += '<div class="cof-nome">' + esc(it.desc||'—') + '</div>';
      h += '<div class="cof-meta">';
      if(codM)    h += '<span>Cod.Mag: <b>' + esc(codM) + '</b></span> ';
      if(it.codF) h += '<span>Cod.Forn: <b>' + esc(it.codF) + '</b></span> ';
      h += '<span>Cart: <b>' + esc(entry.cartNome) + '</b></span>';
      h += '</div>';
      if(it.nota) h += '<div class="cof-nota">📝 ' + esc(it.nota) + '</div>';
      h += '</div>';
      h += '<div class="cof-right">';
      h += '<div class="cof-qty">' + (parseFloat(it.qty)||0) + ' ' + (it.unit||'pz') + '</div>';
      h += '<div class="cof-sub">€' + sub + '</div>';
      h += '</div>';
      h += '</div>'; // fine cof-row
    });

    h += '</div>'; // fine cof-group
  });

  wrap.innerHTML = h;
}

// ctSaveFornNome: salva il nome fornitore per un colore (con debounce)
var _ctFornTimer = null;
function ctSaveFornNome(colore, nome){
  clearTimeout(_ctFornTimer);
  _ctFornTimer = setTimeout(function(){
    var map = ctGetForniColore();
    if(nome && nome.trim()) map[colore] = nome.trim();
    else delete map[colore];
    ctSaveForniColore(map);
  }, 400); // salva dopo 400ms di pausa dalla digitazione
}



// ctToggleNome: click sul nome prodotto espande/collassa la card
// La classe ct-card--expanded nel CSS imposta white-space:normal sul nome
function ctToggleNome(cartId, idx){
  var card = document.getElementById('cart-row-' + idx);
  if(card) card.classList.toggle('ct-card--expanded');
}

// ctCalcolaLive — aggiorna i prezzi nel DOM in tempo reale SENZA salvare su Firebase.
// Viene chiamata da oninput sull'input %. onchange salva poi definitivamente.
// Parametri: inputEl = <input> %, idx = indice card, baseStr = prezzo originale, qty = quantità
function ctCalcolaLive(inputEl, idx, baseStr, qty){
  var perc   = parseFloat(inputEl.value) || 0;
  var base   = parsePriceIT(String(baseStr)) || 0;
  var finale = perc > 0 ? base * (1 - perc / 100) : base;
  var q      = parseFloat(qty) || 1;

  // Aggiorna preview nel pannello
  var ppEl = document.getElementById('pp-sc-' + idx);
  if(ppEl){
    ppEl.querySelector('.ct-pp-orig').textContent = 'Orig: €' + (base*q).toFixed(2);
    ppEl.querySelector('.ct-pp-fin').textContent  = 'Fin: €'  + (finale*q).toFixed(2);
  }
  // Aggiorna cella prezzo unitario (prz-IDX) — nella griglia è la colonna "Prezzo"
  var przEl = document.getElementById('prz-' + idx);
  if(przEl){
    var origEl = przEl.querySelector('.ct-old--orig');
    var finEl  = przEl.querySelector('.ct-sub--final');
    if(perc > 0 && base > finale + 0.005){
      if(origEl) origEl.textContent = '€' + base.toFixed(2);
      if(finEl)  finEl.textContent  = '€' + finale.toFixed(2);
      // Se non esistono ancora (era prezzo normale), riscrivi
      if(!origEl && !finEl){
        przEl.innerHTML = '<div class="ct-old--orig">€' + base.toFixed(2) + '</div>' +
          '<div class="ct-sub--final">€' + finale.toFixed(2) + '</div>' +
          przEl.querySelector('.ct-punit').outerHTML;
      }
    }
  }
  // Aggiorna cella totale — è il nextElementSibling di prz-IDX nella griglia
  if(przEl && przEl.nextElementSibling){
    var totCell = przEl.nextElementSibling;
    if(perc > 0 && base > finale + 0.005){
      totCell.innerHTML = '<div class="ct-old--orig">€' + (base*q).toFixed(2) + '</div>' +
        '<div class="ct-sub--final">€' + (finale*q).toFixed(2) + '</div>';
    } else {
      totCell.innerHTML = '<div style="font-size:14px;font-weight:900;color:var(--accent)">€' + (finale*q).toFixed(2) + '</div>';
    }
  }
}
