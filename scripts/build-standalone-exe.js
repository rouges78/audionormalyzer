#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Building Standalone Audio Normalizer Executable\n');

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

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${description}: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return true;
  } else {
    console.log(`❌ ${description} not found: ${filePath}`);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Building standalone executable (no external dependencies)...\n');
    
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    console.log('✅ Cleanup completed\n');
    
    // Build Electron app directly (no Next.js build needed)
    if (!runCommand('npx electron-builder --win --x64', 'Building standalone Electron executable')) {
      process.exit(1);
    }
    
    console.log('🎉 Standalone build completed successfully!\n');
    
    // Check output files
    console.log('📁 Checking output files:');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    checkFile(exePath, 'Standalone executable');
    checkFile(unpackedPath, 'Unpacked executable');
    
    console.log('\n🚀 Standalone Audio Normalizer is ready!');
    console.log('\n📋 How to use:');
    console.log('   1. Run: "dist/Audio Normalizer 0.1.0.exe"');
    console.log('   2. The app will start immediately (no server needed)');
    console.log('   3. Built-in interface with drag & drop support');
    console.log('   4. No external dependencies required');
    
    console.log('\n🎵 Features in this version:');
    console.log('   • Embedded user interface');
    console.log('   • File selection and drag & drop');
    console.log('   • Normalization settings');
    console.log('   • Progress tracking (demo)');
    console.log('   • No Node.js or server dependencies');
    
    console.log('\n⚠️  Note: This is a standalone demo version.');
    console.log('   For full audio processing, integrate with the Next.js backend.');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();