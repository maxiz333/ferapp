# Estrae ordini.js in moduli usando solo marker testuali (nessun numero di riga).
# I marker nel sorgente .ps1 sono ASCII-only; il testo di ordini.js e letto come UTF-8.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcPath = Join-Path $root 'ordini.js'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($srcPath, $utf8)

function Get-Slice {
  param(
    [string]$StartMarker,
    [string]$EndMarker,
    [int]$SearchEndFrom = -1
  )
  $i = $text.IndexOf($StartMarker)
  if ($i -lt 0) { throw "Marker inizio non trovato: $StartMarker" }
  if ($null -eq $EndMarker -or $EndMarker -eq '') {
    return $text.Substring($i)
  }
  $from = if ($SearchEndFrom -ge 0) { $SearchEndFrom } else { $i }
  $j = $text.IndexOf($EndMarker, $from)
  if ($j -lt 0) { throw "Marker fine non trovato: $EndMarker (da pos $from)" }
  return $text.Substring($i, $j - $i)
}

function Get-Slice-ToIndex {
  param([int]$StartIndex, [int]$EndIndexExclusive)
  if ($StartIndex -lt 0 -or $EndIndexExclusive -lt $StartIndex) { throw 'Indici slice non validi' }
  return $text.Substring($StartIndex, $EndIndexExclusive - $StartIndex)
}

function Line-Start {
  param([int]$PosInLine)
  if ($PosInLine -le 0) { return 0 }
  $n = $text.LastIndexOf("`n", $PosInLine - 1)
  return $n + 1
}

function Write-Mod {
  param([string]$Name, [string]$Content)
  $p = Join-Path $root $Name
  $hdr = "// $Name - estratto da ordini.js`n`n"
  [System.IO.File]::WriteAllText($p, $hdr + $Content.TrimEnd() + "`n", $utf8)
}

# --- sync-carrello: dall'inizio fino al tab modifica ---
$iMod = $text.IndexOf('// --- MODIFICA ORDINE DAL TAB ORDINI')
if ($iMod -lt 0) { throw 'Marker MODIFICA ORDINE non trovato' }
$syncCarrello = $text.Substring(0, $iMod)
Write-Mod -Name 'ordini.sync-carrello.js' -Content $syncCarrello
Write-Host "OK ordini.sync-carrello.js len=$($syncCarrello.Length)"

# --- edit-tab, inline-del (marker ASCII) ---
$body = Get-Slice -StartMarker '// --- MODIFICA ORDINE DAL TAB ORDINI' -EndMarker '// --- INLINE EDIT ORDINI (doppio click su cella) ----------------'
Write-Mod -Name 'ordini.edit-tab.js' -Content $body
Write-Host "OK ordini.edit-tab.js len=$($body.Length)"

$body = Get-Slice -StartMarker '// --- INLINE EDIT ORDINI (doppio click su cella) ----------------' -EndMarker 'function filterOrdini(f){'
Write-Mod -Name 'ordini.inline-del.js' -Content $body
Write-Host "OK ordini.inline-del.js len=$($body.Length)"

# --- filter-stato ---
$body = Get-Slice -StartMarker 'function filterOrdini(f){' -EndMarker 'function _syncPrezziOrdineAlDB(ord){'
Write-Mod -Name 'ordini.filter-stato.js' -Content $body
Write-Host "OK ordini.filter-stato.js len=$($body.Length)"

# --- sync-db (include commenti sopra _syncPrezzi...) ---
$iSyncFn = $text.IndexOf('function _syncPrezziOrdineAlDB(ord){')
if ($iSyncFn -lt 0) { throw 'function _syncPrezziOrdineAlDB non trovata' }
$iSyncBlock = $text.IndexOf('Sync ordine completato')
if ($iSyncBlock -lt 0) { throw 'Anchor Sync ordine completato non trovato' }
$syncDbStart = (Line-Start -PosInLine $iSyncBlock)
$iOrdCest = $text.IndexOf('var ORDK_CESTINO = window.AppKeys.ORDINI_CESTINO;')
if ($iOrdCest -lt 0) { throw 'ORDK_CESTINO non trovato' }
$syncDb = Get-Slice-ToIndex -StartIndex $syncDbStart -EndIndexExclusive $iOrdCest
Write-Mod -Name 'ordini.sync-db.js' -Content $syncDb
Write-Host "OK ordini.sync-db.js len=$($syncDb.Length)"

# --- cestino, storico, da-ordinare ---
$body = Get-Slice -StartMarker 'var ORDK_CESTINO = window.AppKeys.ORDINI_CESTINO;' -EndMarker '// --- STORICO ORDINI ARCHIVIATI ---'
Write-Mod -Name 'ordini.cestino.js' -Content $body
Write-Host "OK ordini.cestino.js len=$($body.Length)"

$iDaAnchor = $text.IndexOf('daOrdinare da carrelli + ordini')
if ($iDaAnchor -lt 0) { throw 'Anchor da-ordinare non trovato' }
$iDaOrdBlockStart = (Line-Start -PosInLine $iDaAnchor)

$iStorico = $text.IndexOf('// --- STORICO ORDINI ARCHIVIATI ---')
if ($iStorico -lt 0) { throw 'STORICO ORDINI non trovato' }
$storico = Get-Slice-ToIndex -StartIndex $iStorico -EndIndexExclusive $iDaOrdBlockStart
Write-Mod -Name 'ordini.storico.js' -Content $storico
Write-Host "OK ordini.storico.js len=$($storico.Length)"

$iSectionOrd = $text.IndexOf('// [SECTION: ORDINI] --------------------------------------------------------')
if ($iSectionOrd -lt 0) { throw 'SECTION ORDINI non trovato' }
$daOrdinare = Get-Slice-ToIndex -StartIndex $iDaOrdBlockStart -EndIndexExclusive $iSectionOrd
Write-Mod -Name 'ordini.da-ordinare.js' -Content $daOrdinare
Write-Host "OK ordini.da-ordinare.js len=$($daOrdinare.Length)"

# --- render, poll, calendario, cassa, correlati ---
$body = Get-Slice -StartMarker '// [SECTION: ORDINI] --------------------------------------------------------' -EndMarker '// --- AUTO-REFRESH ORDINI (polling localStorage ogni 5s) -------'
Write-Mod -Name 'ordini.render-list.js' -Content $body
Write-Host "OK ordini.render-list.js len=$($body.Length)"

$body = Get-Slice -StartMarker '// --- AUTO-REFRESH ORDINI (polling localStorage ogni 5s) -------' -EndMarker '// --- CALENDARIO STORICO ORDINI ---'
Write-Mod -Name 'ordini.poll-counter.js' -Content $body
Write-Host "OK ordini.poll-counter.js len=$($body.Length)"

$body = Get-Slice -StartMarker '// --- CALENDARIO STORICO ORDINI ---' -EndMarker '// --- VISTA CASSA (fullscreen per tablet/schermo cassa) -------'
Write-Mod -Name 'ordini.calendario.js' -Content $body
Write-Host "OK ordini.calendario.js len=$($body.Length)"

$body = Get-Slice -StartMarker '// --- VISTA CASSA (fullscreen per tablet/schermo cassa) -------' -EndMarker '// --- PRODOTTI CORRELATI PER ORDINE ----------------------------'
Write-Mod -Name 'ordini.cassa.js' -Content $body
Write-Host "OK ordini.cassa.js len=$($body.Length)"

$body = Get-Slice -StartMarker '// --- PRODOTTI CORRELATI PER ORDINE ----------------------------' -EndMarker '// --- NOTA ARTICOLO (edit con prompt) --------------------------'
Write-Mod -Name 'ordini.correlati.js' -Content $body
Write-Host "OK ordini.correlati.js len=$($body.Length)"

# --- NOTA + DDT ---
$pNota = $text.IndexOf('// --- NOTA ARTICOLO (edit con prompt) --------------------------')
if ($pNota -lt 0) { throw 'Marker NOTA ARTICOLO non trovato' }
$dHdr = $text.IndexOf('// ---------------------------------------------------------------', $pNota + 1)
if ($dHdr -lt 0) { throw 'Header DDT (---) non trovato dopo NOTA' }
$pOrdDet = $text.IndexOf('// --- Ord Detail (dal file principale) ---', $dHdr)
if ($pOrdDet -lt 0) { throw 'Marker Ord Detail non trovato dopo DDT' }

$notaBody = $text.Substring($pNota, $dHdr - $pNota)
$ddtBody = $text.Substring($dHdr, $pOrdDet - $dHdr)
Write-Mod -Name 'ordini.nota-cart.js' -Content $notaBody
Write-Mod -Name 'ordini.ddt.js' -Content $ddtBody
Write-Host "OK ordini.nota-cart.js len=$($notaBody.Length)"
Write-Host "OK ordini.ddt.js len=$($ddtBody.Length)"

# --- Ord Detail ... cartToggle ... ordSetNuovo ... openOrdDetail ... openEditProdotto ---
$body = Get-Slice -StartMarker '// --- Ord Detail (dal file principale) ---' -EndMarker 'function cartToggleScampolo(cartId,idx){'
Write-Mod -Name 'ordini.bozza-lock-ui.js' -Content $body
Write-Host "OK ordini.bozza-lock-ui.js len=$($body.Length)"

$body = Get-Slice -StartMarker 'function cartToggleScampolo(cartId,idx){' -EndMarker 'function ordSetNuovo(gi){'
Write-Mod -Name 'ordini.carrello-helpers.js' -Content $body
Write-Host "OK ordini.carrello-helpers.js len=$($body.Length)"

$body = Get-Slice -StartMarker 'function ordSetNuovo(gi){' -EndMarker 'function openOrdDetail(gi){'
Write-Mod -Name 'ordini.stato-carrello-link.js' -Content $body
Write-Host "OK ordini.stato-carrello-link.js len=$($body.Length)"

$body = Get-Slice -StartMarker 'function openOrdDetail(gi){' -EndMarker 'function openEditProdotto(i, isNew){'
Write-Mod -Name 'ordini.dettaglio-overlay.js' -Content $body
Write-Host "OK ordini.dettaglio-overlay.js len=$($body.Length)"

# --- edit-prodotto fino al blocco lock (escluso) ---
$iOpenEp = $text.IndexOf('function openEditProdotto(i, isNew){')
$iOrdForce = $text.IndexOf('function ordForceLock(ordId, gi){')
if ($iOpenEp -lt 0 -or $iOrdForce -lt 0) { throw 'openEditProdotto / ordForceLock non trovati' }
$iLockBlockStart = (Line-Start -PosInLine $iOrdForce)
$editProdotto = Get-Slice-ToIndex -StartIndex $iOpenEp -EndIndexExclusive $iLockBlockStart
Write-Mod -Name 'ordini.edit-prodotto.js' -Content $editProdotto
Write-Host "OK ordini.edit-prodotto.js len=$($editProdotto.Length)"

# --- lock + dbltap fino a ordToggleScampolo (escluso) ---
$iOrdTog = $text.IndexOf('function ordToggleScampolo(gi, ii){')
if ($iOrdTog -lt 0) { throw 'ordToggleScampolo non trovato' }
$lockDbl = Get-Slice-ToIndex -StartIndex $iLockBlockStart -EndIndexExclusive $iOrdTog
Write-Mod -Name 'ordini.lock-dbltap.js' -Content $lockDbl
Write-Host "OK ordini.lock-dbltap.js len=$($lockDbl.Length)"

# --- righe (scampolo/rotolo/nota ...) fino a openSchedaRapida (escluso) ---
$iOpenScheda = $text.IndexOf('function openSchedaRapida(rowIdx){')
if ($iOpenScheda -lt 0) { throw 'openSchedaRapida non trovato' }
$iRigheStart = (Line-Start -PosInLine $iOrdTog)
$righe = Get-Slice-ToIndex -StartIndex $iRigheStart -EndIndexExclusive $iOpenScheda
Write-Mod -Name 'ordini.righe-ordine.js' -Content $righe
Write-Host "OK ordini.righe-ordine.js len=$($righe.Length)"

# --- scheda rapida + cliente fino a Stampa/WhatsApp ---
$iSchedaHdr = $text.IndexOf('SCHEDA RAPIDA PRODOTTO')
if ($iSchedaHdr -lt 0) { throw 'SCHEDA RAPIDA PRODOTTO non trovato' }
$iSchedaBlockStart = (Line-Start -PosInLine $iSchedaHdr)
$iStampaFn = $text.IndexOf('function ordStampaDblTap(btn, gi){')
if ($iStampaFn -lt 0) { throw 'ordStampaDblTap non trovato' }
$iStampaBlockStart = (Line-Start -PosInLine $iStampaFn)
$scheda = Get-Slice-ToIndex -StartIndex $iSchedaBlockStart -EndIndexExclusive $iStampaBlockStart
Write-Mod -Name 'ordini.scheda-cliente.js' -Content $scheda
Write-Host "OK ordini.scheda-cliente.js len=$($scheda.Length)"

# --- stampa / WA fino a scaglione (escluso) ---
$iScaglFn = $text.IndexOf('function ordSetScaglioneQta(gi, ii, val){')
if ($iScaglFn -lt 0) { throw 'ordSetScaglioneQta non trovato' }
$iScaglBlockStart = (Line-Start -PosInLine $iScaglFn)
$stampa = Get-Slice-ToIndex -StartIndex $iStampaBlockStart -EndIndexExclusive $iScaglBlockStart
Write-Mod -Name 'ordini.stampa-wa.js' -Content $stampa
Write-Host "OK ordini.stampa-wa.js len=$($stampa.Length)"

# --- scaglione fino agli override (escluso) ---
$iOverride = $text.IndexOf('Override avvisaUfficio:')
if ($iOverride -lt 0) { throw 'Override avvisaUfficio non trovato' }
$iOverrideStart = (Line-Start -PosInLine $iOverride)
$scaglione = Get-Slice-ToIndex -StartIndex $iScaglBlockStart -EndIndexExclusive $iOverrideStart
Write-Mod -Name 'ordini.scaglione.js' -Content $scaglione
Write-Host "OK ordini.scaglione.js len=$($scaglione.Length)"

# --- hooks + resto file ---
$hooks = $text.Substring($iOverrideStart)
Write-Mod -Name 'ordini.hooks-popup.js' -Content $hooks
Write-Host "OK ordini.hooks-popup.js len=$($hooks.Length)"

Write-Host 'Split completato.'
