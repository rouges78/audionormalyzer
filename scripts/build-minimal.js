#!/usr/bin/env node

/**
 * Script minimo per creare l'eseguibile che funziona
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 Audio Normalizer - Minimal Working Build');
console.log('='.repeat(50));

function runCommand(command, description, ignoreError = false) {
  console.log(`\n📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    if (ignoreError) {
      console.log(`⚠️  ${description} had issues but continuing...`);
      return true;
    }
    console.error(`❌ ${description} failed`);
    return false;
  }
}

function createMinimalPackageConfig() {
  console.log('📦 Creating minimal package configuration...');
  
  const packagePath = 'package.json';
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Set main to the working simple version
  packageJson.main = 'electron/main-simple.js';
  
  // Minimal build config
  packageJson.build = {
    appId: 'com.audionormalizer.app',
    productName: 'Audio Normalizer',
    directories: { output: 'dist' },
    files: [
      'electron/main-simple.js',
      'package.json',
      'node_modules/**/*'
    ],
    win: {
      target: 'portable'  // Portable version, no installer
    }
  };
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json for minimal build');
}

function main() {
  console.log('🚀 Creating minimal working executable...');
  
  // Step 1: Clean up
  console.log('\n🧹 Cleaning up...');
  try {
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
  } catch (e) {
    console.log('⚠️  Could not clean dist folder');
  }
  
  // Step 2: Configure package
  createMinimalPackageConfig();
  
  // Step 3: Install electron if needed
  if (!fs.existsSync('node_modules/electron')) {
    if (!runCommand('npm install electron --save-dev', 'Installing Electron')) {
      console.log('❌ Failed to install Electron');
      process.exit(1);
    }
  }
  
  // Step 4: Install electron-builder if needed
  if (!fs.existsSync('node_modules/electron-builder')) {
    if (!runCommand('npm install electron-builder --save-dev', 'Installing Electron Builder')) {
      console.log('❌ Failed to install Electron Builder');
      process.exit(1);
    }
  }
  
  // Step 5: Build minimal version
  console.log('\n🔨 Building minimal Electron app...');
  if (!runCommand('npx electron-builder --win --x64', 'Building Electron')) {
    console.log('❌ Build failed');
    process.exit(1);
  }
  
  console.log('\n🎉 Minimal build completed!');
  console.log('📁 Check dist/ folder for your executable');
  
  // List files
  if (fs.existsSync('dist')) {
    const files = fs.readdirSync('dist');
    console.log('\n📋 Generated files:');
    files.forEach(file => {
      console.log(`   • ${file}`);
    });
  }
  
  console.log('\n💡 This version includes:');
  console.log('   ✅ Working Electron app');
  console.log('   ✅ Basic interface');
  console.log('   ✅ No dependency issues');
  console.log('   ⚠️  Simplified UI (not the full Next.js interface)');
  
  console.log('\n🔄 To get the full UI working:');
  console.log('   1. First make sure this minimal version works');
  console.log('   2. Then we can gradually add the Next.js components');
}

if (require.main === module) {
  main();
}