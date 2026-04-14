// ui.export-csv.js - estratto da ui.js

// ══ EXPORT CATALOGO CSV ══════════════════════════════════════════
// Scarica tutti gli articoli (rows[] + magazzino[]) come CSV con prezzi
function exportCatalogoCSV(){
  if(!rows || !rows.length){
    showToastGen('red','⚠️ Nessun articolo caricato — apri prima l\'inventario');
    return;
  }
  var sep = ';';
  var header = ['Descrizione','Cod.Fornitore','Cod.Magazzino','Prezzo','PrezzoVecchio','Quantita','Unita','Posizione','Marca','Fornitore','Specs','Categoria','Sottocategoria','Size','Giornalino','Note'].join(sep);
  var lines = [header];
  
  for(var i = 0; i < rows.length; i++){
    var r = rows[i] || {};
    var m = (typeof magazzino !== 'undefined' && magazzino[i]) ? magazzino[i] : {};
    var fields = [
      (r.desc || '').replace(/;/g, ','),
      (r.codF || '').replace(/;/g, ','),
      (r.codM || '').replace(/;/g, ','),
      r.prezzo || '',
      r.prezzoOld || '',
      m.qty !== undefined && m.qty !== '' ? m.qty : '',
      m.unit || 'pz',
      (m.posizione || '').replace(/;/g, ','),
      (m.marca || '').replace(/;/g, ','),
      (m.nomeFornitore || '').replace(/;/g, ','),
      (m.specs || '').replace(/;/g, ',').replace(/\n/g, ' '),
      m.cat || '',
      m.subcat || '',
      r.size || 'small',
      r.giornalino || '',
      (r.note || '').replace(/;/g, ',').replace(/\n/g, ' ')
    ];
    lines.push(fields.join(sep));
  }

  var csv = '\uFEFF' + lines.join('\n'); // BOM UTF-8 per Excel
  var blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var oggi = new Date().toISOString().slice(0,10);
  a.download = 'catalogo_rattazzi_' + oggi + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToastGen('green','✅ CSV scaricato — ' + rows.length + ' articoli');
}
