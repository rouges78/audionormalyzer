#!/usr/bin/env node

/**
 * Simplified script to create the Windows executable
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Audio Normalizer - Simple Build');
console.log('='.repeat(40));

function runCommand(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  console.log(`Node.js version: ${version}`);
  
  if (major < 18) {
    console.error('❌ Node.js 18+ required. Please update Node.js');
    return false;
  }
  
  return true;
}

function createMinimalElectronConfig() {
  const electronMain = `
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let serverProcess

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })

  // Start Next.js server
  serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: '3001' }
  })

  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3001')
    mainWindow.show()
  }, 3000)

  mainWindow.on('closed', () => {
    if (serverProcess) serverProcess.kill()
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
`;

  fs.writeFileSync('electron/legacy/main-simple.js', electronMain);
  console.log('✅ Created simplified Electron main file');
}

async function main() {
  console.log('🔍 Checking prerequisites...');
  
  if (!checkNodeVersion()) {
    process.exit(1);
  }

  // Step 1: Install only essential dependencies
  console.log('\n📦 Installing essential dependencies...');
  const essentialDeps = [
    'electron@latest',
    'electron-builder@latest'
  ].join(' ');

  if (!runCommand(`npm install --save-dev ${essentialDeps}`, 'Installing Electron')) {
    console.log('\n🔄 Trying alternative installation...');
    if (!runCommand('npm install electron electron-builder --save-dev --legacy-peer-deps', 'Alternative install')) {
      console.error('❌ Failed to install Electron. Please check your internet connection.');
      process.exit(1);
    }
  }

  // Step 2: Create simplified config
  createMinimalElectronConfig();

  // Step 3: Update package.json with minimal config
  const packagePath = 'package.json';
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  packageJson.main = 'electron/legacy/main-simple.js';
  packageJson.scripts = {
    ...packageJson.scripts,
    'build:simple': 'npm run build && electron-builder --win --x64'
  };

  if (!packageJson.build) {
    packageJson.build = {
      appId: 'com.audionormalizer.app',
      productName: 'Audio Normalizer',
      directories: { output: 'dist' },
      files: ['out/**/*', 'electron/**/*', 'server.js', 'package.json', 'node_modules/**/*'],
      win: {
        target: 'nsis',
        icon: 'assets/icon.ico'
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true
      }
    };
  }

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');

  // Step 4: Build Next.js
  if (!runCommand('npm run build', 'Building Next.js app')) {
    console.error('❌ Next.js build failed. Please check for errors above.');
    process.exit(1);
  }

  // Step 5: Build Electron
  console.log('\n🔨 Building Electron executable...');
  if (!runCommand('npm run build:simple', 'Building Electron app')) {
    console.log('\n🔄 Trying alternative build...');
    if (!runCommand('npx electron-builder --win --x64', 'Alternative Electron build')) {
      console.error('❌ Electron build failed.');
      process.exit(1);
    }
  }

  console.log('\n🎉 Build completed successfully!');
  console.log('📁 Check the dist/ folder for your executable');
  
  // List output files
  const distPath = 'dist';
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log('\n📋 Generated files:');
    files.forEach(file => {
      console.log(`   • ${file}`);
    });
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Build failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure you have Node.js 18+ installed');
    console.log('2. Try running: npm cache clean --force');
    console.log('3. Delete node_modules and run: npm install');
    console.log('4. Check your internet connection');
    process.exit(1);
  });
}