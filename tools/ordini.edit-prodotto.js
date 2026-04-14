// ordini.edit-prodotto.js - estratto da ordini.js

function openEditProdotto(i, isNew){
  if(!rows[i]) return;
  _epIdx = i;
  _epIsNew = !!isNew;
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
  // Popola tendina storico prezzi
  var ph = r.priceHistory || [];
  var phWrap = document.getElementById('ep-price-history');
  for(var pi = 0; pi < 4; pi++){
    var phEl = document.getElementById('ep-ph-' + (pi + 2));
    if(phEl) phEl.textContent = ph[pi] ? ('€ ' + ph[pi].prezzo + (ph[pi].data ? ' — ' + ph[pi].data : '')) : '—';
  }
  if(phWrap) phWrap.style.display = 'none'; // chiusa di default
  sf('ep-acq',    m.prezzoAcquisto || '');
  sf('ep-specs',  m.specs || '');
  sf('ep-marca',  m.marca || '');
  sf('ep-pos',    m.posizione || '');
  sf('ep-qty',    m.qty !== undefined ? m.qty : '');
  sf('ep-soglia',    m.soglia !== undefined ? m.soglia : '');
  sf('ep-fornitore', m.nomeFornitore || '');

  // Unit-
  var unitSel = document.getElementById('ep-unit');
  if(unitSel){ unitSel.value = m.unit || 'pz'; }

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

function saveEditProdotto(){
  if(_epIdx === null) return;
  var i = _epIdx;
  if(!magazzino[i]) magazzino[i] = {};

  // gf() - definita globalmente in [SECTION: UTILS]

  // Aggiorna row
  var newPrezzo = gf('ep-prezzo');
  if(newPrezzo && newPrezzo !== rows[i].prezzo){
    if(!rows[i].priceHistory) rows[i].priceHistory = [];
    rows[i].priceHistory.push({ prezzo: rows[i].prezzo, data: rows[i].data });
  }

  rows[i].desc      = gf('ep-desc');
  rows[i].codF      = gf('ep-codf');
  rows[i].codM      = gf('ep-codm');
  rows[i].prezzo    = newPrezzo;
  rows[i].prezzoOld = gf('ep-prezzoold');
  rows[i].size      = autoSize(newPrezzo);

  // Aggiorna magazzino
  magazzino[i].specs          = gf('ep-specs');
  magazzino[i].marca          = gf('ep-marca');
  magazzino[i].posizione      = gf('ep-pos');
  magazzino[i].prezzoAcquisto = gf('ep-acq');
  var prevQtyEdit = magazzino[i].qty!==undefined&&magazzino[i].qty!==''?Number(magazzino[i].qty):null;
  var qtyVal = gf('ep-qty');
  var newQtyEdit = qtyVal !== '' ? parseFloat(qtyVal) : '';
  magazzino[i].qty   = newQtyEdit;
  var unitEl = document.getElementById('ep-unit');
  magazzino[i].unit  = unitEl ? unitEl.value : 'pz';
  var sogVal = gf('ep-soglia');
  magazzino[i].soglia  = sogVal !== '' ? parseFloat(sogVal) : '';
  var catEl = document.getElementById('ep-cat');
  magazzino[i].cat   = catEl ? catEl.value : '';
  var subEl = document.getElementById('ep-subcat');
  magazzino[i].subcat        = subEl ? subEl.value : '';
  magazzino[i].nomeFornitore = gf('ep-fornitore');

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
  updateOrdBadge();
  updateCartBadge();
  var activeTab = document.querySelector('.tab-content.active');
  if(activeTab){
    var tid = activeTab.id;
    if(tid==='t0') renderInventario();
    else if(tid==='t1') renderTable();
    else if(tid==='t11') renderMagazzino();
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
  document.getElementById('ep').classList.remove('open');
}




// ── LOCK COLLABORATIVO — forza accesso con triplo tap ────────────
