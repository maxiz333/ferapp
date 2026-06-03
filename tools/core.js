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
var activeCartId=carrelli.length?carrelli[carrelli.length-1].id:null;
var ordFiltro='nuovo';
var ORDK_ARCH=window.AppKeys.ORDINI_ARCHIVIO;
/** Archivio ordini completati (lazy: non leggiamo localStorage all'avvio se non serve). */
var ordiniArchivio;
var ordFornStorico=lsGet(window.AppKeys.ORD_FORN_STORICO,[]);

function _normalizeOrdiniArchivio(raw){
  if(raw == null) return [];
  if(Array.isArray(raw)) return raw;
  if(typeof _fbFix === 'function') return _fbFix(raw);
  if(typeof raw === 'object') return Object.values(raw).filter(function(x){ return x != null; });
  return [];
}

function getOrdiniArchivio(){
  if(ordiniArchivio===undefined||ordiniArchivio===null)
    ordiniArchivio=_normalizeOrdiniArchivio(lsGet(ORDK_ARCH));
  else if(!Array.isArray(ordiniArchivio))
    ordiniArchivio=_normalizeOrdiniArchivio(ordiniArchivio);
  return ordiniArchivio;
}

var SETTE_GG_MS = 13 * 24 * 60 * 60 * 1000;
/** Fallback: forza eleggibilità archivio se manca ogni data affidabile. */
var _ORD_COMPLETATO_FALLBACK_MS = 14 * 24 * 60 * 60 * 1000;

/** Data giorno per filtri UI (priorità data sulla card). */
function _ordCardDateISO(ord){
  if(!ord) return '';
  if(ord.dataISO){
    var s0=String(ord.dataISO).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s0)) return s0;
  }
  var fromMs=_ordParseItalianDataMs(ord.data);
  if(fromMs){
    var d0=new Date(fromMs);
    if(!isNaN(d0.getTime())){
      return d0.getFullYear()+'-'+
        String(d0.getMonth()+1).padStart(2,'0')+'-'+
        String(d0.getDate()).padStart(2,'0');
    }
  }
  if(ord.createdAt){
    var s1=String(ord.createdAt).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s1)) return s1;
  }
  if(ord.completatoAtISO){
    var s2=String(ord.completatoAtISO).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s2)) return s2;
  }
  return '';
}
window._ordCardDateISO=_ordCardDateISO;

function _ordBelongsInArchivio(o, now){
  if(!o || o.stato !== 'completato' || o.unlocked === true) return false;
  return (now || Date.now()) - _ordCompletatoAtMs(o) > SETTE_GG_MS;
}

function _ordParseItalianDataMs(dataStr){
  var data = String(dataStr || '').trim();
  var m = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return 0;
  var year = m[3].length === 2 ? ('20' + m[3]) : m[3];
  var d = new Date(Number(year), Number(m[2]) - 1, Number(m[1]));
  var t = d.getTime();
  return isNaN(t) ? 0 : t;
}

/** Timestamp completamento per regola archivio 13 giorni (ms). */
function _ordCompletatoAtMs(o){
  if(!o) return 0;
  var candidates = [o.completatoAtISO, o.createdAt, o.dataISO];
  for(var i = 0; i < candidates.length; i++){
    var raw = candidates[i];
    if(!raw) continue;
    var t = new Date(raw).getTime();
    if(!isNaN(t) && t > 0) return t;
  }
  var fromData = _ordParseItalianDataMs(o.data);
  if(fromData) return fromData;
  return Date.now() - _ORD_COMPLETATO_FALLBACK_MS;
}

/**
 * Archivia ordini completati da 13+ giorni (dopo sync Firebase).
 * @returns {number} quanti ordini spostati
 */
function eseguiArchiviazioneAutomatica(){
  if(!Array.isArray(ordini)) return 0;
  var now = Date.now();
  var candidates = [];
  ordini.forEach(function(o){
    if(!o || o.stato !== 'completato') return;
    if(o.unlocked === true) return;
    var compAt = _ordCompletatoAtMs(o);
    if(now - compAt > SETTE_GG_MS){
      if(!o.completatoAtISO || isNaN(new Date(o.completatoAtISO).getTime())){
        o.completatoAtISO = new Date(compAt).toISOString();
      }
      candidates.push(o);
    }
  });
  if(!candidates.length) return 0;

  var prev = getOrdiniArchivio();
  if(!Array.isArray(prev)) prev = [];
  ordiniArchivio = candidates.concat(prev);
  lsSet(ORDK_ARCH, ordiniArchivio);

  var ids = candidates.map(function(o){ return o.id; }).filter(Boolean);
  var archVerify = getOrdiniArchivio();
  var archIdSet = {};
  (archVerify || []).forEach(function(o){ if(o && o.id) archIdSet[o.id] = true; });
  var allInArch = ids.every(function(id){ return archIdSet[id]; });
  if(!allInArch){
    console.warn('[Ordini] archiviazione: verifica archivio locale fallita, annullato');
    return 0;
  }

  var idSet = {};
  ids.forEach(function(id){ idSet[id] = true; });
  ordini = ordini.filter(function(o){ return !o || !idSet[o.id]; });
  lsSet(ORDK, ordini);

  var opts = (typeof _ordSaveOptsForArchive === 'function')
    ? _ordSaveOptsForArchive(ids)
    : (ids.length ? { intentionalDelete: { ids: ids } } : null);

  if(typeof saveOrdini === 'function'){
    saveOrdini(opts || {});
  }
  return candidates.length;
}
window.eseguiArchiviazioneAutomatica = eseguiArchiviazioneAutomatica;

/**
 * Unisce ordini[] e ordiniArchivio[]: ogni id in un solo bucket (attivo vs archivio, soglia 13 gg).
 * @returns {{ attivi: number, archivio: number, changed: boolean }}
 */
function eseguiRiconciliazioneOrdini(){
  if(!Array.isArray(ordini)) ordini = [];
  var arch = _normalizeOrdiniArchivio(getOrdiniArchivio());
  var byId = {};

  function mergeOrder(o){
    if(!o || o.id == null || o.id === '') return;
    var id = String(o.id);
    if(!byId[id] || JSON.stringify(o).length > JSON.stringify(byId[id]).length){
      byId[id] = o;
    }
  }
  ordini.forEach(mergeOrder);
  arch.forEach(mergeOrder);

  var now = Date.now();
  var newActive = [], newArch = [];
  Object.keys(byId).forEach(function(id){
    var o = byId[id];
    if(_ordBelongsInArchivio(o, now)) newArch.push(o);
    else newActive.push(o);
  });

  var changed = JSON.stringify(newActive) !== JSON.stringify(ordini) ||
    JSON.stringify(newArch) !== JSON.stringify(arch);

  ordini = newActive;
  ordiniArchivio = newArch;
  lsSet(ORDK, ordini);
  lsSet(ORDK_ARCH, ordiniArchivio);

  if(typeof updateOrdBadge === 'function') updateOrdBadge();
  if(typeof updateOrdCounter === 'function') updateOrdCounter();

  console.log('[Ordini] Riconciliazione:', newActive.length, 'attivi,', newArch.length, 'archivio');

  if(changed && typeof saveOrdini === 'function'){
    saveOrdini({ reconciliation: true });
  }
  if(changed && typeof showToastGen === 'function'){
    showToastGen('blue', 'Ordini allineati: ' + newActive.length + ' attivi, ' + newArch.length + ' in storico');
  }

  return { attivi: newActive.length, archivio: newArch.length, changed: changed };
}
window.eseguiRiconciliazioneOrdini = eseguiRiconciliazioneOrdini;

/** True se l'ordine è segnato visto (boolean o valori legacy da Firebase/export). */
function _ordVistoCoerceBool(v){
  return v === true || v === 1 || v === 'true' || v === '1';
}
function ordVistoMostraIcona(o){
  return !!(o && _ordVistoCoerceBool(o.visto));
}

// Campo visto (ufficio → telefono): boolean esplicito per ordini legacy senza chiave
(function(){
  if(!Array.isArray(ordini)) return;
  var changed = false;
  ordini.forEach(function(o){
    if(!o || typeof o.visto === 'boolean') return;
    o.visto = _ordVistoCoerceBool(o.visto);
    changed = true;
  });
  if(changed) lsSet(ORDK, ordini);
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

/** True su layout “ufficio”: ≥768px (iPad/finestre affiancate) oppure PC con mouse e finestra non minuscola. */
function ordineUfficioIsWide(){
  try{
    if(window.matchMedia){
      if(window.matchMedia('(min-width: 768px)').matches) return true;
      try{
        if(window.matchMedia('(pointer: fine)').matches && window.matchMedia('(min-width: 480px)').matches) return true;
      }catch(e2){}
    }
  }catch(e){}
  return typeof window.innerWidth === 'number' && window.innerWidth >= 768;
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
    if(!ord || ordVistoMostraIcona(ord)) return;
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
