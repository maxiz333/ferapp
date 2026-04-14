/**
 * -----------------------------------------------------------------------
 *  RATTAZZI - app.js
 *  - CARRELLO: ricerca, numpad, sconto, scaglioni, DDT
 *  - ORDINI: lista, dettaglio, cassa, auto-refresh
 *  - MOVIMENTI: registrazione, filtri, report
 *  - AI/FOTO: import articoli da foto
 *  - UI: tema, ricerca globale, popup, backup, correlati
 *  - FORNITORI: ordini, fatture
 *  - FIREBASE: sync real-time
 * -----------------------------------------------------------------------
 */

// ══ VARIABILI GLOBALI ══════════════════════════════════════════════
var CARTK=window.AppKeys.CARRELLI, ORDK=window.AppKeys.ORDINI, CART_CK=window.AppKeys.CARRELLI_CESTINO;
var carrelli=lsGet(CARTK)||[], ordini=lsGet(ORDK)||[];
var carrelliCestino=lsGet(CART_CK)||[];
// Pulizia giornaliera: rimuovi carrelli creati prima di oggi (tranne inviati/modifica)
(function(){
  var oggi=new Date().toISOString().slice(0,10);
  var prima=carrelli.length;
  carrelli=carrelli.filter(function(c){
    if(c.stato==='inviato'||c.stato==='modifica') return true;
    var cData='';
    if(c.creatoAtISO) cData=c.creatoAtISO.slice(0,10);
    else if(c.dataCreazione) cData=new Date(c.dataCreazione).toISOString().slice(0,10);
    if(!cData) return true;
    return cData>=oggi;
  });
  if(carrelli.length<prima){ lsSet(CARTK,carrelli); }
})();
var activeCartId=carrelli.length?carrelli[carrelli.length-1].id:null;
var ordFiltro='nuovo';
var ORDK_ARCH=window.AppKeys.ORDINI_ARCHIVIO;
/** Archivio ordini completati (lazy: non leggiamo localStorage all'avvio se non serve). */
var ordiniArchivio;
var ordFornStorico=lsGet(window.AppKeys.ORD_FORN_STORICO,[]);

function getOrdiniArchivio(){
  if(ordiniArchivio===undefined||ordiniArchivio===null)
    ordiniArchivio=lsGet(ORDK_ARCH)||[];
  return ordiniArchivio;
}

// Archivia ordini completati da 7+ giorni
(function(){
  var now=Date.now();
  var SETTE_GG=7*24*60*60*1000;
  var daArch=[];
  ordini=ordini.filter(function(o){
    if(o.stato!=='completato') return true;
    var compAt=o.completatoAtISO?new Date(o.completatoAtISO).getTime():
               (o.createdAt?new Date(o.createdAt).getTime():0);
    if(!compAt) return true;
    if(now-compAt>SETTE_GG){ daArch.push(o); return false; }
    return true;
  });
  if(daArch.length){
    var prev=lsGet(ORDK_ARCH)||[];
    ordiniArchivio=daArch.concat(prev);
    lsSet(ORDK,ordini);
    lsSet(ORDK_ARCH,ordiniArchivio);
  }
})();

var _fb=null,_fbDb=null,_fbReady=false,_fbSyncing=false,_fbSyncingCart=false;

// Ripara dati da Firebase (converte oggetti in array)
function _fbFix(data){
  if(!data)return[];
  var arr=Array.isArray(data)?data:Object.values(data);
  arr=arr.filter(function(x){return x!=null;});
  arr.forEach(function(item){
    if(!item)return;
    if(!item.items)item.items=[];
    if(!Array.isArray(item.items))item.items=Object.values(item.items).filter(function(x){return x!=null;});
    item.items.forEach(function(it){
      if(it&&it.scaglioni&&!Array.isArray(it.scaglioni)){
        it.scaglioni=Object.values(it.scaglioni).filter(function(x){return x!=null;});
      }
    });
  });
  return arr;
}

// _fbPush / saveCarrelli / saveOrdini -> core.sync-save.js


// ══ FEEDBACK / TOAST / CONFIRM / BADGES ═══════════════════════════
// --- FEEDBACK (vibra + suono) ---------------------------------
function feedbackAdd(){
  // Vibrazione breve
  if(navigator.vibrate)navigator.vibrate(50);
  // Beep sottile
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    var osc=ctx.createOscillator();var gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.value=1200;
    gain.gain.setValueAtTime(0.12,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0,ctx.currentTime+0.1);
    osc.start();osc.stop(ctx.currentTime+0.1);
  }catch(e){}
}
function feedbackSend(){
  if(navigator.vibrate)navigator.vibrate([100,50,100]);
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,150,300].forEach(function(d){
      var osc=ctx.createOscillator();var gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=880;
      gain.gain.setValueAtTime(0,ctx.currentTime+d/1000);
      gain.gain.linearRampToValueAtTime(0.15,ctx.currentTime+d/1000+0.04);
      gain.gain.linearRampToValueAtTime(0,ctx.currentTime+d/1000+0.15);
      osc.start(ctx.currentTime+d/1000);osc.stop(ctx.currentTime+d/1000+0.2);
    });
  }catch(e){}
}

// --- NUMERO ORDINE PROGRESSIVO --------------------------------
function getNextOrdNum(){
  var num=parseInt(localStorage.getItem(window.AppKeys.ORD_COUNTER)||'0')+1;
  localStorage.setItem(window.AppKeys.ORD_COUNTER,String(num));
  return num;
}

/** True su layout “ufficio” (stessa soglia della lista ordini desktop). */
function ordineUfficioIsWide(){
  try{
    if(window.matchMedia) return window.matchMedia('(min-width: 769px)').matches;
  }catch(e){}
  return typeof window.innerWidth === 'number' && window.innerWidth >= 769;
}

/**
 * Segna ordine/bozza come visto dall’ufficio e sincronizza subito (Firebase + altri device).
 * Solo su schermo largo: il telefono in negozio non imposta mai visto.
 * @param {object|string} ordOrId ordine o id
 */
function ordineSegnaVistoSeUfficio(ordOrId){
  if(typeof ordini === 'undefined' || !ordini || !ordineUfficioIsWide()) return;
  try{
    var id = ordOrId && ordOrId.id ? ordOrId.id : ordOrId;
    if(!id) return;
    var ord = ordini.find(function(o){ return o && o.id === id; });
    if(!ord || ord.visto === true) return;
    ord.visto = true;
    if(typeof saveOrdini === 'function') saveOrdini();
  }catch(e){ console.warn('ordineSegnaVistoSeUfficio', e); }
}

// --- ULTIMO ARTICOLO AGGIUNTO (per ripeti) --------------------
var _lastAddedItem=null;

// --- TOAST ---------------------------------------------------
// _toastTimer gi- dichiarato nella sezione Magazzino (riusato qui)
var _TOAST_COLORS={green:'#38a169',purple:'#805ad5',blue:'#3182ce',red:'#e53e3e',orange:'#dd6b20'};

// --- CONFIRM DIALOG -------------------------------------------
var _confirmCb=null;

// --- BADGES ---------------------------------------------------
function updateCartBadge(){
  var b=document.getElementById('cart-badge');
  if(!b||!Array.isArray(carrelli))return;
  var n=carrelli.reduce(function(s,c){return s+((c&&c.items)?c.items.length:0);},0);
  b.textContent=n;b.style.display=n?'':'none';
}
function updateOrdBadge(){
  var n=ordini.filter(function(o){return o.stato==='nuovo';}).length;
  var b=document.getElementById('ord-badge');
  if(b){b.textContent=n;b.style.display=n?'':'none';}
}


// ══ NUMPAD GENERICO ═══════════════════════════════════════════════
// --- NUMPAD ---------------------------------------------------
var _numpadValue='';
var _numpadCallback=null;
var _numpadUnit='';

function openNumpad(label,currentVal,unit,callback){
  _numpadValue=String(currentVal||'');
  _numpadCallback=callback;
  _numpadUnit=unit||'';
  document.getElementById('numpad-label').textContent=label||'Quantit-';
  document.getElementById('numpad-display').textContent=_numpadValue||'0';
  document.getElementById('numpad-unit').textContent=_numpadUnit;
  document.getElementById('numpad-overlay').classList.add('open');
}
function closeNumpad(){
  document.getElementById('numpad-overlay').classList.remove('open');
  _numpadCallback=null;
}
function numpadPress(key){
  if(key==='C'){_numpadValue='';} 
  else if(key==='.'){if(_numpadValue.indexOf('.')<0)_numpadValue+='.';} 
  else{_numpadValue+=key;}
  document.getElementById('numpad-display').textContent=_numpadValue||'0';
}
function numpadConfirm(){
  var val=parseFloat(_numpadValue)||0;
  if(_numpadCallback)_numpadCallback(val);
  closeNumpad();
}

// _MAG_FIELDS / _fbSaveArticolo / wrap save+quickEditPrice -> core.sync-save.js
// _showLoadingBar / _updateLoadingBar / _hideLoadingBar -> core.loading.js

// loadMagazzinoFB -> core.magazzino-loader.js


// Blocchi estratti:
// - lock collaborativo ordini -> core.lock.js
// - autenticazione/ruoli/login -> core.auth.js


// Blocchi estratti:
// - _extractMagFromRows / esportaDatabaseCSV / fbSyncTuttoMagazzino -> core.magtools.js
// - modalità cassa (_cassaMode*) -> core.cassa.js
