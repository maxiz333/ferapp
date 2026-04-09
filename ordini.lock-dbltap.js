// ordini.lock-dbltap.js - estratto da ordini.js

function ordForceLock(ordId, gi){
  var ord = ordini[gi];
  if(!ord || ord.id !== ordId){
    ord = ordini.find(function(x){ return x && x.id === ordId; });
  }
  if(!ord){
    console.error('[LOCK] ordForceLock — ordine non trovato:', ordId);
    return;
  }

  var key = _lockKey(ordId);
  var currentLock = _ordLocks[key];
  var holderName = currentLock ? (currentLock.name || 'altro account') : 'altro account';

  ordAcquireOrderLock(ordId, { force: true }, function(ok){
    if(!ok){
      showToastGen('red','❌ Impossibile aggiornare il lock su Firebase');
      return;
    }

    var o = ordini.find(function(x){ return x && x.id === ordId; });
    if(o){
      var chi = (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.nome : 'Sconosciuto';
      var ora = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      if(!o.modificheDiff) o.modificheDiff = [];
      o.modificheDiff.unshift('⚠️ ' + ora + ' — Lock forzato da ' + chi + ' (era: ' + holderName + ')');
      o.modificato = true;
      o.modificatoAt = new Date().toLocaleString('it-IT');
      o.modificatoAtISO = new Date().toISOString();
      saveOrdini();
    }

    showToastGen('orange','🔓 Lock forzato — ora lavori tu');
    if(typeof ordRefreshLockUI === 'function') ordRefreshLockUI();
    else renderOrdini();
  });
}

// ── DOPPIO TAP UNIVERSALE ORDINI (Safari iOS compatibile) ────────
// Tap multipli: doppio tap per edit normale, TRIPLO tap per forzare lock
var _ordDblTapTimer = null;
var _ordDblTapEl = null;
var _ordDblTapKey = null;
var _ordDblTapCount = 0;

function ordDblTap(el, action, arg1, arg2){
  while(el && !el.getAttribute('onclick') && el.parentElement){
    el = el.parentElement;
  }
  var key = action + '_' + arg1 + '_' + arg2;
  if(_ordDblTapKey === key){
    _ordDblTapCount++;
    clearTimeout(_ordDblTapTimer);
    if(action === 'force'){
      // Per il lock overlay: serve TRIPLO tap
      if(_ordDblTapCount >= 3){
        _ordDblTapKey = null; _ordDblTapCount = 0;
        if(_ordDblTapEl){ _ordDblTapEl.style.outline=''; _ordDblTapEl.style.outlineOffset=''; }
        _ordDblTapEl = null;
        ordForceLock(arg1, arg2);
        return;
      }
      // Secondo tap: mostra feedback "ancora un tap"
      if(_ordDblTapEl){
        _ordDblTapEl.style.outline='2px solid #e53e3e';
        _ordDblTapEl.querySelector&&(_ordDblTapEl.querySelector('.ord-lock-msg')
          && (_ordDblTapEl.querySelector('.ord-lock-msg').style.opacity='0.5'));
      }
    } else {
      // Per edit normale: doppio tap
      _ordDblTapKey = null; _ordDblTapCount = 0;
      if(_ordDblTapEl){ _ordDblTapEl.style.outline=''; _ordDblTapEl.style.outlineOffset=''; }
      _ordDblTapEl = null;
      ordInlineEdit(el, arg1, arg2, action);
      return;
    }
  } else {
    if(_ordDblTapTimer) clearTimeout(_ordDblTapTimer);
    if(_ordDblTapEl){ _ordDblTapEl.style.outline=''; _ordDblTapEl.style.outlineOffset=''; }
    _ordDblTapKey = key;
    _ordDblTapEl = el;
    _ordDblTapCount = 1;
    el.style.outline = '2px solid var(--accent)';
    el.style.outlineOffset = '-2px';
  }
  _ordDblTapTimer = setTimeout(function(){
    if(_ordDblTapEl){ _ordDblTapEl.style.outline=''; _ordDblTapEl.style.outlineOffset=''; }
    _ordDblTapKey = null;
    _ordDblTapEl = null;
    _ordDblTapCount = 0;
  }, 600);
}

// ── SCAMPOLO/ROTOLO/NOTA negli ordini ────────────────────────────
