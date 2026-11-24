#!/usr/bin/env node

/**
 * Diagnostic script to identify build problems
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Audio Normalizer - Build Diagnostics');
console.log('='.repeat(50));

function checkCommand(command, name) {
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${name}: ${result.trim()}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: Not found or error`);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${description}: Found (${stats.size} bytes)`);
    return true;
  } else {
    console.log(`❌ ${description}: Missing`);
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const files = fs.readdirSync(dirPath);
    console.log(`✅ ${description}: Found (${files.length} items)`);
    return true;
  } else {
    console.log(`❌ ${description}: Missing or not a directory`);
    return false;
  }
}

function main() {
  console.log('\n🖥️  System Information:');
  console.log(`   OS: ${os.type()} ${os.release()}`);
  console.log(`   Architecture: ${os.arch()}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   CPU Cores: ${os.cpus().length}`);
  console.log(`   Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`);
  console.log(`   Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB`);

  console.log('\n🔧 Required Tools:');
  const nodeOk = checkCommand('node --version', 'Node.js');
  const npmOk = checkCommand('npm --version', 'npm');
  
  console.log('\n📁 Project Structure:');
  checkFile('package.json', 'package.json');
  checkFile('next.config.js', 'next.config.js');
  checkDirectory('app', 'app directory');
  checkDirectory('components', 'components directory');
  checkDirectory('services', 'services directory');

  console.log('\n🔌 Electron Files:');
  checkDirectory('electron', 'electron directory');
  checkFile('electron/main.js', 'electron/main.js');
  checkFile('electron/preload.js', 'electron/preload.js');
  checkFile('server.js', 'server.js');

  console.log('\n📦 Dependencies:');
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    const electronInstalled = fs.existsSync('node_modules/electron');
    const electronBuilderInstalled = fs.existsSync('node_modules/electron-builder');
    const nextInstalled = fs.existsSync('node_modules/next');
    
    console.log(`   ${electronInstalled ? '✅' : '❌'} Electron: ${electronInstalled ? 'Installed' : 'Missing'}`);
    console.log(`   ${electronBuilderInstalled ? '✅' : '❌'} Electron Builder: ${electronBuilderInstalled ? 'Installed' : 'Missing'}`);
    console.log(`   ${nextInstalled ? '✅' : '❌'} Next.js: ${nextInstalled ? 'Installed' : 'Missing'}`);
  }

  console.log('\n🎯 Build Assets:');
  checkDirectory('assets', 'assets directory');
  checkFile('assets/icon.ico', 'Windows icon');
  checkFile('assets/icon.png', 'Generic icon');

  console.log('\n💾 Disk Space:');
  try {
    const stats = fs.statSync('.');
    console.log(`   Current directory: ${process.cwd()}`);
    
    // Check available space (simplified)
    if (process.platform === 'win32') {
      try {
        const result = execSync('dir /-c', { encoding: 'utf8', stdio: 'pipe' });
        console.log('   Disk space check: Available');
      } catch (e) {
        console.log('   Disk space check: Unable to determine');
      }
    }
  } catch (error) {
    console.log('   Disk space check: Error');
  }

  console.log('\n🔍 Common Issues Check:');
  
  // Check for long path issues on Windows
  if (process.platform === 'win32') {
    const pathLength = process.cwd().length;
    if (pathLength > 200) {
      console.log(`⚠️  Path might be too long (${pathLength} chars). Consider moving to shorter path.`);
    } else {
      console.log(`✅ Path length OK (${pathLength} chars)`);
    }
  }

  // Check for special characters in path
  const hasSpecialChars = /[^\w\-_\.\s\\\/:]/.test(process.cwd());
  if (hasSpecialChars) {
    console.log('⚠️  Path contains special characters. This might cause issues.');
  } else {
    console.log('✅ Path contains only safe characters');
  }

  // Check npm cache
  try {
    const cacheInfo = execSync('npm config get cache', { encoding: 'utf8' }).trim();
    console.log(`✅ npm cache location: ${cacheInfo}`);
  } catch (error) {
    console.log('❌ npm cache: Unable to determine location');
  }

  console.log('\n💡 Recommendations:');
  
  if (!nodeOk) {
    console.log('   • Install Node.js 18+ from https://nodejs.org/');
  }
  
  if (!fs.existsSync('node_modules')) {
    console.log('   • Run: npm install');
  }
  
  if (!fs.existsSync('node_modules/electron')) {
    console.log('   • Run: npm install electron --save-dev');
  }
  
  if (!fs.existsSync('node_modules/electron-builder')) {
    console.log('   • Run: npm install electron-builder --save-dev');
  }

  console.log('   • Try running: npm cache clean --force');
  console.log('   • Try running as Administrator (Windows)');
  console.log('   • Temporarily disable antivirus during build');
  console.log('   • Ensure stable internet connection');

  console.log('\n🚀 Next Steps:');
  console.log('   1. Fix any issues shown above');
  console.log('   2. Run: npm run build:simple');
  console.log('   3. Or run: build-simple.bat');
}

if (require.main === module) {
  main();
}