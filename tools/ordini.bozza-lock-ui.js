// ordini.bozza-lock-ui.js - estratto da ordini.js

// --- Ord Detail (dal file principale) ---
var _ordDetailId=null;function ordSblocca(gi){
  var o=ordini[gi];
  if(o){o.unlocked=true; saveOrdini(); renderOrdini();}
}
function ordBlocca(gi){
  var o=ordini[gi];
  if(o){o.unlocked=false; saveOrdini(); renderOrdini();}
}
function ordSbloccaFatto(gi){ ordSblocca(gi); }
function ordRibloccaFatto(gi){ ordBlocca(gi); }
      function renderItemsEditabili(){
        var existing=wrap.querySelector('.items-edit-list');
        if(existing) existing.remove();
        var list=document.createElement('div');
        list.className='items-edit-list';
        list.style.cssText='margin-bottom:12px;';

        (cart.items||[]).forEach(function(it, ii){
          var card=document.createElement('div');
          card.style.cssText='background:#111;border:1px solid #2d2040;border-radius:10px;padding:10px;margin-bottom:8px;';

          // Riga 1: descrizione + X rimuovi
          var r1=document.createElement('div');
          r1.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
          var desc=document.createElement('div');
          desc.style.cssText='flex:1;min-width:0;';
          var descTxt=document.createElement('div');
          descTxt.style.cssText='font-size:13px;font-weight:700;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          descTxt.textContent=it.desc||'';
          desc.appendChild(descTxt);
          if(it.codM||it.codF){
            var codRow=document.createElement('div');
            codRow.style.cssText='margin-top:2px;display:flex;gap:6px;';
            if(it.codM){ var sm=document.createElement('span'); sm.style.cssText='color:var(--accent);font-size:10px;font-weight:700;'; sm.textContent=it.codM; codRow.appendChild(sm); }
            if(it.codF){ var sf=document.createElement('span'); sf.style.cssText='color:#fc8181;font-size:10px;font-weight:700;'; sf.textContent=it.codF; codRow.appendChild(sf); }
            desc.appendChild(codRow);
          }
          var btnX=document.createElement('button');
          btnX.style.cssText='width:28px;height:28px;border-radius:6px;border:1px solid #e53e3e44;background:transparent;color:#e53e3e;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
          btnX.textContent='-';
          btnX.addEventListener('click',function(){
            (cart.items||[]).splice(ii,1);
            saveCarrelli();
            renderItemsEditabili();
          });
          r1.appendChild(desc);
          r1.appendChild(btnX);
          card.appendChild(r1);

          // Riga 2: Qt- + Unit- + Prezzo
          var r2=document.createElement('div');
          r2.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:6px;';

          var lQty=document.createElement('label');
          lQty.style.cssText='font-size:10px;color:#666;display:flex;flex-direction:column;gap:2px;';
          lQty.textContent='Qt-';
          var inQty=document.createElement('input');
          inQty.type='number'; inQty.min='0.01'; inQty.step='any';
          inQty.value=it.qty||1;
          inQty.style.cssText='width:60px;padding:5px 7px;border:1px solid #6b46c1;border-radius:6px;background:#1a1a2e;color:#fff;font-size:13px;font-weight:700;';
          inQty.addEventListener('input',function(){ it.qty=this.value; saveCarrelli(); });
          lQty.appendChild(inQty);

          var lUnit=document.createElement('label');
          lUnit.style.cssText='font-size:10px;color:#666;display:flex;flex-direction:column;gap:2px;';
          lUnit.textContent='Unit-';
          var inUnit=document.createElement('input');
          inUnit.type='text';
          inUnit.value=it.unit||'pz';
          inUnit.style.cssText='width:48px;padding:5px 7px;border:1px solid #333;border-radius:6px;background:#111;color:#aaa;font-size:12px;';
          inUnit.addEventListener('input',function(){ it.unit=this.value; saveCarrelli(); });
          lUnit.appendChild(inUnit);

          var lPrez=document.createElement('label');
          lPrez.style.cssText='font-size:10px;color:#666;display:flex;flex-direction:column;gap:2px;flex:1;';
          lPrez.textContent='- Prezzo';
          var inPrez=document.createElement('input');
          inPrez.type='text';
          inPrez.value=it.prezzoUnit||'0';
          inPrez.style.cssText='width:100%;padding:5px 7px;border:1px solid #333;border-radius:6px;background:#111;color:var(--accent);font-size:13px;font-weight:700;';
          inPrez.addEventListener('input',function(){ it.prezzoUnit=this.value; saveCarrelli(); });
          lPrez.appendChild(inPrez);

          r2.appendChild(lQty);
          r2.appendChild(lUnit);
          r2.appendChild(lPrez);
          card.appendChild(r2);

          // Riga 3: nota articolo
          var inNota=document.createElement('input');
          inNota.type='text';
          inNota.placeholder='Nota articolo (opzionale)...';
          inNota.value=it.nota||'';
          inNota.style.cssText='width:100%;padding:5px 9px;border:1px solid #222;border-radius:6px;background:#0d0d0d;color:#888;font-size:11px;box-sizing:border-box;margin-bottom:8px;';
          inNota.addEventListener('input',function(){ it.nota=this.value; saveCarrelli(); });
          card.appendChild(inNota);

          // Riga 4: toggle Scampolo + Scaglionati
          (function(item, cartId, itemIdx){
            var rBadge=document.createElement('div');
            rBadge.style.cssText='display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;';

            // Bottone Scampolo
            var btnSc=document.createElement('button');
            var isSc=item.scampolo||false;
            btnSc.style.cssText='padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid '+(isSc?'var(--accent)':'#444')+';background:'+(isSc?'rgba(245,196,0,0.15)':'transparent')+';color:'+(isSc?'var(--accent)':'#666')+';';
            btnSc.textContent='-- Scampolo';
            btnSc.addEventListener('click',function(){
              item.scampolo=!item.scampolo; saveCarrelli(); renderItemsEditabili();
            });
            rBadge.appendChild(btnSc);

            // Bottone Scaglionati
            var btnHs=document.createElement('button');
            var isHs=item.hasScaglioni||false;
            btnHs.style.cssText='padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid '+(isHs?'#3182ce':'#444')+';background:'+(isHs?'rgba(49,130,206,0.15)':'transparent')+';color:'+(isHs?'#63b3ed':'#666')+';';
            btnHs.textContent='- Scaglionati';
            btnHs.addEventListener('click',function(){
              item.hasScaglioni=!item.hasScaglioni;
              saveCarrelli(); renderItemsEditabili();
            });
            rBadge.appendChild(btnHs);
            card.appendChild(rBadge);

            // Form scaglioni (visibile se hasScaglioni)
            if(item.hasScaglioni){
              if(!item.scaglioni) item.scaglioni=[];
              var scagBox=document.createElement('div');
              scagBox.style.cssText='background:#0d1420;border:1px solid #3182ce44;border-radius:8px;padding:8px;margin-bottom:6px;';
              var scagTitle=document.createElement('div');
              scagTitle.style.cssText='font-size:10px;color:#63b3ed;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;';
              scagTitle.textContent='- Prezzi a scaglioni';
              scagBox.appendChild(scagTitle);

              // Intestazione colonne
              var header=document.createElement('div');
              header.style.cssText='display:flex;gap:6px;margin-bottom:4px;';
              ['Da qt-','Sconto %','Prezzo -',''].forEach(function(lbl){
                var th=document.createElement('div');
                th.style.cssText='font-size:9px;color:#555;text-transform:uppercase;flex:'+(lbl===''?'0 0 24px':'1')+';';
                th.textContent=lbl;
                header.appendChild(th);
              });
              scagBox.appendChild(header);

              // Righe scaglioni
              item.scaglioni.forEach(function(sg, si){
                var row=document.createElement('div');
                row.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:4px;';

                var inQta=document.createElement('input');
                inQta.type='number'; inQta.min='1'; inQta.placeholder='qt-';
                inQta.value=sg.qtaMin||'';
                inQta.style.cssText='flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:#e8e8e8;font-size:12px;font-weight:700;min-width:0;';
                inQta.addEventListener('input',function(){ sg.qtaMin=parseFloat(this.value)||0; saveCarrelli(); });

                var inSconto=document.createElement('input');
                inSconto.type='number'; inSconto.min='0'; inSconto.max='100'; inSconto.placeholder='%';
                inSconto.value=sg.sconto||'';
                inSconto.style.cssText='flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:#68d391;font-size:12px;font-weight:700;min-width:0;';
                inSconto.addEventListener('input',function(){
                  sg.sconto=parseFloat(this.value)||0;
                  // Calcola prezzo automatico
                  var base= parsePriceIT(item.prezzoUnit);
                  if(base>0 && sg.sconto>0){
                    sg.prezzo=(base*(1-sg.sconto/100)).toFixed(2);
                    var inP=row.querySelector('.scag-prezzo');
                    if(inP) inP.value=sg.prezzo;
                  }
                  saveCarrelli();
                });

                var inPrezzo=document.createElement('input');
                inPrezzo.type='text'; inPrezzo.placeholder='-';
                inPrezzo.value=sg.prezzo||'';
                inPrezzo.className='scag-prezzo';
                inPrezzo.style.cssText='flex:1;padding:4px 6px;border:1px solid #2a3a4a;border-radius:5px;background:#111;color:var(--accent);font-size:12px;font-weight:700;min-width:0;';
                inPrezzo.addEventListener('input',function(){
                  sg.prezzo=this.value;
                  // Calcola sconto automatico
                  var base= parsePriceIT(item.prezzoUnit);
                  var pr=parseFloat(this.value.replace(',','.'));
                  if(base>0 && pr>0){
                    sg.sconto=((1-pr/base)*100).toFixed(1);
                    var inS=row.querySelector('input[max="100"]');
                    if(inS) inS.value=sg.sconto;
                  }
                  saveCarrelli();
                });

                var btnRm=document.createElement('button');
                btnRm.style.cssText='width:24px;height:24px;border-radius:4px;border:none;background:#e53e3e22;color:#e53e3e;font-size:14px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
                btnRm.textContent='-';
                (function(sIdx){ btnRm.addEventListener('click',function(){
                  item.scaglioni.splice(sIdx,1); saveCarrelli(); renderItemsEditabili();
                }); })(si);

                row.appendChild(inQta);
                row.appendChild(inSconto);
                row.appendChild(inPrezzo);
                row.appendChild(btnRm);
                scagBox.appendChild(row);
              });

              // Aggiungi scaglione
              var btnAddSg=document.createElement('button');
              btnAddSg.style.cssText='width:100%;padding:5px;border-radius:6px;border:1px dashed #3182ce44;background:transparent;color:#3182ce;font-size:11px;font-weight:700;cursor:pointer;margin-top:2px;';
              btnAddSg.textContent='+ Aggiungi scaglione';
              btnAddSg.addEventListener('click',function(){
                if(!item.scaglioni) item.scaglioni=[];
                item.scaglioni.push({qtaMin:1,sconto:0,prezzo:''});
                saveCarrelli(); renderItemsEditabili();
              });
              scagBox.appendChild(btnAddSg);
              card.appendChild(scagBox);
            }
          })(it, cart.id, ii);

          list.appendChild(card);
        });

        // Bottone + aggiungi articolo
        var btnAdd=document.createElement('button');
        btnAdd.style.cssText='width:100%;padding:9px;border-radius:8px;border:1px dashed #6b46c1;background:transparent;color:#a78bfa;font-size:12px;font-weight:700;cursor:pointer;';
        btnAdd.textContent='+ Aggiungi articolo';
        btnAdd.addEventListener('click',function(){
          // Mostra ricerca
          var sr=wrap.querySelector('.search-add-wrap');
          if(sr){ sr.style.display=sr.style.display==='none'?'block':'none'; }
        });
        list.appendChild(btnAdd);

        // Nota ordine
        var lNota=document.createElement('div');
        lNota.style.cssText='margin-top:8px;';
        lNota.innerHTML='<label style="font-size:10px;color:#666;">Nota ordine</label>';
        var inNotaOrd=document.createElement('input');
        inNotaOrd.type='text';
        inNotaOrd.placeholder='Nota generale ordine...';
        inNotaOrd.value=cart.nota||'';
        inNotaOrd.style.cssText='width:100%;padding:7px 10px;border:1px solid #333;border-radius:7px;background:#111;color:#aaa;font-size:12px;box-sizing:border-box;margin-top:3px;';
        inNotaOrd.addEventListener('input',function(){ cart.nota=this.value; saveCarrelli(); });
        lNota.appendChild(inNotaOrd);
        list.appendChild(lNota);

        wrap.insertBefore(list, wrap.querySelector('.search-add-wrap') || wrap.querySelector('.btns-modifica'));
      }
