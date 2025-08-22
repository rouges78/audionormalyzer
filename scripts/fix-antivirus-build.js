#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🛡️ Audio Normalizer - Antivirus Build Fix\n');

function runCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

function forceDeleteDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      console.log(`🗑️ Eliminazione forzata: ${dirPath}`);
      
      // Try multiple deletion strategies
      const strategies = [
        () => fs.rmSync(dirPath, { recursive: true, force: true }),
        () => execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'ignore' }),
        () => execSync(`rd /s /q "${dirPath}"`, { stdio: 'ignore' }),
        () => execSync(`powershell -Command "Remove-Item -Path '${dirPath}' -Recurse -Force"`, { stdio: 'ignore' })
      ];
      
      for (const strategy of strategies) {
        try {
          strategy();
          if (!fs.existsSync(dirPath)) {
            console.log(`✅ Directory eliminata con successo`);
            return true;
          }
        } catch (e) {
          // Try next strategy
        }
      }
      
      console.log(`⚠️ Impossibile eliminare completamente ${dirPath}`);
      return false;
    } catch (error) {
      console.log(`⚠️ Errore durante eliminazione: ${error.message}`);
      return false;
    }
  }
  return true;
}

async function main() {
  try {
    console.log('🔧 Risoluzione problema file bloccati dall\'antivirus...\n');
    
    // Step 1: Force close any processes that might lock files
    console.log('🛑 Chiusura processi che potrebbero bloccare file...');
    const processesToKill = ['electron', 'Audio Normalizer'];
    
    processesToKill.forEach(proc => {
      try {
        execSync(`taskkill /f /im "${proc}.exe" 2>nul`, { stdio: 'ignore' });
      } catch (e) {
        // Process not running, which is fine
      }
    });
    
    // Step 2: Wait a moment for antivirus to release files
    console.log('⏳ Attesa rilascio file da parte dell\'antivirus...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Force delete existing dist directory
    console.log('🗑️ Eliminazione forzata directory dist...');
    forceDeleteDirectory('dist');
    
    // Step 4: Clear npm cache
    console.log('🧹 Pulizia cache npm...');
    try {
      execSync('npm cache clean --force', { stdio: 'inherit' });
    } catch (e) {
      console.log('⚠️ Cache npm non pulita, continuando...');
    }
    
    // Step 5: Wait again
    console.log('⏳ Attesa finale prima del build...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Build with specific flags to avoid locks
    console.log('🔨 Avvio build con flags anti-lock...');
    const buildCommand = 'npx electron-builder --win --x64 --publish=never --config.nsis.oneClick=false';
    
    if (!runCommand(buildCommand, 'Building executable con flags anti-lock')) {
      // Try alternative build method
      console.log('🔄 Tentativo con metodo alternativo...');
      if (!runCommand('npx electron-builder --win portable', 'Building portable version')) {
        throw new Error('Entrambi i metodi di build sono falliti');
      }
    }
    
    // Step 7: Verify output
    console.log('✅ Build completato! Verifica file...');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    const checkFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ File creato: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      }
      return false;
    };
    
    const hasPortable = checkFile(exePath);
    const hasUnpacked = checkFile(unpackedPath);
    
    if (!hasPortable && !hasUnpacked) {
      throw new Error('Nessun file eseguibile creato');
    }
    
    console.log('\n🎉 SUCCESS! Audio Normalizer build completato!\n');
    
    console.log('📋 Suggerimenti per evitare problemi futuri:');
    console.log('   1. Aggiungi la cartella del progetto alle esclusioni antivirus');
    console.log('   2. Disabilita temporaneamente la protezione real-time durante build');
    console.log('   3. Esegui sempre come Amministratore');
    console.log('   4. Chiudi tutte le applicazioni non necessarie');
    
    if (hasPortable) {
      console.log(`\n🚀 Per testare: "${exePath}"`);
    }
    
  } catch (error) {
    console.error('\n❌ Build fallito:', error.message);
    console.error('\n🛡️ Soluzioni antivirus:');
    console.error('   1. Disabilita Windows Defender real-time protection');
    console.error('   2. Aggiungi questa cartella alle esclusioni:');
    console.error(`      ${process.cwd()}`);
    console.error('   3. Esegui PowerShell come Amministratore');
    console.error('   4. Prova: Set-MpPreference -DisableRealtimeMonitoring $true');
    console.error('   5. Dopo build: Set-MpPreference -DisableRealtimeMonitoring $false');
    process.exit(1);
  }
}

main();