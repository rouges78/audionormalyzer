#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building working Audio Normalizer executable...\n');

function runCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function ensureDirectories() {
  const dirs = ['dist', 'build', 'public'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

function createIcon() {
  const iconPath = path.join('public', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    console.log('🎨 Creating default icon...');
    // Create a simple text-based icon placeholder
    const iconContent = `This would be an icon file. For a real app, place a proper .ico file here.`;
    fs.writeFileSync(iconPath, iconContent);
    console.log('✅ Icon placeholder created\n');
  }
}

async function main() {
  try {
    console.log('🚀 Starting build process...\n');
    
    // Ensure required directories exist
    ensureDirectories();
    
    // Create icon if it doesn't exist
    createIcon();
    
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
    }
    console.log('✅ Cleanup completed\n');
    
    // Build Next.js app
    runCommand('npm run build', 'Building Next.js application');
    
    // Build Electron app
    runCommand('npx electron-builder --win --x64', 'Building Electron executable');
    
    console.log('🎉 Build completed successfully!');
    console.log('\n📁 Output files:');
    console.log('   - dist/Audio Normalizer Setup 0.1.0.exe (Installer)');
    console.log('   - dist/win-unpacked/Audio Normalizer.exe (Portable)');
    console.log('\n🚀 You can now run the executable!');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();