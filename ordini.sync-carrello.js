// ordini.sync-carrello.js - estratto da ordini.js

// ══ ORDINI ════════════════════════════════════════════════════════
function aggiornaOrdine(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.ordId)return;
  var ord=ordini.find(function(o){return o.id===cart.ordId;});
  if(!ord){
    // Ordine eliminato: scollega il carrello
    cart.stato='';
    cart.locked=false;
    delete cart.ordId;
    saveCarrelli(); renderCartTabs();
    showToastGen('orange','Ordine eliminato — carrello scollegato');
    return;
  }
  // ── Confronta vecchio vs nuovo per nota automatica ──
  var vecchiItems = ord.items || [];
  var nuoviItems  = cart.items || [];
  var ora = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  var diff = [];

  // Articoli modificati o rimossi
  vecchiItems.forEach(function(old_it){
    var new_it = nuoviItems.find(function(x){ return x.desc === old_it.desc; });
    if(!new_it){
      diff.push('rimosso: ' + (old_it.desc||'?'));
    } else {
      var qOld = parseFloat(old_it.qty||0), qNew = parseFloat(new_it.qty||0);
      if(qOld !== qNew) diff.push((new_it.desc||'?') + ': ' + qOld + '→' + qNew + ' ' + (new_it.unit||'pz'));
    }
  });
  // Articoli aggiunti
  nuoviItems.forEach(function(new_it){
    var esiste = vecchiItems.find(function(x){ return x.desc === new_it.desc; });
    if(!esiste) diff.push('aggiunto: ' + (new_it.desc||'?') + ' ×' + (new_it.qty||1));
  });

  // Aggiorna ordine con i dati modificati del carrello
  ord.items=JSON.parse(JSON.stringify(cart.items));
  var notaBase = cart.nota || '';
  if(diff.length){
    var rigaDiff = '✏️ ' + ora + ' — ' + diff.join(' · ');
    // Salva diff separatamente per il popup modificato
    if(!ord.modificheDiff) ord.modificheDiff = [];
    ord.modificheDiff.unshift(rigaDiff);
    if(ord.modificheDiff.length > 5) ord.modificheDiff.length = 5; // max 5 storici
    // NON toccare ord.nota con la diff — la nota resta quella del cliente
    ord.nota = notaBase;
  } else {
    ord.nota = notaBase;
  }
  var tot=(cart.items||[]).reduce(function(s,it){return s+(_prezzoEffettivo(it)*parseFloat(it.qty||0));},0);
  ord.totale=tot.toFixed(2);
  ord.scontoGlobale=cart.scontoGlobale||null;
  ord.modificato=true;
  ord.modificatoAt=new Date().toLocaleString('it-IT');
  ord.modificatoAtISO=new Date().toISOString();
  // Salva chi ha modificato
  if(typeof _currentUser !== 'undefined' && _currentUser){
    if(!ord.commesso) ord.commesso = _currentUser.key;
    ord.modificatoDa = _currentUser.key;
  }
  saveOrdini();
  // Rimetti il carrello come inviato
  cart.stato='inviato';
  cart.locked=true;
  saveCarrelli();
  feedbackSend();
  renderCartTabs();
  showToastGen('purple','- Ordine #'+(ord.numero||'')+' aggiornato!');
}

function annullaModifica(cartId){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart)return;
  if(cart.ordId){
    var ord=ordini.find(function(o){return o.id===cart.ordId;});
    if(ord){
      cart.items=JSON.parse(JSON.stringify(ord.items));
      cart.nota=ord.nota||'';
      cart.stato='inviato';
      cart.locked=true;
    } else {
      // Ordine eliminato: scollega
      cart.stato='';
      cart.locked=false;
      delete cart.ordId;
      showToastGen('orange','Ordine eliminato — carrello scollegato');
    }
  } else {
    cart.stato='inviato';
    cart.locked=true;
  }
  saveCarrelli();
  renderCartTabs();
  showToastGen('green','- Modifiche annullate');
}
