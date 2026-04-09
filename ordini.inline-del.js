// ordini.inline-del.js - estratto da ordini.js

// --- INLINE EDIT ORDINI (doppio click su cella) ----------------
function ordInlineEdit(el, gi, ii, field){
  // Evita doppia apertura
  if(el._editing) return;
  if(el._lockPending) return;
  if(el.querySelector && el.querySelector('input.ord-inline-input')) return;
  var ord = ordini[gi];
  if(!ord || !ord.items[ii]) return;
  var oid = ord.id;

  function _startInlineEdit(){
    el._editing = true;
    var it = ord.items[ii];
    var oldVal = '';
    var inputType = 'text';
    if(field === 'qty'){ oldVal = parseFloat(it.qty)||0; inputType = 'number'; }
    else if(field === 'price'){ oldVal = it.prezzoUnit || ''; inputType = 'text'; }
    else if(field === 'codF'){ oldVal = it.codF || ''; }

    el.innerHTML = '<input type="'+inputType+'" value="'+oldVal+'" class="ord-inline-input"'+(field==='qty'?' min="0.5" step="0.5"':'')+'>';
    var inp = el.querySelector('input');
    setTimeout(function(){ inp.focus(); inp.select(); }, 50);

    function save(){
      el._editing = false;
      var v = inp.value.trim();
      if(field === 'qty'){
        var nq = parseFloat(v);
        if(!nq || nq <= 0) nq = parseFloat(it.qty)||1;
        it.qty = nq;
        // Ricalcola prezzo scaglionato
        ensurePrezzoOriginaleDaListino(it, false);
        if(it._scaglionato && it._prezzoOriginale && it._scontoApplicato > 0){
          if(nq >= (it._scaglioneQta||10)){
            it.prezzoUnit = (parsePriceIT(it._prezzoOriginale)*(1-it._scontoApplicato/100)).toFixed(2);
          } else {
            it.prezzoUnit = it._prezzoOriginale;
          }
        }
      } else if(field === 'price'){
        if(v) it.prezzoUnit = v;
      } else if(field === 'codF'){
        it.codF = v;
      }
      var tot = ord.items.reduce(function(s,x){ return s + parsePriceIT(x.prezzoUnit)*parseFloat(x.qty||0); },0);
      ord.totale = tot.toFixed(2);
      ord.modificato = true;
      ord.modificatoAt = new Date().toLocaleString('it-IT');
      ord.modificatoAtISO = new Date().toISOString();
      saveOrdini();
      var linkedCart = carrelli.find(function(c){ return c.ordId === ord.id; });
      if(!linkedCart && ord.stato === 'bozza'){
        linkedCart = carrelli.find(function(c){ return c.bozzaOrdId === ord.id; });
      }
      if(linkedCart){ linkedCart.items = JSON.parse(JSON.stringify(ord.items)); saveCarrelli(); }
      renderOrdini();
    }
    inp.addEventListener('blur', save);
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); }
      if(e.key === 'Escape'){ inp.value = oldVal; inp.blur(); }
    });
  }

  // Hardening lock: al primo tap inline acquisisci lock in automatico.
  if(typeof ordAcquireOrderLock !== 'function'){
    _startInlineEdit();
    return;
  }

  el._lockPending = true;
  ordAcquireOrderLock(oid, { force: false }, function(ok){
    el._lockPending = false;
    if(!ok){
      showToastGen('orange','🔒 IN LAVORAZIONE — Triplo tap per forzare');
      if(typeof ordRefreshLockUI === 'function') ordRefreshLockUI();
      else renderOrdini();
      return;
    }
    _startInlineEdit();
  });
}

// ── Rimuovi articolo dall'ordine (doppio tap) ───────────────────
function ordDelItem(el, gi, ii){
  if(el._confirm){
    // Secondo tap — elimina
    var ord = ordini[gi];
    if(!ord || !ord.items[ii]) return;
    ord.items.splice(ii, 1);
    var tot = ord.items.reduce(function(s,x){ return s + parsePriceIT(x.prezzoUnit)*parseFloat(x.qty||0); }, 0);
    ord.totale = tot.toFixed(2);
    ord.modificato = true;
    ord.modificatoAt = new Date().toLocaleString('it-IT');
    ord.modificatoAtISO = new Date().toISOString();
    saveOrdini();
    var linkedCart = carrelli.find(function(c){ return c.ordId === ord.id; });
    if(!linkedCart && ord.stato === 'bozza'){
      linkedCart = carrelli.find(function(c){ return c.bozzaOrdId === ord.id; });
    }
    if(linkedCart){ linkedCart.items = JSON.parse(JSON.stringify(ord.items)); saveCarrelli(); }
    renderOrdini();
    showToastGen('red', 'Articolo rimosso');
    return;
  }
  // Primo tap — chiedi conferma
  el._confirm = true;
  el.textContent = '?';
  el.classList.add('ord-item-del--confirm');
  setTimeout(function(){
    el._confirm = false;
    el.textContent = '×';
    el.classList.remove('ord-item-del--confirm');
  }, 2500);
}
