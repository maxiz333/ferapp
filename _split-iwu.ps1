# Estrae inventario.js, movimenti.js, ui.js in moduli (UTF-8 senza BOM).
# Intervalli di riga: 1-based inclusivi.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Read-Lines([string]$path) {
  [System.IO.File]::ReadAllLines($path, $utf8)
}

function Write-Mod([string]$name, [string]$sourceMonolith, [string]$content) {
  $p = Join-Path $root $name
  $hdr = "// $name - estratto da $sourceMonolith`n`n"
  [System.IO.File]::WriteAllText($p, $hdr + $content.TrimEnd() + "`n", $utf8)
}

function Slice-Lines($lines, [int]$from, [int]$to) {
  ($lines[($from - 1)..($to - 1)] -join "`n")
}

# --- inventario.js ---
$invPath = Join-Path $root 'inventario.js'
$inv = Read-Lines $invPath
Write-Mod 'inventario.search.js' 'inventario.js' (Slice-Lines $inv 1 243)
Write-Mod 'inventario.magazzino.js' 'inventario.js' (Slice-Lines $inv 245 469)
Write-Host 'OK inventario.search.js, inventario.magazzino.js'

# --- movimenti.js ---
$movPath = Join-Path $root 'movimenti.js'
$mov = Read-Lines $movPath
Write-Mod 'movimenti.core.js' 'movimenti.js' (Slice-Lines $mov 1 439)
Write-Mod 'movimenti.backup.js' 'movimenti.js' (Slice-Lines $mov 441 583)
Write-Mod 'movimenti.scheda.js' 'movimenti.js' (Slice-Lines $mov 585 719)
Write-Mod 'movimenti.ricerca.js' 'movimenti.js' (Slice-Lines $mov 721 1029)
Write-Host 'OK movimenti.*.js'

# --- ui.js: foto + var _fotoBase64 (prima era in coda a movimenti.js) ---
$uiPath = Join-Path $root 'ui.js'
$ui = Read-Lines $uiPath
$fotoTop = Slice-Lines $ui 1 2
$fotoRest = Slice-Lines $ui 3 153
$fotoBody = $fotoTop + "`n" + 'var _fotoBase64 = null;' + "`n" + $fotoRest
Write-Mod 'ui.foto.js' 'ui.js' $fotoBody
Write-Mod 'ui.core.js' 'ui.js' (Slice-Lines $ui 155 658)
Write-Mod 'ui.export-csv.js' 'ui.js' (Slice-Lines $ui 660 707)
Write-Host 'OK ui.foto.js, ui.core.js, ui.export-csv.js'

Write-Host 'Split inventario / movimenti / ui completato.'
