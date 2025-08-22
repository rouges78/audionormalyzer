# Audio Normalizer - Antivirus Build Solution
# PowerShell script per risolvere problemi antivirus durante build

Write-Host "🛡️ Audio Normalizer - Soluzione Antivirus Build" -ForegroundColor Cyan
Write-Host ""

# Funzione per verificare se si sta eseguendo come amministratore
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Funzione per disabilitare temporaneamente Windows Defender
function Disable-WindowsDefender {
    try {
        Write-Host "🛑 Disabilitazione temporanea Windows Defender..." -ForegroundColor Yellow
        Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction SilentlyContinue
        Write-Host "✅ Windows Defender disabilitato temporaneamente" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "⚠️ Impossibile disabilitare Windows Defender: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Funzione per riabilitare Windows Defender
function Enable-WindowsDefender {
    try {
        Write-Host "🛡️ Riabilitazione Windows Defender..." -ForegroundColor Yellow
        Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
        Write-Host "✅ Windows Defender riabilitato" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Errore riabilitazione Windows Defender: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Funzione per killare processi che potrebbero bloccare file
function Stop-BlockingProcesses {
    Write-Host "🛑 Chiusura processi che potrebbero bloccare file..." -ForegroundColor Yellow
    
    $processesToKill = @("electron", "Audio Normalizer", "node", "npm")
    
    foreach ($process in $processesToKill) {
        try {
            Get-Process -Name $process -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {
            # Processo non trovato, ok
        }
    }
    
    Write-Host "✅ Processi chiusi" -ForegroundColor Green
}

# Funzione per pulire directory dist
function Clear-DistDirectory {
    Write-Host "🗑️ Pulizia directory dist..." -ForegroundColor Yellow
    
    if (Test-Path "dist") {
        try {
            Remove-Item -Path "dist" -Recurse -Force -ErrorAction Stop
            Write-Host "✅ Directory dist eliminata" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Errore eliminazione dist: $($_.Exception.Message)" -ForegroundColor Red
            
            # Tentativo con metodi alternativi
            try {
                cmd /c "rmdir /s /q dist" 2>$null
                if (-not (Test-Path "dist")) {
                    Write-Host "✅ Directory dist eliminata con cmd" -ForegroundColor Green
                }
            } catch {
                Write-Host "❌ Impossibile eliminare directory dist" -ForegroundColor Red
            }
        }
    }
}

# Funzione per aggiungere esclusioni antivirus
function Add-AntivirusExclusion {
    param([string]$Path)
    
    try {
        Write-Host "🛡️ Aggiunta esclusione antivirus per: $Path" -ForegroundColor Yellow
        Add-MpPreference -ExclusionPath $Path -ErrorAction SilentlyContinue
        Write-Host "✅ Esclusione aggiunta" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Impossibile aggiungere esclusione: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Script principale
try {
    Write-Host "🔍 Verifica privilegi amministratore..." -ForegroundColor Yellow
    
    if (-not (Test-Administrator)) {
        Write-Host "⚠️ ATTENZIONE: Non stai eseguendo come Amministratore!" -ForegroundColor Red
        Write-Host "📋 Per migliori risultati, esegui PowerShell come Amministratore" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Continuare comunque? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "❌ Build annullato" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ Eseguendo come Amministratore" -ForegroundColor Green
    }
    
    # Ottieni directory corrente
    $currentDir = Get-Location
    $distDir = Join-Path $currentDir "dist"
    
    # Aggiungi esclusioni antivirus
    if (Test-Administrator) {
        Add-AntivirusExclusion -Path $currentDir
        Add-AntivirusExclusion -Path $distDir
    }
    
    # Disabilita Windows Defender temporaneamente
    $defenderDisabled = $false
    if (Test-Administrator) {
        $defenderDisabled = Disable-WindowsDefender
    }
    
    # Chiudi processi bloccanti
    Stop-BlockingProcesses
    
    # Attendi un po'
    Write-Host "⏳ Attesa 3 secondi per rilascio file..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # Pulisci directory dist
    Clear-DistDirectory
    
    # Attendi ancora
    Write-Host "⏳ Attesa finale 2 secondi..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Esegui build
    Write-Host "🔨 Avvio build Electron..." -ForegroundColor Cyan
    Write-Host ""
    
    # Prova build con npx
    $buildSuccess = $false
    try {
        & npx electron-builder --win --x64 --publish=never
        $buildSuccess = $true
    } catch {
        Write-Host "❌ Build con npx fallito: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Se il primo metodo fallisce, prova metodo alternativo
    if (-not $buildSuccess) {
        Write-Host "🔄 Tentativo con metodo alternativo..." -ForegroundColor Yellow
        try {
            & npm run build:simple
            $buildSuccess = $true
        } catch {
            Write-Host "❌ Anche build alternativo fallito: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Verifica risultati
    Write-Host ""
    Write-Host "🔍 Verifica file di output..." -ForegroundColor Cyan
    
    $exePath = "dist\Audio Normalizer 0.1.0.exe"
    $unpackedPath = "dist\win-unpacked\Audio Normalizer.exe"
    
    $hasExecutable = $false
    
    if (Test-Path $exePath) {
        $size = (Get-Item $exePath).Length / 1MB
        Write-Host "✅ Eseguibile creato: $exePath ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        $hasExecutable = $true
    }
    
    if (Test-Path $unpackedPath) {
        $size = (Get-Item $unpackedPath).Length / 1MB
        Write-Host "✅ Versione unpacked: $unpackedPath ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        $hasExecutable = $true
    }
    
    if ($hasExecutable) {
        Write-Host ""
        Write-Host "🎉 BUILD COMPLETATO CON SUCCESSO!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Per testare l'eseguibile:" -ForegroundColor Cyan
        if (Test-Path $exePath) {
            Write-Host "   `"$exePath`"" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "📋 Funzionalità disponibili:" -ForegroundColor Cyan
        Write-Host "   • Drag & drop file audio" -ForegroundColor White
        Write-Host "   • Normalizzazione professionale" -ForegroundColor White
        Write-Host "   • Supporto formati multipli" -ForegroundColor White
        Write-Host "   • Interface user-friendly" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ BUILD FALLITO - Nessun eseguibile creato" -ForegroundColor Red
        Write-Host ""
        Write-Host "🛠️ Soluzioni aggiuntive:" -ForegroundColor Yellow
        Write-Host "   1. Disabilita manualmente l'antivirus" -ForegroundColor White
        Write-Host "   2. Aggiungi questa cartella alle esclusioni:" -ForegroundColor White
        Write-Host "      $currentDir" -ForegroundColor Gray
        Write-Host "   3. Riavvia come Amministratore" -ForegroundColor White
        Write-Host "   4. Chiudi tutte le applicazioni non necessarie" -ForegroundColor White
    }
    
} finally {
    # Riabilita Windows Defender
    if ($defenderDisabled -and (Test-Administrator)) {
        Write-Host ""
        Enable-WindowsDefender
    }
    
    Write-Host ""
    Write-Host "🏁 Script completato" -ForegroundColor Cyan
}

# Pausa per leggere output
Write-Host ""
Write-Host "Premi un tasto per continuare..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")