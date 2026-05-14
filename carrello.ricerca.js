// --- RICERCA CARRELLO (Fase 3: matchNormQueryToText + fallback + tier ranking) --
// Debug UM: nella console imposta window.__DEBUG_CART_SEARCH_UM__ = true poi cerca:
// logga per ogni riga mostrata idx, codM, r.unit e valore dopo rowListinoUnit (solo r.unit).
var _cartSearchTimer = null;
function renderCartSearch(){
  // Debounce: evita calcoli su ogni keystroke su cataloghi grandi
  if(_cartSearchTimer) clearTimeout(_cartSearchTimer);
  _cartSearchTimer = setTimeout(_doCartSearch, 120);
}

/** Haystack coerente con ricerca globale (desc, codici, marca, specs, pos, fornitore). */
function _cartSearchHayRaw(r, m){
  var codF = String(r.codF || '');
  var codM = String(r.codM || '');
  return [
    r.desc || '',
    codF,
    codM,
    m.marca || '',
    m.specs || '',
    m.posizione || '',
    m.nomeFornitore || ''
  ].join(' ');
}

/** Legacy: ogni parola query come sottostringa nel testo lower (se no AppUtils Fase 3). */
function _cartSearchLegacySubset(qWords, textLower){
  for(var w = 0; w < qWords.length; w++){
    if(textLower.indexOf(qWords[w]) < 0) return false;
  }
  return true;
}

/** Risultati carrello: mostrati a blocchi nel DOM (stesso schema ricerca globale). */
var _cartSearchMoreState = { q: '', matches: [], shown: 0 };
var CART_SEARCH_INITIAL = 15;
var CART_SEARCH_PAGE = 20;

function cartSearchResultRowHtml(x){
  var r = x.r, i = x.i, m = x.m;
  var qty = m.qty !== undefined && m.qty !== '' ? m.qty : '';
  if(typeof window !== 'undefined' && window.__DEBUG_CART_SEARCH_UM__){
    console.log('[cart-search-um]', 'idx='+i, 'codM='+(r&&r.codM), 'r.unit=', r.unit, '→', rowListinoUnit(r));
  }
  var qtyNum = qty === '' ? null : Number(qty);
  var outOfStock = qtyNum !== null && qtyNum <= 0;
  var promoG = !!(r && r.isPromo === true && String(r.promoTipo || '') === 'G');
  var h = '';
  h += '<div style="padding:10px 12px;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;align-items:center;gap:10px;">';
  h += '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(r.desc)+'</div>';
  h += '<div style="font-size:10px;margin-top:2px;">';
  if(r.codF) h += '<span style="color:#fc8181;font-weight:600;">'+esc(r.codF)+'</span> ';
  if(r.codM) h += '<span style="color:var(--accent);font-weight:600;">'+esc(r.codM)+'</span>';
  if(m.marca) h += ' <span style="color:var(--muted);">- '+esc(m.marca)+'</span>';
  h += '</div>';
  if(qty !== '') h += '<div style="font-size:10px;'+(outOfStock?'color:#e53e3e;font-weight:700;':'color:#555;')+'margin-top:1px;">'+(outOfStock?'⚠ ':'')+'Stock: '+qty+' '+esc(rowListinoUnit(r))+'</div>';
  if(m.posizione) h += '<div style="font-size:10px;color:#63b3ed;margin-top:1px;">- '+esc(m.posizione)+'</div>';
  h += '</div>';
  h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">';
  h += '<div style="font-size:15px;font-weight:900;color:var(--accent);display:flex;align-items:center;gap:6px;">- '+esc(r.prezzo)+(promoG&&typeof htmlPromoGBadge==='function'?htmlPromoGBadge():'')+'</div>';
  h += '<button onclick="cartAddItem('+i+')" style="padding:6px 16px;border-radius:8px;border:none;background:#38a169;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">+ Aggiungi</button>';
  h += '</div></div>';
  return h;
}

function cartSearchLoadMore(){
  var inp = document.getElementById('cart-search');
  var qNow = (inp && inp.value || '').trim();
  var st = _cartSearchMoreState;
  if(!st.matches.length || qNow !== st.q) return;
  var listEl = document.getElementById('cart-search-rows');
  var moreEl = document.getElementById('cart-search-more');
  if(!listEl || !moreEl) return;
  var total = st.matches.length;
  var start = st.shown;
  if(start >= total) return;
  var end = Math.min(start + CART_SEARCH_PAGE, total);
  for(var ci = start; ci < end; ci++){
    listEl.insertAdjacentHTML('beforeend', cartSearchResultRowHtml(st.matches[ci]));
  }
  st.shown = end;
  var rem = total - end;
  if(rem <= 0){
    moreEl.parentNode.removeChild(moreEl);
  } else {
    moreEl.textContent = '... e altri ' + rem + ' articoli';
  }
}

function _doCartSearch(){
  var q=(document.getElementById('cart-search')||{}).value||'';
  var res=document.getElementById('cart-search-results');if(!res)return;
  _cartSearchMoreState = { q: '', matches: [], shown: 0 };
  if(!q||q.trim().length<2){res.innerHTML='';return;}
  // Database non ancora caricato: avvisa l'utente
  if(!rows||!rows.length){
    res.innerHTML='<div style="padding:12px;color:var(--accent);font-size:13px;text-align:center;">⏳ Database in caricamento, attendi...</div>';
    return;
  }
  var qTrim = q.trim();
  var qNorm = (typeof norm === 'function') ? norm(qTrim) : qTrim.toLowerCase();
  var qWords = qTrim.toLowerCase().split(/\s+/).filter(function(w){ return w.length > 0; });

  function collect(mode){
    var bestByCode = {};
    rows.forEach(function(r,i){
      if(!r)return;
      if(removed.has(String(i)))return;
      var m=magazzino[i]||{};
      var hayRaw = _cartSearchHayRaw(r, m);
      var tNorm = (typeof norm === 'function') ? norm(hayRaw) : hayRaw.toLowerCase();
      var mr;
      if(typeof matchNormQueryToText === 'function'){
        mr = matchNormQueryToText(qNorm, tNorm, mode);
      } else {
        mr = { ok: _cartSearchLegacySubset(qWords, hayRaw.toLowerCase()), tier: 'exact' };
      }
      if(!mr.ok) return;
      var score = (typeof fuzzyScore === 'function') ? fuzzyScore(qTrim, hayRaw) : 100;
      if(score < 50) return;
      var mult = (typeof searchTierRankMultiplier === 'function') ? searchTierRankMultiplier(mr.tier || 'exact') : 1;
      var rankScore = score * mult;
      var key = '';
      if(typeof normalizeCodiceMagazzino === 'function') key = normalizeCodiceMagazzino(r.codM);
      if(!key) key = 'idx:' + i;
      var cand = {r:r, i:i, m:m, score: rankScore, _updatedAt:getRowUpdatedAt(r,i)};
      var prev = bestByCode[key];
      if(!prev || cand._updatedAt > prev._updatedAt || (cand._updatedAt === prev._updatedAt && cand.score > prev.score)){
        bestByCode[key] = cand;
      }
    });
    return Object.keys(bestByCode).map(function(k){ return bestByCode[k]; });
  }

  var matches = collect('primary');
  if(!matches.length) matches = collect('fallback');
  // Ordina per score decrescente (migliori in cima)
  matches.sort(function(a,b){return b.score-a.score;});
  if(!matches.length){res.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px;">Nessun risultato per "'+esc(q)+'"</div>';return;}
  var firstN = Math.min(CART_SEARCH_INITIAL, matches.length);
  _cartSearchMoreState = { q: qTrim, matches: matches, shown: firstN };
  var h='<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:300px;overflow-y:auto;">';
  h += '<div id="cart-search-rows">';
  for(var ri = 0; ri < firstN; ri++){
    h += cartSearchResultRowHtml(matches[ri]);
  }
  h += '</div>';
  var rem = matches.length - firstN;
  if(rem > 0){
    h += '<div id="cart-search-more" role="button" tabindex="0" onclick="cartSearchLoadMore()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();cartSearchLoadMore();}" style="cursor:pointer;font-size:11px;color:var(--accent);text-align:center;padding:10px 8px;border-top:1px solid #2a2a2a;background:#252525;">... e altri ' + rem + ' articoli</div>';
  }
  h+='</div>';
  res.innerHTML=h;
}

// --- STORICO CLIENTE ---------------------------------------
function getStoricoCliente(nomeCliente){
  if(!nomeCliente)return[];
  var nome=nomeCliente.toLowerCase().trim();
  return ordini.filter(function(o){
    return(o.nomeCliente||'').toLowerCase().trim()===nome;
  }).slice(0,5);
}
