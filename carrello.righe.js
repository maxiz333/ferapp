// --- CARRELLO - OPERAZIONI ARTICOLI ---------------------------
function cartAddItem(rowIdx){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});if(!cart)return;
  var r=rows[rowIdx]||{};
  var m=magazzino[rowIdx]||{};
  var hasScag=!!(m.scaglioni&&m.scaglioni.length);
  var newItem={rowIdx:rowIdx,desc:r.desc||'',codF:r.codF||'',codM:r.codM||'',specs:m.specs||'',
    posizione:m.posizione||'',prezzoUnit:r.prezzo||'0',qty:1,unit:m.unit||'pz',
    scampolo:false,hasScaglioni:hasScag,scaglioni:hasScag?JSON.parse(JSON.stringify(m.scaglioni)):[],
    nota:'',_scaglioniAperti:false,daOrdinare:false};
  (cart.items=cart.items||[]).push(newItem);
  _lastAddedItem={rowIdx:rowIdx,item:JSON.parse(JSON.stringify(newItem))};
  saveCarrelli();
  feedbackAdd();
  // Avviso stock basso
  var stock=m.qty!==undefined&&m.qty!==''?Number(m.qty):-1;
  var soglia=m.soglia!==undefined&&m.soglia!==''?Number(m.soglia):1;
  if(stock>=0&&stock<=soglia){
    if(stock===0){
      showToastGen('red','-- ESAURITO - '+r.desc+' (stock: 0)');
    } else {
      showToastGen('orange','-- Stock basso - '+r.desc+' (rimaste: '+stock+' '+esc(m.unit||'pz')+')');
    }
  }
  var s=document.getElementById('cart-search');if(s)s.value='';
  var rs=document.getElementById('cart-search-results');if(rs)rs.innerHTML='';
  renderCartTabs();
  // Flash sull'ultimo articolo aggiunto
  setTimeout(function(){
    var items=document.querySelectorAll('.cart-item-row');
    var last=items[items.length-1];
    if(last){last.classList.add('cart-item-flash');last.scrollIntoView({behavior:'smooth',block:'nearest'});}
  },50);
}
function cartDelta(cartId,idx,delta){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  // Fix: incremento sempre intero (1, 2, 3...) — minimo assoluto 1
  var newQty = Math.round(parseFloat(cart.items[idx].qty)||0) + Math.round(delta);
  cart.items[idx].qty = Math.max(1, newQty);
  _cartApplicaScaglione(cart.items[idx]);
  saveCarrelli();renderCartTabs();
}
function cartSetQty(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  // Fix: solo interi, minimo 1
  cart.items[idx].qty = Math.max(1, Math.round(parseFloat(val)||1));
  _cartApplicaScaglione(cart.items[idx]);
  saveCarrelli();renderCartTabs();
}
function cartSetPrezzo(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx].prezzoUnit=val;saveCarrelli();renderCartTabs();
}
function cartSetUnit(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx].unit=val;saveCarrelli();renderCartTabs();
}

// Helper: calcola prezzo effettivo (con sconto scampolo/rotolo se attivo) — base = listino
function _prezzoEffettivo(it){
  var p = listinoPrezzoNum(it);
  var sc=it._scontoApplicato||0;
  if((it.scampolo||it.fineRotolo) && sc>0) return p*(1-sc/100);
  if(it._scaglionato && sc>0){
    var q=parseFloat(it.qty||0);
    var soglia=it._scaglioneQta||10;
    if(q>=soglia) return p*(1-sc/100);
  }
  return p;
}
function cartCycleScampolo(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  if(!it.scampolo && !it.fineRotolo && !it._tuttoRotolo && !it._scaglionato){
    if(!ensurePrezzoOriginaleDaListino(it, true)){
      showToastGen('orange','Listino non disponibile: imposta prezzo o cerca da magazzino');
      return;
    }
    it.scampolo=true; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=false;
    it._scontoTipo='scampolo';
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAMPOLO_DEFAULT_PCT;
  } else if(it.scampolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)) return;
    it.scampolo=false; it.fineRotolo=true; it._tuttoRotolo=true; it._scaglionato=false;
    it._scontoTipo='rotolo';
    it._scontoApplicato = SCONTO_ROTOLO_DEFAULT_PCT;
    it.nota='ROTOLO INTERO';
  } else if(it.fineRotolo || it._tuttoRotolo){
    if(!ensurePrezzoOriginaleDaListino(it, true)) return;
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=true;
    it._scontoTipo='scaglionato';
    if(it.nota==='ROTOLO INTERO') it.nota='';
    if(!it._scontoApplicato) it._scontoApplicato=SCONTO_SCAGLIONI_DEFAULT_PCT;
    if(!it._scaglioneQta) it._scaglioneQta=10;
  } else {
    var restoreC = it._prezzoOriginale || listinoPrezzoString(it);
    it.scampolo=false; it.fineRotolo=false; it._tuttoRotolo=false; it._scaglionato=false;
    delete it._scontoTipo; delete it._scontoApplicato; delete it._scaglioneQta;
    delete it._prezzoOriginale;
    if(restoreC && parsePriceIT(restoreC) > 0) it.prezzoUnit = restoreC;
  }
  saveCarrelli();renderCartTabs();
}
function cartSetScontoScampolo(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  it._scontoApplicato=parseFloat(val)||0;
  if(it.scampolo||it.fineRotolo||it._scaglionato){
    ensurePrezzoOriginaleDaListino(it, true);
  }
  saveCarrelli();renderCartTabs();
}
function _applicaScontoScampolo(it){
  if(!ensurePrezzoOriginaleDaListino(it, true)) return;
  var base = parsePriceIT(it._prezzoOriginale);
  if(base <= 0) return;
  var sc = it._scontoApplicato || 0;
  if((it.scampolo || it.fineRotolo) && sc > 0){
    it.prezzoUnit = (base * (1 - sc/100)).toFixed(2);
  } else if(it.scampolo || it.fineRotolo){
    it.prezzoUnit = it._prezzoOriginale;
  }
}
function cartSetNota(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx].nota=val;saveCarrelli();
}
function cartToggleNotaInline(cartId,idx){
  var el=document.getElementById('cart-nota-'+idx);
  if(!el)return;
  var isVisible=el.style.display!=='none';
  el.style.display=isVisible?'none':'block';
  if(!isVisible){
    var inp=el.querySelector('input');
    if(inp){inp.focus();inp.select();}
  }
}
function cartHideNota(idx){
  // Piccolo ritardo per permettere all'oninput di salvare prima di nascondere
  setTimeout(function(){
    var el=document.getElementById('cart-nota-'+idx);
    if(el) el.style.display='none';
  },150);
}
function cartToggleDaOrdinare(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx].daOrdinare=!cart.items[idx].daOrdinare;
  saveCarrelli();renderCartTabs();
}
function cartSetNotaOrdine(cartId,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(cart){cart.nota=val;saveCarrelli();}
}
function cartRemoveItem(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});if(!cart)return;
  if(!(cart.items||[])[idx])return;
  _takeSnapshot();
  _fbSyncing=true; // blocca Firebase durante operazione
  var removed=(cart.items||[]).splice(idx,1)[0];
  lsSet(CARTK,carrelli);updateCartBadge();_fbPush('carrelli',carrelli);
  setTimeout(function(){_fbSyncing=false;},1000);
  renderCartTabs();
  // Undo toast
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#222;border:1px solid #444;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:9000;box-shadow:0 4px 20px rgba(0,0,0,.5);';
  t.innerHTML='<span style="font-size:13px;color:#e0e0e0;">-- Rimosso</span>';
  var btn=document.createElement('button');
  btn.textContent='Annulla';
  btn.style.cssText='padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;';
  btn.onclick=function(){(cart.items||[]).splice(idx,0,removed);saveCarrelli();renderCartTabs();t.remove();};
  t.appendChild(btn);document.body.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},5000);
}

function cartDuplicaItem(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var orig=cart.items[idx];
  var copy=JSON.parse(JSON.stringify(orig));
  copy.nota=copy.nota?(copy.nota+' (copia)'):'(copia)';
  copy.qty=1;
  copy._checked=false;
  copy._correlatiAperti=false;
  (cart.items||[]).splice(idx+1,0,copy);
  feedbackAdd();
  saveCarrelli();renderCartTabs();
  showToastGen('green','- Articolo duplicato - modifica la nota per distinguerlo');
}

// --- SPUNTE CARRELLO (verifica pezzi presi) -------------------
function cartToggleCheck(cartId,idx,checked){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx]._checked=checked;
  // Aggiorna visuale senza re-render completo
  var row=document.getElementById('cart-row-'+idx);
  if(row){
    row.style.opacity=checked?'0.5':'1';
    row.style.background=checked?'rgba(56,161,105,.06)':'';
    var desc=row.querySelector('div[style*="font-weight:700"]');
    if(desc){
      desc.style.textDecoration=checked?'line-through':'none';
      desc.style.opacity=checked?'0.6':'1';
    }
  }
  saveCarrelli();
  // Aggiorna counter nello sticky (leggero, senza re-render)
  var checkedN=(cart.items||[]).filter(function(x){return x._checked;}).length;
  var allDone=checkedN===(cart.items||[]).length;
  // Re-render sticky solo se cambia lo stato "tutto spuntato"
  renderCartTabs();
}

// --- CORRELATI NEL CARRELLO -----------------------------------
function cartToggleCorrelati(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  cart.items[idx]._correlatiAperti=!cart.items[idx]._correlatiAperti;
  saveCarrelli();renderCartTabs();
}

function _trovaCorrelati(rowIdx){
  var r=rows[rowIdx];if(!r)return[];
  var m=magazzino[rowIdx]||{};
  var results=[];
  var seen={};
  seen[rowIdx]=true;

  // 1. Correlati espliciti dal magazzino
  if(m.correlati&&m.correlati.length){
    m.correlati.forEach(function(ri){
      if(seen[ri]||!rows[ri]||removed.has(String(ri)))return;
      seen[ri]=true;
      results.push({i:ri,r:rows[ri],m:magazzino[ri]||{},reason:'correlato'});
    });
  }

  // 2. Stessa sottocategoria (es. tutte le viti M6, M8, M10...)
  if(m.subcat&&m.cat){
    rows.forEach(function(r2,i2){
      if(seen[i2]||removed.has(String(i2)))return;
      var m2=magazzino[i2]||{};
      if(m2.cat===m.cat&&m2.subcat===m.subcat){
        seen[i2]=true;
        results.push({i:i2,r:r2,m:m2,reason:m.subcat});
      }
    });
  }

  // 3. Stessa categoria (pi- ampio)
  if(m.cat&&results.length<8){
    rows.forEach(function(r2,i2){
      if(seen[i2]||removed.has(String(i2)))return;
      var m2=magazzino[i2]||{};
      if(m2.cat===m.cat){
        seen[i2]=true;
        results.push({i:i2,r:r2,m:m2,reason:'stessa cat.'});
      }
    });
  }

  // 4. Parole chiave in comune nella descrizione (es. "dado" - trova tutti i dadi)
  if(results.length<6){
    var words=(r.desc||'').toLowerCase().split(/\s+/).filter(function(w){return w.length>=4;}).slice(0,3);
    if(words.length){
      rows.forEach(function(r2,i2){
        if(seen[i2]||removed.has(String(i2))||results.length>=12)return;
        var d2=(r2&&r2.desc||'').toLowerCase();
        for(var wi=0;wi<words.length;wi++){
          if(d2.indexOf(words[wi])>=0){
            seen[i2]=true;
            results.push({i:i2,r:r2,m:magazzino[i2]||{},reason:'simile'});
            break;
          }
        }
      });
    }
  }

  return results;
}

// Numpad per quantit-
function openQtyNumpad(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  openNumpad(it.desc,it.qty,it.unit||'pz',function(val){
    it.qty=val;_cartApplicaScaglione(it);saveCarrelli();renderCartTabs();
  });
}

// --- SCAGLIONI CARRELLO ---------------------------------------
function _cartApplicaScaglione(it){
  if(!it.hasScaglioni||!it.scaglioni||!it.scaglioni.length){
    if(it._prezzoBase){it.prezzoUnit=it._prezzoBase;delete it._prezzoBase;delete it._scaglioneAttivo;}
    return;
  }
  var qty=parseFloat(it.qty)||1;
  if(!it._prezzoBase)it._prezzoBase=it.prezzoUnit;
  // Filtra solo scaglioni completi (con qtaMin > 0 e sconto > 0)
  var validi=it.scaglioni.filter(function(sg){
    return sg.qtaMin&&parseFloat(sg.qtaMin)>0&&sg.sconto&&parseFloat(sg.sconto)>0;
  });
  // Calcola prezzo per ogni scaglione valido
  var base=parsePriceIT(it._prezzoBase)||0;
  validi.forEach(function(sg){
    if(base>0)sg.prezzo=(base*(1-parseFloat(sg.sconto)/100)).toFixed(2);
  });
  var sorted=validi.sort(function(a,b){return(parseFloat(b.qtaMin)||0)-(parseFloat(a.qtaMin)||0);});
  for(var i=0;i<sorted.length;i++){
    var sg=sorted[i];
    if(qty>=parseFloat(sg.qtaMin)){
      it.prezzoUnit=String(sg.prezzo);
      it._scaglioneAttivo={qtaMin:sg.qtaMin,sconto:sg.sconto,prezzo:sg.prezzo};
      return;
    }
  }
  it.prezzoUnit=it._prezzoBase;
  delete it._scaglioneAttivo;
}

function cartToggleScaglioni(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx])return;
  var it=cart.items[idx];
  it._scaglioniAperti=!it._scaglioniAperti;
  if(!it.hasScaglioni)it.hasScaglioni=true;
  if(!it.scaglioni)it.scaglioni=[];
  // Se apro e non ci sono righe, aggiungi una riga vuota pronta
  if(it._scaglioniAperti&&it.scaglioni.length===0){
    it.scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  }
  saveCarrelli();renderCartTabs();
}

function cartUpdScag(cartId,itemIdx,sgIdx,field,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  var it=cart.items[itemIdx];
  if(!it.scaglioni||!it.scaglioni[sgIdx])return;
  var sg=it.scaglioni[sgIdx];
  var base= parsePriceIT(it._prezzoBase||it.prezzoUnit);
  if(field==='qtaMin')sg.qtaMin=parseFloat(val)||0;
  else if(field==='sconto'){
    sg.sconto=parseFloat(val)||0;
  }
  // Calcola prezzo automaticamente dallo sconto
  if(base>0&&sg.sconto>0){
    sg.prezzo=(base*(1-sg.sconto/100)).toFixed(2);
  }
  _cartApplicaScaglione(it);
  saveCarrelli();renderCartTabs();
}

function cartAddScag(cartId,itemIdx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  if(!cart.items[itemIdx].scaglioni)cart.items[itemIdx].scaglioni=[];
  cart.items[itemIdx].scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  saveCarrelli();renderCartTabs();
}

function cartRmvScag(cartId,itemIdx,sgIdx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[itemIdx])return;
  var it=cart.items[itemIdx];
  it.scaglioni.splice(sgIdx,1);
  // Assicurati che ci sia sempre almeno una riga vuota se il pannello - aperto
  if(it._scaglioniAperti&&it.scaglioni.length===0){
    it.scaglioni.push({qtaMin:'',sconto:'',prezzo:''});
  }
  _cartApplicaScaglione(it);
  saveCarrelli();renderCartTabs();
}
