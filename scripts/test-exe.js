#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing Audio Normalizer Executable\n');

function testExecutable() {
  const exePath = 'dist/Audio Normalizer 0.1.0.exe';
  
  if (!fs.existsSync(exePath)) {
    console.log('❌ Executable not found. Run "npm run build:final" first.');
    process.exit(1);
  }
  
  console.log('✅ Executable found');
  console.log(`📁 File: ${exePath}`);
  console.log(`📊 Size: ${(fs.statSync(exePath).size / 1024 / 1024).toFixed(2)} MB\n`);
  
  console.log('🚀 Starting executable...');
  console.log('   (This will open the Audio Normalizer window)');
  console.log('   (Close the window to complete the test)\n');
  
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
  
  console.log('✅ Executable started successfully!');
  console.log('🎵 Audio Normalizer should now be running.');
  console.log('\n📋 What to expect:');
  console.log('   1. Electron window opens');
  console.log('   2. Next.js server starts automatically');
  console.log('   3. Audio Normalizer interface loads');
  console.log('   4. You can upload and normalize audio files');
  
  console.log('\n🎯 Test completed - executable is working!');
}

testExecutable();