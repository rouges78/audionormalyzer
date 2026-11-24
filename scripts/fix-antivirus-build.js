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
      console.log(`🗑️ Forced deletion: ${dirPath}`);
      
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
            console.log(`✅ Directory deleted successfully`);
            return true;
          }
        } catch (e) {
          // Try next strategy
        }
      }
      
      console.log(`⚠️ Unable to fully delete ${dirPath}`);
      return false;
    } catch (error) {
      console.log(`⚠️ Error during deletion: ${error.message}`);
      return false;
    }
  }
  return true;
}

async function main() {
  try {
    console.log('🔧 Fixing files locked by the antivirus...\n');
    
    // Step 1: Force close any processes that might lock files
    console.log('🛑 Closing processes that could lock files...');
    const processesToKill = ['electron', 'Audio Normalizer'];
    
    processesToKill.forEach(proc => {
      try {
        execSync(`taskkill /f /im "${proc}.exe" 2>nul`, { stdio: 'ignore' });
      } catch (e) {
        // Process not running, which is fine
      }
    });
    
    // Step 2: Wait a moment for antivirus to release files
    console.log('⏳ Waiting for the antivirus to release files...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Force delete existing dist directory
    console.log('🗑️ Forced deletion of the dist directory...');
    forceDeleteDirectory('dist');
    
    // Step 4: Clear npm cache
    console.log('🧹 Cleaning npm cache...');
    try {
      execSync('npm cache clean --force', { stdio: 'inherit' });
    } catch (e) {
      console.log('⚠️ npm cache not cleaned, continuing...');
    }
    
    // Step 5: Wait again
    console.log('⏳ Final wait before the build...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Build with specific flags to avoid locks
    console.log('🔨 Starting build with anti-lock flags...');
    const buildCommand = 'npx electron-builder --win --x64 --publish=never --config.nsis.oneClick=false';
    
    if (!runCommand(buildCommand, 'Building executable with anti-lock flags')) {
      // Try alternative build method
      console.log('🔄 Trying an alternative method...');
      if (!runCommand('npx electron-builder --win portable', 'Building portable version')) {
        throw new Error('Both build methods failed');
      }
    }
    
    // Step 7: Verify output
    console.log('✅ Build completed! Checking files...');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    const checkFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ File created: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      }
      return false;
    };
    
    const hasPortable = checkFile(exePath);
    const hasUnpacked = checkFile(unpackedPath);
    
    if (!hasPortable && !hasUnpacked) {
      throw new Error('No executable file created');
    }
    
    console.log('\n🎉 SUCCESS! Audio Normalizer build completed!\n');
    
    console.log('📋 Tips to avoid future problems:');
    console.log('   1. Add the project folder to the antivirus exclusions');
    console.log('   2. Temporarily disable real-time protection during the build');
    console.log('   3. Always run as Administrator');
    console.log('   4. Close all unnecessary applications');
    
    if (hasPortable) {
      console.log(`\n🚀 To test: "${exePath}"`);
    }
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    console.error('\n🛡️ Antivirus solutions:');
    console.error('   1. Disable Windows Defender real-time protection');
    console.error('   2. Add this folder to the exclusions:');
    console.error(`      ${process.cwd()}`);
    console.error('   3. Run PowerShell as Administrator');
    console.error('   4. Try: Set-MpPreference -DisableRealtimeMonitoring $true');
    console.error('   5. After the build: Set-MpPreference -DisableRealtimeMonitoring $false');
    process.exit(1);
  }
}

main();