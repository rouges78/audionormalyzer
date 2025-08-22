#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Building Audio Normalizer - Final Working Version\n');

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
    console.log('🚀 Starting final build process...\n');
    
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    console.log('✅ Cleanup completed\n');
    
    // Build Next.js app
    if (!runCommand('npm run build', 'Building Next.js application')) {
      process.exit(1);
    }
    
    // Build Electron app
    if (!runCommand('npx electron-builder --win --x64', 'Building Electron executable')) {
      process.exit(1);
    }
    
    console.log('🎉 Build completed successfully!\n');
    
    // Check output files
    console.log('📁 Checking output files:');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    checkFile(exePath, 'Portable executable');
    checkFile(unpackedPath, 'Unpacked executable');
    
    console.log('\n🚀 Audio Normalizer is ready!');
    console.log('\n📋 How to use:');
    console.log('   1. Run: "dist/Audio Normalizer 0.1.0.exe"');
    console.log('   2. The app will start with Electron');
    console.log('   3. It will automatically start the Next.js server');
    console.log('   4. The web interface will load in the Electron window');
    
    console.log('\n🎵 Features available:');
    console.log('   • Peak & Loudness Normalization');
    console.log('   • EBU R128 Compliance');
    console.log('   • Multiple Audio Formats (MP3, WAV, FLAC, etc.)');
    console.log('   • Batch Processing');
    console.log('   • Drag & Drop Interface');
    console.log('   • Real-time Progress Tracking');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();