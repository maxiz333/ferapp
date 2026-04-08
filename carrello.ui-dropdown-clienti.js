// =============================================================================
//  CLIENTI DROPDOWN — Menu raggruppato per giorno
// =============================================================================
var _gg = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Sabato'];

function ctApriClienti(){
  var dd = document.getElementById('ct-clienti-dropdown');
  if(!dd) return;
  ctRenderClientiList();
  dd.classList.add('open');
}

function ctChiudiClienti(){
  var dd = document.getElementById('ct-clienti-dropdown');
  if(dd) dd.classList.remove('open');
}

function ctRenderClientiList(){
  var list = document.getElementById('ct-clienti-list');
  if(!list) return;

  // Filtra solo carrelli di oggi
  var oggiStr = new Date().toISOString().slice(0,10);
  var carrelliOggi = [];
  carrelli.forEach(function(cart, ci){
    var cData = '';
    if(cart.creatoAtISO) cData = cart.creatoAtISO.slice(0,10);
    else if(cart.dataCreazione) cData = new Date(cart.dataCreazione).toISOString().slice(0,10);
    if(cData === oggiStr || cart.stato === 'inviato' || cart.stato === 'modifica'){
      carrelliOggi.push({cart:cart, ci:ci});
    }
  });

  if(!carrelliOggi.length){
    list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Nessun cliente oggi.<br>Premi ＋ NUOVO per iniziare.</div>';
    return;
  }

  var h = '';
  carrelliOggi.forEach(function(item){
    var cart     = item.cart;
    var ci       = item.ci;
    var n        = (cart.items||[]).length;
    var isActive = cart.id === activeCartId;
    var stato    = cart.stato === 'inviato' ? '✅ ' : cart.stato === 'modifica' ? '✏️ ' : '';
    h += '<button class="ct-clienti-btn' + (isActive ? ' active' : '') + '" ' +
         'onclick="ctSelezionaCliente(' + ci + ')">' +
         '<span onclick="ctEditClienteName(\''+cart.id+'\')" style="cursor:pointer">' + stato + esc(cart.nome || '—') + '</span>' +
         (n ? '<span class="ct-clienti-n">' + n + ' art.</span>' : '') +
         '</button>';
  });
  list.innerHTML = h;
}

function ctSelezionaCliente(ci){
  switchCart(ci);
  ctChiudiClienti();
}
