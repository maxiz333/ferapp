// ordini.carrello-helpers.js - estratto da ordini.js

function cartToggleScampolo(cartId,idx){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx]) return;
  cart.items[idx].scampolo=!cart.items[idx].scampolo; saveCarrelli(); renderCartTabs();
}
function cartMostraNota(notaId, cartId, idx){
  var btn=document.getElementById(notaId+'-btn');
  var inp=document.getElementById(notaId);
  if(!inp) return;
  if(btn) btn.style.display='none';
  inp.style.display='block';
  inp.focus();
}
function cartSetDesc(cartId,idx,val){
  var cart=carrelli.find(function(c){return c.id===cartId;});
  if(!cart||!cart.items[idx]) return;
  cart.items[idx].desc=val.trim()||cart.items[idx].desc;
  saveCarrelli();
}
function cartEditDesc(cartId,idx,el){
  var cur=el.textContent;
  var inp=document.createElement('input');
  inp.type='text'; inp.value=cur;
  inp.style.cssText='width:100%;font-size:12px;font-weight:700;color:var(--text);background:#1a1a1a;border:1px solid var(--accent);border-radius:4px;padding:2px 6px;outline:none;box-sizing:border-box;';
  el.replaceWith(inp);
  inp.focus(); inp.select();  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ inp.blur(); }
    if(e.key==='Escape'){ inp.removeEventListener('blur',commit); renderCartTabs(); }
  });
}
  function commit(){
    cartSetDesc(cartId,idx,inp.value);
    renderCartTabs();
  }
function _showToastUndo(msg, onUndo){
  // Rimuovi toast undo precedente se esiste
  var old=document.getElementById('_toast-undo');
  if(old) old.remove();
  var t=document.createElement('div');
  t.id='_toast-undo';
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#222;border:1px solid #444;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:9000;box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:220px;';
  var txt=document.createElement('span');
  txt.style.cssText='font-size:13px;color:#e0e0e0;flex:1;';
  txt.textContent=msg;
  var btn=document.createElement('button');
  btn.textContent='Annulla';
  btn.style.cssText='padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;';
  btn.onclick=function(){ t.remove(); onUndo(); };
  t.appendChild(txt);
  t.appendChild(btn);
  document.body.appendChild(t);
  // Auto-rimozione dopo 5 secondi
  setTimeout(function(){ if(t.parentNode){ t.remove(); _lastRemovedItem=null; } }, 5000);
}
