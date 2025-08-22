#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Building Audio Normalizer Desktop App - Professional Edition\n');

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

function ensureDirectories() {
  const dirs = ['dist', 'build'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

async function main() {
  try {
    console.log('🚀 Starting professional desktop app build...\n');
    
    // Ensure required directories exist
    ensureDirectories();
    
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    console.log('✅ Cleanup completed\n');
    
    // Build Next.js app for production
    if (!runCommand('npm run build', 'Building Next.js production app')) {
      process.exit(1);
    }
    
    // Build Electron desktop app
    if (!runCommand('npx electron-builder --win --x64', 'Building Electron desktop app')) {
      process.exit(1);
    }
    
    console.log('🎉 Desktop app build completed successfully!\n');
    
    // Check output files
    console.log('📁 Checking output files:');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    checkFile(exePath, 'Desktop app installer');
    checkFile(unpackedPath, 'Desktop app executable');
    
    console.log('\n🚀 Audio Normalizer Desktop App is ready!');
    console.log('\n📋 How to use:');
    console.log('   1. Run: "dist/Audio Normalizer 0.1.0.exe"');
    console.log('   2. The app will start Electron with embedded Next.js server');
    console.log('   3. Full audio processing capabilities included');
    console.log('   4. Professional-grade normalization with FFmpeg');
    
    console.log('\n🎵 Professional features included:');
    console.log('   • Real audio processing with FFmpeg');
    console.log('   • Peak & Loudness normalization (EBU R128)');
    console.log('   • Multiple format support (MP3, WAV, FLAC, etc.)');
    console.log('   • Batch processing for albums');
    console.log('   • Professional analysis and reporting');
    console.log('   • Desktop integration with native UI');
    
    console.log('\n⚠️  Requirements:');
    console.log('   • Windows x64');
    console.log('   • No additional software needed (all bundled)');
    console.log('   • Minimum 4GB RAM recommended');
    console.log('   • 500MB free disk space');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();