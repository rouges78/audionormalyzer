#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Audio Normalizer Executable Issues\n');

async function testExecutable() {
  const exePath = path.join(process.cwd(), 'dist', 'Audio Normalizer 0.1.0.exe');
  
  console.log('📁 Checking executable file...');
  if (!fs.existsSync(exePath)) {
    console.log('❌ Executable not found:', exePath);
    return false;
  }
  
  const stats = fs.statSync(exePath);
  console.log(`✅ Executable found: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
  
  console.log('🚀 Attempting to start executable...');
  console.log('   (Will capture stdout/stderr for 10 seconds)');
  
  const child = spawn(exePath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });
  
  let hasError = false;
  let hasOutput = false;
  
  child.stdout.on('data', (data) => {
    hasOutput = true;
    console.log('📤 STDOUT:', data.toString().trim());
  });
  
  child.stderr.on('data', (data) => {
    hasError = true;
    console.log('❌ STDERR:', data.toString().trim());
  });
  
  child.on('error', (error) => {
    hasError = true;
    console.log('❌ Process Error:', error.message);
  });
  
  child.on('close', (code) => {
    console.log(`🔚 Process exited with code: ${code}`);
  });
  
  // Wait 10 seconds then kill if still running
  setTimeout(() => {
    if (!child.killed) {
      console.log('\n⏰ 10 seconds elapsed, stopping test...');
      child.kill('SIGTERM');
      
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 2000);
    }
    
    console.log('\n📋 Test Results:');
    console.log(`   Output detected: ${hasOutput}`);
    console.log(`   Errors detected: ${hasError}`);
    
    if (!hasOutput && !hasError) {
      console.log('   Status: Executable may be running silently (normal for GUI apps)');
    } else if (hasError) {
      console.log('   Status: Errors detected - check output above');
    } else {
      console.log('   Status: Normal operation detected');
    }
    
    process.exit(0);
  }, 10000);
}

testExecutable().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});