// ordini.filter-settimana.js — filtro giornaliero Lun–Sab (settimana corrente / scorso)

var _ordWeekdayFilter = null;   // 1=Lun … 6=Sab, null = filtro disattivo
var _ordWeekdayScorso = false;  // false=settimana corrente, true=precedente
var _ordWeekdayDropdown = null; // quale giorno ha il menu aperto

var _ORD_WDAY_LABELS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
var _ordWdayLongPressTimer = null;
var _ordWdayLongPressFired = false;

function _ordTodayWeekdayIdx(){
  var jsDay = new Date().getDay();
  return jsDay === 0 ? null : jsDay;
}

function _ordGetFilterDateISO(ord){
  if(!ord) return '';
  var stato = ord.stato === 'lavorazione' ? 'nuovo' : ord.stato;
  if(stato === 'completato' && typeof _ordCardDateISO === 'function'){
    return _ordCardDateISO(ord);
  }
  if(typeof _getOrdDataISO === 'function') return _getOrdDataISO(ord);
  if(ord.dataISO) return String(ord.dataISO).slice(0, 10);
  if(ord.createdAt) return String(ord.createdAt).slice(0, 10);
  return '';
}

function _ordWeekdayTargetISO(weekdayIdx, scorso){
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var jsDay = today.getDay();
  var currentWeekday = jsDay === 0 ? 7 : jsDay;
  var diff = weekdayIdx - currentWeekday;
  if(scorso) diff -= 7;
  var target = new Date(today);
  target.setDate(target.getDate() + diff);
  var y = target.getFullYear();
  var m = String(target.getMonth() + 1).padStart(2, '0');
  var d = String(target.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function _ordOrderMatchesWeekdayFilter(ord){
  if(_ordWeekdayFilter == null) return true;
  var ordDate = _ordGetFilterDateISO(ord);
  if(!ordDate) return false;
  return ordDate === _ordWeekdayTargetISO(_ordWeekdayFilter, _ordWeekdayScorso);
}

function _ordDateFromISO(iso){
  if(!iso) return null;
  var p = String(iso).slice(0, 10).split('-');
  if(p.length < 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
}

/** 1=Lun … 6=Sab; null se domenica o data assente. */
function _ordOrderWeekdayIdx(ord){
  var d = _ordDateFromISO(_ordGetFilterDateISO(ord));
  if(!d) return null;
  var jsDay = d.getDay();
  return jsDay === 0 ? null : jsDay;
}

function _ordOrderWeekdayLabel(ord){
  var idx = _ordOrderWeekdayIdx(ord);
  return idx != null ? (_ORD_WDAY_LABELS[idx] || '') : '';
}

function _ordOrderIsMonSat(ord){
  return _ordOrderWeekdayIdx(ord) != null;
}

function _ordOrderDateGroupLabel(ord){
  var d = _ordDateFromISO(_ordGetFilterDateISO(ord));
  if(!d) return ord.data || '—';
  var oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  var ieri = new Date(oggi);
  ieri.setDate(ieri.getDate() - 1);
  var dD = new Date(d);
  dD.setHours(0, 0, 0, 0);
  if(dD.getTime() === oggi.getTime()) return 'OGGI';
  if(dD.getTime() === ieri.getTime()) return 'IERI';
  return d.toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'}).toUpperCase();
}

function _ordCloseWeekdayDropdown(){
  _ordWeekdayDropdown = null;
  var dd = document.getElementById('ord-wday-dropdown');
  if(!dd) return;
  dd.style.display = 'none';
  dd.classList.remove('ord-wday-dropdown--open');
}

function _ordOpenWeekdayDropdown(weekday){
  _ordWeekdayDropdown = weekday;
  var dd = document.getElementById('ord-wday-dropdown');
  var btn = document.getElementById('ord-wday-' + weekday);
  if(!dd || !btn) return;
  var label = _ORD_WDAY_LABELS[weekday] || 'Scorso';
  var pickBtn = dd.querySelector('.ord-wday-dropdown-pick');
  if(pickBtn) pickBtn.textContent = label + ' Scorso';
  var btnRect = btn.getBoundingClientRect();
  dd.style.display = 'block';
  dd.classList.add('ord-wday-dropdown--open');
  dd.style.position = 'fixed';
  dd.style.left = Math.round(btnRect.left) + 'px';
  dd.style.top = Math.round(btnRect.bottom + 4) + 'px';
  dd.style.zIndex = '10050';
}

function ordPickWeekdayScorso(weekday){
  if(weekday == null) weekday = _ordWeekdayFilter;
  if(weekday == null) return;
  _ordWeekdayFilter = weekday;
  _ordWeekdayScorso = true;
  _ordCloseWeekdayDropdown();
  ordUpdateWeekdayButtonsUI();
  if(typeof ordCloseSpecialViews==='function')ordCloseSpecialViews();
  if(typeof renderOrdini === 'function') renderOrdini();
}

function ordClearWeekdayFilter(){
  _ordWeekdayFilter = null;
  _ordWeekdayScorso = false;
  _ordCloseWeekdayDropdown();
  ordUpdateWeekdayButtonsUI();
  if(typeof ordCloseSpecialViews==='function')ordCloseSpecialViews();
  if(typeof renderOrdini === 'function') renderOrdini();
}

function ordClickWeekday(weekday, ev){
  if(ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if(_ordWdayLongPressFired){
    _ordWdayLongPressFired = false;
    return;
  }

  if(_ordWeekdayFilter !== weekday){
    _ordWeekdayFilter = weekday;
    _ordWeekdayScorso = false;
    _ordCloseWeekdayDropdown();
    ordUpdateWeekdayButtonsUI();
    if(typeof ordCloseSpecialViews==='function')ordCloseSpecialViews();
    if(typeof renderOrdini === 'function') renderOrdini();
    return;
  }

  if(_ordWeekdayScorso){
    _ordWeekdayScorso = false;
    _ordCloseWeekdayDropdown();
    ordUpdateWeekdayButtonsUI();
    if(typeof ordCloseSpecialViews==='function')ordCloseSpecialViews();
    if(typeof renderOrdini === 'function') renderOrdini();
    return;
  }

  var dd = document.getElementById('ord-wday-dropdown');
  var ddOpen = dd && (dd.style.display === 'block' || dd.classList.contains('ord-wday-dropdown--open'));
  if(_ordWeekdayDropdown === weekday && ddOpen){
    _ordCloseWeekdayDropdown();
    return;
  }

  _ordOpenWeekdayDropdown(weekday);
}

function ordUpdateWeekdayButtonsUI(){
  var todayIdx = _ordTodayWeekdayIdx();
  for(var i = 1; i <= 6; i++){
    var btn = document.getElementById('ord-wday-' + i);
    if(!btn) continue;
    btn.classList.toggle('ord-wday-today', todayIdx === i);
    btn.classList.toggle('ord-wday-active', _ordWeekdayFilter === i);
    btn.classList.toggle('ord-wday-scorso', _ordWeekdayFilter === i && _ordWeekdayScorso);
  }
}

function _ordWdayStartLongPress(weekday, ev){
  if(_ordWeekdayFilter !== weekday) return;
  _ordWdayLongPressFired = false;
  clearTimeout(_ordWdayLongPressTimer);
  _ordWdayLongPressTimer = setTimeout(function(){
    _ordWdayLongPressFired = true;
    ordClearWeekdayFilter();
  }, 600);
}

function _ordWdayCancelLongPress(){
  clearTimeout(_ordWdayLongPressTimer);
}

function _ordWdayOnDocClick(ev){
  var dd = document.getElementById('ord-wday-dropdown');
  if(!dd || dd.style.display === 'none') return;
  if(dd.contains(ev.target)) return;
  if(_ordWeekdayDropdown){
    var activeBtn = document.getElementById('ord-wday-' + _ordWeekdayDropdown);
    if(activeBtn && activeBtn.contains(ev.target)) return;
  }
  _ordCloseWeekdayDropdown();
}

function ordInitWeekdayFilter(){
  _ordWeekdayFilter = null;
  _ordWeekdayScorso = false;
  ordUpdateWeekdayButtonsUI();

  for(var i = 1; i <= 6; i++){
    (function(wd){
      var btn = document.getElementById('ord-wday-' + wd);
      if(!btn) return;
      btn.addEventListener('mousedown', function(e){ _ordWdayStartLongPress(wd, e); });
      btn.addEventListener('mouseup', _ordWdayCancelLongPress);
      btn.addEventListener('mouseleave', _ordWdayCancelLongPress);
      btn.addEventListener('touchstart', function(e){ _ordWdayStartLongPress(wd, e); }, {passive:true});
      btn.addEventListener('touchend', _ordWdayCancelLongPress);
      btn.addEventListener('touchcancel', _ordWdayCancelLongPress);
    })(i);
  }

  document.addEventListener('click', _ordWdayOnDocClick, true);
  if(typeof renderOrdini === 'function') renderOrdini();
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ordInitWeekdayFilter);
  } else {
    ordInitWeekdayFilter();
  }
}
