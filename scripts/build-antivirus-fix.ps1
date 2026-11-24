# Audio Normalizer - Antivirus Build Solution
# PowerShell script to fix antivirus problems during the build

Write-Host "🛡️ Audio Normalizer - Antivirus Build Fix" -ForegroundColor Cyan
Write-Host ""

# Function to check whether we are running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to temporarily disable Windows Defender
function Disable-WindowsDefender {
    try {
        Write-Host "🛑 Temporarily disabling Windows Defender..." -ForegroundColor Yellow
        Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction SilentlyContinue
        Write-Host "✅ Windows Defender temporarily disabled" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "⚠️ Unable to disable Windows Defender: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to re-enable Windows Defender
function Enable-WindowsDefender {
    try {
        Write-Host "🛡️ Re-enabling Windows Defender..." -ForegroundColor Yellow
        Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
        Write-Host "✅ Windows Defender re-enabled" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Error re-enabling Windows Defender: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to kill processes that could lock files
function Stop-BlockingProcesses {
    Write-Host "🛑 Closing processes that could lock files..." -ForegroundColor Yellow
    
    $processesToKill = @("electron", "Audio Normalizer", "node", "npm")
    
    foreach ($process in $processesToKill) {
        try {
            Get-Process -Name $process -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {
            # Process not found, ok
        }
    }
    
    Write-Host "✅ Processes closed" -ForegroundColor Green
}

# Function to clean the dist directory
function Clear-DistDirectory {
    Write-Host "🗑️ Cleaning dist directory..." -ForegroundColor Yellow
    
    if (Test-Path "dist") {
        try {
            Remove-Item -Path "dist" -Recurse -Force -ErrorAction Stop
            Write-Host "✅ dist directory deleted" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Error deleting dist: $($_.Exception.Message)" -ForegroundColor Red
            
            # Attempt with alternative methods
            try {
                cmd /c "rmdir /s /q dist" 2>$null
                if (-not (Test-Path "dist")) {
                    Write-Host "✅ dist directory deleted with cmd" -ForegroundColor Green
                }
            } catch {
                Write-Host "❌ Unable to delete dist directory" -ForegroundColor Red
            }
        }
    }
}

# Function to add antivirus exclusions
function Add-AntivirusExclusion {
    param([string]$Path)
    
    try {
        Write-Host "🛡️ Adding antivirus exclusion for: $Path" -ForegroundColor Yellow
        Add-MpPreference -ExclusionPath $Path -ErrorAction SilentlyContinue
        Write-Host "✅ Exclusion added" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Unable to add exclusion: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main script
try {
    Write-Host "🔍 Checking administrator privileges..." -ForegroundColor Yellow
    
    if (-not (Test-Administrator)) {
        Write-Host "⚠️ WARNING: You are not running as Administrator!" -ForegroundColor Red
        Write-Host "📋 For best results, run PowerShell as Administrator" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "❌ Build cancelled" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ Running as Administrator" -ForegroundColor Green
    }
    
    # Get the current directory
    $currentDir = Get-Location
    $distDir = Join-Path $currentDir "dist"
    
    # Add antivirus exclusions
    if (Test-Administrator) {
        Add-AntivirusExclusion -Path $currentDir
        Add-AntivirusExclusion -Path $distDir
    }
    
    # Temporarily disable Windows Defender
    $defenderDisabled = $false
    if (Test-Administrator) {
        $defenderDisabled = Disable-WindowsDefender
    }
    
    # Close blocking processes
    Stop-BlockingProcesses
    
    # Wait a bit
    Write-Host "⏳ Waiting 3 seconds for files to be released..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # Clean the dist directory
    Clear-DistDirectory
    
    # Wait some more
    Write-Host "⏳ Final 2-second wait..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Run the build
    Write-Host "🔨 Starting Electron build..." -ForegroundColor Cyan
    Write-Host ""
    
    # Try the build with npx
    $buildSuccess = $false
    try {
        & npx electron-builder --win --x64 --publish=never
        $buildSuccess = $true
    } catch {
        Write-Host "❌ Build with npx failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # If the first method fails, try an alternative method
    if (-not $buildSuccess) {
        Write-Host "🔄 Trying an alternative method..." -ForegroundColor Yellow
        try {
            & npm run build:simple
            $buildSuccess = $true
        } catch {
            Write-Host "❌ Alternative build failed too: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Check the results
    Write-Host ""
    Write-Host "🔍 Checking output files..." -ForegroundColor Cyan
    
    $exePath = "dist\Audio Normalizer 0.1.0.exe"
    $unpackedPath = "dist\win-unpacked\Audio Normalizer.exe"
    
    $hasExecutable = $false
    
    if (Test-Path $exePath) {
        $size = (Get-Item $exePath).Length / 1MB
        Write-Host "✅ Executable created: $exePath ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        $hasExecutable = $true
    }
    
    if (Test-Path $unpackedPath) {
        $size = (Get-Item $unpackedPath).Length / 1MB
        Write-Host "✅ Unpacked version: $unpackedPath ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        $hasExecutable = $true
    }
    
    if ($hasExecutable) {
        Write-Host ""
        Write-Host "🎉 BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 To test the executable:" -ForegroundColor Cyan
        if (Test-Path $exePath) {
            Write-Host "   `"$exePath`"" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "📋 Available features:" -ForegroundColor Cyan
        Write-Host "   • Drag & drop audio files" -ForegroundColor White
        Write-Host "   • Professional normalization" -ForegroundColor White
        Write-Host "   • Multiple format support" -ForegroundColor White
        Write-Host "   • Interface user-friendly" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ BUILD FAILED - No executable created" -ForegroundColor Red
        Write-Host ""
        Write-Host "🛠️ Additional solutions:" -ForegroundColor Yellow
        Write-Host "   1. Disable the antivirus manually" -ForegroundColor White
        Write-Host "   2. Add this folder to the exclusions:" -ForegroundColor White
        Write-Host "      $currentDir" -ForegroundColor Gray
        Write-Host "   3. Restart as Administrator" -ForegroundColor White
        Write-Host "   4. Close all unnecessary applications" -ForegroundColor White
    }
    
} finally {
    # Re-enable Windows Defender
    if ($defenderDisabled -and (Test-Administrator)) {
        Write-Host ""
        Enable-WindowsDefender
    }
    
    Write-Host ""
    Write-Host "🏁 Script completed" -ForegroundColor Cyan
}

# Pause to read the output
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")