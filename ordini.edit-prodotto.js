// ordini.edit-prodotto.js - estratto da ordini.js

function openEditProdotto(i, isNew, cartEditContext){
  if(!rows[i]) return;
  _epIdx = i;
  _epIsNew = !!isNew;
  _epCartEditContext = cartEditContext || null;
  var r = rows[i];
  var m = magazzino[i] || {};

  // Snapshot per annulla
  _epSnapshot = { row: JSON.parse(JSON.stringify(r)), mag: JSON.parse(JSON.stringify(m)) };

  // Helper set field
  function sf(id,val){ var el=document.getElementById(id); if(el) el.value=val; }

  // Popola campi
  sf('ep-desc',   r.desc || '');
  sf('ep-codf',   r.codF || '');
  sf('ep-codm',   r.codM || '');
  sf('ep-prezzo', r.prezzo || '');
  sf('ep-prezzoold', r.prezzoOld || '');
  _epPromoG = !!(r.isPromo === true && String(r.promoTipo || '') === 'G');
  epRenderPromoGBtn();
  // Popola tendina storico prezzi
  var ph = r.priceHistory || [];
  var phWrap = document.getElementById('ep-price-history');
  function _epFmtHistDate(raw){
    if(!raw) return '';
    var d = new Date(raw);
    if(!isNaN(d.getTime())){
      return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'});
    }
    var s = String(raw).trim();
    if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return s;
    return '';
  }
  for(var pi = 0; pi < 4; pi++){
    var phEl = document.getElementById('ep-ph-' + (pi + 2));
    if(phEl){
      if(!ph[pi]){
        phEl.textContent = '—';
      } else {
        var isG = String(ph[pi].tipo || ph[pi].promoTipo || '') === 'G';
        var dFmt = _epFmtHistDate(ph[pi].data);
        var txt = '€ ' + (ph[pi].prezzo || '') + (dFmt ? ' — ' + dFmt : '');
        phEl.innerHTML = txt + (isG && typeof htmlPromoGBadge === 'function' ? ' ' + htmlPromoGBadge() : '');
      }
    }
  }
  if(phWrap) phWrap.style.display = 'none'; // chiusa di default
  sf('ep-acq',    m.prezzoAcquisto || '');
  sf('ep-specs',  m.specs || '');
  sf('ep-marca',  m.marca || '');
  sf('ep-pos',    m.posizione || '');
  sf('ep-qty',    m.qty !== undefined ? m.qty : '');
  sf('ep-soglia', (m.soglia !== undefined && m.soglia !== null && m.soglia !== '') ? m.soglia : 0);
  sf('ep-tot-u',  (m.tot_u !== undefined && m.tot_u !== null) ? m.tot_u : '');
  sf('ep-peso-u', (m.peso_u !== undefined && m.peso_u !== null) ? m.peso_u : '');
  sf('ep-fornitore', m.nomeFornitore || '');

  // Unit-
  var unitSel = document.getElementById('ep-unit');
  if(unitSel){
    if(typeof umOptionsHtml === 'function') unitSel.innerHTML = umOptionsHtml(rowListinoUnit(r));
    unitSel.value = rowListinoUnit(r);
    unitSel.onchange = function(){
      epRefreshPrezzoBaseUi();
      epSyncTotUVisibility();
    };
  }
  var prezzoInp = document.getElementById('ep-prezzo');
  if(prezzoInp){
    prezzoInp.oninput = function(){ epRefreshPrezzoBaseUi(); };
  }
  epRefreshPrezzoBaseUi();
  epSyncTotUVisibility();
  epTogglePesoU(String(m.peso_u == null ? '' : m.peso_u).trim() !== '');
  _epRefreshPrezzoDot();

  // Popola categorie
  var catSel = document.getElementById('ep-cat');
  catSel.innerHTML = '<option value="">- Nessuna -</option>';
  categorie.forEach(function(cat){
    var opt = document.createElement('option');
    opt.value = cat.id; opt.textContent = cat.nome;
    if(cat.id === m.cat) opt.selected = true;
    catSel.appendChild(opt);
  });
  epFillSubcat(m.subcat);
  if(typeof epResetCorrelatiUi === 'function'){
    epResetCorrelatiUi();
  }else{
    var corrSearchEl = document.getElementById('ep-correlati-search');
    if(corrSearchEl) corrSearchEl.value = '';
  }

  document.getElementById('ep').classList.add('open');
  setTimeout(function(){ document.getElementById('ep-desc').focus(); renderCorrelati(_epIdx); renderScaglioni(_epIdx); }, 100);
}

// Tendina storico prezzi nella scheda prodotto
function togglePriceHistory(){
  var el = document.getElementById('ep-price-history');
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function epFillSubcat(selectedSub){
  var catSel = document.getElementById('ep-cat');
  var subSel = document.getElementById('ep-subcat');
  var catId = catSel.value;
  var cat = categorie.find(function(c){ return c.id === catId; });
  subSel.innerHTML = '<option value="">-</option>';
  if(cat && cat.sub){
    cat.sub.forEach(function(s){
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      if(s === selectedSub || s === (magazzino[_epIdx]||{}).subcat) opt.selected = true;
      subSel.appendChild(opt);
    });
  }
}

function epDeltaQty(delta){
  var inp = document.getElementById('ep-qty');
  var cur = parseFloat(inp.value) || 0;
  inp.value = Math.max(0, cur + delta);
}

function epUnitShowsTotU(unitRaw){
  var unit = String(unitRaw == null ? '' : unitRaw).trim();
  if(typeof normalizeUmValue === 'function'){
    unit = normalizeUmValue(unit);
  }
  unit = String(unit || 'pz').trim().toLowerCase();
  return unit !== 'pz';
}

function epTogglePesoU(forceOpen){
  var pesoWrap = document.getElementById('ep-peso-u-wrap');
  if(!pesoWrap) return;
  var nextOpen;
  if(forceOpen === true || forceOpen === false){
    nextOpen = forceOpen;
  }else{
    nextOpen = pesoWrap.classList.contains('is-hidden');
  }
  pesoWrap.classList.toggle('is-hidden', !nextOpen);
}

function epSyncTotUVisibility(){
  var unitEl = document.getElementById('ep-unit');
  var row = document.querySelector('#ep .ep-row--qty');
  var totUCol = document.getElementById('ep-tot-u-col');
  var pesoWrap = document.getElementById('ep-peso-u-wrap');
  if(!unitEl || !row || !totUCol || !pesoWrap) return;
  var showTotU = epUnitShowsTotU(unitEl.value);
  row.classList.toggle('has-totu', showTotU);
  row.classList.toggle('no-totu', !showTotU);
  totUCol.classList.toggle('is-hidden', !showTotU);
  if(!showTotU){
    epTogglePesoU(false);
  }
}

function epRefreshPrezzoBaseUi(){
  var unitEl = document.getElementById('ep-unit');
  var prezzoLbl = document.getElementById('ep-prezzo-label');
  var hintEl = document.getElementById('ep-prezzo-base-hint');
  if(!unitEl) return;
  var unit = unitEl.value || 'pz';
  var isBase = (typeof itemUsesPrezzoPerBaseUm === 'function') ? itemUsesPrezzoPerBaseUm(unit) : false;
  var suff = (typeof itemPrezzoBaseUmSuffix === 'function') ? itemPrezzoBaseUmSuffix(unit) : '€';
  if(prezzoLbl){
    prezzoLbl.textContent = isBase ? ('💰 Prezzo base (' + suff + ')') : '💰 Prezzo vendita';
  }
  if(hintEl){
    hintEl.style.display = isBase ? 'block' : 'none';
    hintEl.textContent = isBase ? ('Prezzo Base collegato (' + suff + ') e usato nel magazzino') : '';
  }
}

// ── Semaforo Prezzi: bollino + tasto "Prezzo Verificato" ─────────────────────
function _epRefreshPrezzoDot(){
  var dot = document.getElementById('ep-prezzo-dot');
  if(!dot) return;
  if(_epIdx == null || !rows[_epIdx] || typeof getPriceFreshnessInfo !== 'function'){
    dot.style.display = 'none';
    return;
  }
  var info = getPriceFreshnessInfo(rows[_epIdx]);
  if(!info || !info.dot){
    dot.style.display = 'none';
    return;
  }
  dot.style.display = 'inline-block';
  dot.style.background = info.color;
  var ttl = info.label;
  if(info.days != null) ttl += ' (' + info.days + ' gg dall\u2019ultimo aggiornamento)';
  dot.title = ttl;
}

function epPrezzoVerificato(){
  if(_epIdx == null || !rows[_epIdx]) return;
  if(typeof touchRowPriceUpdate !== 'function') return;
  touchRowPriceUpdate(rows[_epIdx]);
  if(_epSnapshot && _epSnapshot.row) _epSnapshot.row.priceUpdatedAt = rows[_epIdx].priceUpdatedAt;
  if(typeof lsSet === 'function' && typeof SK !== 'undefined') lsSet(SK, rows);
  if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(_epIdx);
  _epRefreshPrezzoDot();
  if(typeof renderMagazzino === 'function') renderMagazzino();
  if(typeof showToastGen === 'function') showToastGen('green','\u2705 Prezzo verificato \u2014 timestamp aggiornato');
}

function epRenderPromoGBtn(){
  var btn = document.getElementById('ep-promo-g-btn');
  if(!btn) return;
  var active = !!_epPromoG;
  btn.style.borderColor = active ? 'var(--accent)' : '#5c4a00';
  btn.style.background = active ? 'rgba(245,196,0,.08)' : '#1a1a1a';
  btn.style.opacity = active ? '1' : '.55';
  var badgeHtml = (typeof htmlPromoGBadge === 'function') ? htmlPromoGBadge() : '<span class="promo-g-badge">[G]</span>';
  if(active){
    btn.innerHTML = badgeHtml;
  } else {
    btn.innerHTML = '<span class="promo-g-badge" style="opacity:.35;filter:grayscale(1);" title="Promo giornalino">[G]</span>';
  }
}

function epTogglePromoG(ev){
  if(ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  _epPromoG = !_epPromoG;
  epRenderPromoGBtn();
}

function epSyncPrezzoBaseRigaCarrello(rowIdx, newPrezzo){
  if(!_epCartEditContext || !newPrezzo || typeof carrelli === 'undefined') return;
  var cart = carrelli.find(function(c){ return c.id === _epCartEditContext.cartId; });
  if(!cart || !cart.items) return;
  var itemIdx = parseInt(_epCartEditContext.itemIdx, 10);
  var it = (!isNaN(itemIdx) && cart.items[itemIdx]) ? cart.items[itemIdx] : null;
  if(!it || String(it.rowIdx) !== String(rowIdx)){
    it = cart.items.find(function(x){ return x && String(x.rowIdx) === String(rowIdx); });
  }
  if(!it || it._stornoReso) return;

  it.prezzoUnit = newPrezzo;
  it._prezzoOriginale = newPrezzo;
  it._prezzoBase = newPrezzo;
  it._scontoApplicato = 0;
  delete it._scontoTipo;
  delete it._scaglioneAttivo;
  delete it._scaglioneQta;
  it.scampolo = false;
  it.fineRotolo = false;
  it._tuttoRotolo = false;
  it._scaglionato = false;
  if(typeof itemUsesPrezzoPerBaseUm === 'function' && itemUsesPrezzoPerBaseUm(it.unit)){
    it._prezzoUnitaBase = newPrezzo;
  } else {
    delete it._prezzoUnitaBase;
  }
  if(String(it.nota || '').trim() === 'ROTOLO INTERO') it.nota = '';
  if(typeof _cartSyncLinkedOrdine === 'function') _cartSyncLinkedOrdine(cart);
  if(typeof saveCarrelli === 'function') saveCarrelli();
}

function saveEditProdotto(){
  if(_epIdx === null) return;
  var i = _epIdx;
  if(!magazzino[i]) magazzino[i] = {};

  // gf() - definita globalmente in [SECTION: UTILS]

  var newCodM = (typeof sanitizeCodiceMagazzinoInput === 'function')
    ? sanitizeCodiceMagazzinoInput(gf('ep-codm'))
    : gf('ep-codm');
  var codMEl = document.getElementById('ep-codm');
  if(codMEl) codMEl.value = newCodM;
  if(typeof findDuplicateCodMagazzino === 'function'){
    var dupCod = findDuplicateCodMagazzino(newCodM, i);
    if(dupCod){
      if(typeof showCodiceMagazzinoDuplicateError === 'function') showCodiceMagazzinoDuplicateError(newCodM, dupCod.desc);
      else showToastGen('red', "⚠️ Errore: Il codice " + String(newCodM).trim() + " è già assegnato all'articolo " + (dupCod.desc || '—') + ". Usa un codice diverso.");
      return;
    }
  }

  // Aggiorna row
  var newPrezzo = gf('ep-prezzo');
  var unitEl = document.getElementById('ep-unit');
  var unitNow = unitEl ? unitEl.value : 'pz';
  if(typeof normalizeUmValue === 'function') unitNow = normalizeUmValue(unitNow);
  var isBaseUm = (typeof itemUsesPrezzoPerBaseUm === 'function') ? itemUsesPrezzoPerBaseUm(unitNow) : false;
  if(isBaseUm && parsePriceIT(newPrezzo) > 0){
    // Per UM base (kg/mt/mq/lt ecc.) il prezzo articolo è sempre il prezzo base.
    newPrezzo = itemFormatPrezzoLineStr(parsePriceIT(newPrezzo));
  }
  var oldPrezzoEdit = rows[i].prezzo;
  var oldPromoTipoEdit = rows[i].isPromo === true && String(rows[i].promoTipo || '') === 'G' ? 'G' : '';
  if(newPrezzo && newPrezzo !== oldPrezzoEdit){
    if(!rows[i].priceHistory) rows[i].priceHistory = [];
    var histEntry = { prezzo: oldPrezzoEdit, data: new Date().toLocaleDateString('it-IT') };
    if(oldPromoTipoEdit) histEntry.tipo = oldPromoTipoEdit;
    rows[i].priceHistory.unshift(histEntry);
    if(rows[i].priceHistory.length > 30) rows[i].priceHistory.length = 30;
    if(typeof touchRowPriceUpdate === 'function') touchRowPriceUpdate(rows[i]);
  }

  rows[i].desc      = gf('ep-desc');
  rows[i].codF      = gf('ep-codf');
  rows[i].codM      = newCodM;
  rows[i].prezzo    = newPrezzo;
  rows[i].prezzoOld = (newPrezzo && newPrezzo !== oldPrezzoEdit) ? oldPrezzoEdit : gf('ep-prezzoold');
  rows[i].size      = autoSize(newPrezzo);
  rows[i]._updatedAt = Date.now();
  rows[i].unit      = unitNow || 'pz';
  rows[i].isPromo   = !!_epPromoG;
  rows[i].promoTipo = _epPromoG ? 'G' : '';
  if(newPrezzo && newPrezzo !== oldPrezzoEdit){
    epSyncPrezzoBaseRigaCarrello(i, newPrezzo);
  }

  // Aggiorna magazzino
  magazzino[i].specs          = gf('ep-specs');
  magazzino[i].marca          = gf('ep-marca');
  magazzino[i].posizione      = gf('ep-pos');
  magazzino[i].prezzoAcquisto = gf('ep-acq');
  var prevQtyEdit = magazzino[i].qty!==undefined&&magazzino[i].qty!==''?Number(magazzino[i].qty):null;
  var qtyVal = gf('ep-qty');
  var newQtyEdit = qtyVal !== '' ? parseFloat(qtyVal) : '';
  magazzino[i].qty   = newQtyEdit;
  var sogVal = gf('ep-soglia');
  magazzino[i].soglia  = sogVal !== '' ? parseFloat(sogVal) : 0;
  var catEl = document.getElementById('ep-cat');
  magazzino[i].cat   = catEl ? catEl.value : '';
  var subEl = document.getElementById('ep-subcat');
  magazzino[i].subcat        = subEl ? subEl.value : '';
  var totUVal = gf('ep-tot-u');
  var pesoUVal = gf('ep-peso-u');
  if(epUnitShowsTotU(unitNow)){
    magazzino[i].tot_u = totUVal !== '' ? parseFloat(totUVal) : '';
    magazzino[i].peso_u = pesoUVal !== '' ? parseFloat(pesoUVal) : '';
  }else{
    magazzino[i].tot_u = '';
    magazzino[i].peso_u = '';
  }
  magazzino[i].nomeFornitore = gf('ep-fornitore');
  magazzino[i]._updatedAt    = Date.now();

  var snapR = _epSnapshot ? _epSnapshot.row : null;
  var snapM = _epSnapshot ? _epSnapshot.mag : null;
  var normQtyEp = function(v){
    if(v === '' || v === undefined || v === null) return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  var productChanged = false;
  if(snapR){
    if(String(snapR.prezzo || '') !== String(newPrezzo || '')) productChanged = true;
    if(!productChanged && snapM){
      var oq = normQtyEp(snapM.qty);
      var nq = normQtyEp(newQtyEdit);
      if(oq !== nq) productChanged = true;
    }
  }
  if(productChanged && typeof touchRowProductChangeAt === 'function') touchRowProductChangeAt(rows[i]);

  // Controlla scorta e registra movimento
  var qtyEditNum = newQtyEdit!=='' ? Number(newQtyEdit) : null;
  checkScorta(i, qtyEditNum, prevQtyEdit);
  if(qtyEditNum !== null && prevQtyEdit !== null && qtyEditNum !== prevQtyEdit){
    var deltaEdit = qtyEditNum - prevQtyEdit;
    var tipoEdit = deltaEdit < 0 ? 'vendita' : 'carico';
    registraMovimento(i, tipoEdit, deltaEdit, prevQtyEdit, qtyEditNum, 'modifica scheda');
  }

  // Salva tutto
  lsSet(SK, rows);
  lsSet(MAGK, magazzino);
  _fbSaveArticolo(i);
  updateStats();
  updateStockBadge();

  document.getElementById('ep').classList.remove('open');
  _epSnapshot = null;
  _epIdx = null;
  _epPromoG = false;
  _epCartEditContext = null;
  updateOrdBadge();
  updateCartBadge();
  var activeTab = document.querySelector('.tab-content.active');
  if(activeTab){
    var tid = activeTab.id;
    if(tid==='t0'){
      if(typeof invRefreshT0 === 'function') invRefreshT0();
      else if(typeof renderInventario === 'function') renderInventario();
    }
    else if(tid==='t1') renderTable();
    else if(tid==='tc') renderCartTabs();
    else if(tid==='tmov') renderMovimenti();
  }
  // Se aperto dal carrello - aggiungi automaticamente al carrello attivo
  if(_epFromCart && activeCartId){
    var cart=carrelli.find(function(ct){return ct.id===activeCartId;});
    var row=rows[i];
    if(cart && row && row.desc){
      var newItem={
        id: Date.now()+'_'+Math.random().toString(36).slice(2,6),
        desc: row.desc,
        codM: row.codM||'',
        codF: row.codF||'',
        prezzoUnit: row.prezzo||row.prezzoV||'0',
        qty: 1
      };
      (cart.items=cart.items||[]).push(newItem);
      lsSet(CARTK, carrelli);
      updateCartBadge();
    }
    _epFromCart=false;
    goTab('tc');
  }
  _epFromCart=false;
  showToastGen('green','\u2705 Prodotto salvato');
}

function cancelEditProdotto(){
  if(_epIdx !== null){
    if(_epIsNew){
      // Articolo nuovo mai salvato: eliminalo
      rows.splice(_epIdx, 1);
      if(magazzino.length > _epIdx) magazzino.splice(_epIdx, 1);
      lsSet(SK, rows);
      renderTable();
    } else if(_epSnapshot){
      // Ripristina snapshot
      rows[_epIdx] = _epSnapshot.row;
      magazzino[_epIdx] = _epSnapshot.mag;
    }
  }
  _epSnapshot = null;
  _epIdx = null;
  _epIsNew = false;
  _epFromCart = false;
  _epPromoG = false;
  _epCartEditContext = null;
  document.getElementById('ep').classList.remove('open');
}




// ── LOCK COLLABORATIVO — forza accesso con triplo tap ────────────
