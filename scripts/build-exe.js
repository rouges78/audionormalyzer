#!/usr/bin/env node

/**
 * Script to create the Windows executable of Audio Normalizer
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Audio Normalizer - Windows Executable Builder');
console.log('='.repeat(50));

async function buildExecutable() {
  try {
    console.log('📦 Step 1: Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    console.log('🔧 Step 2: Building Next.js application...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('📱 Step 3: Building Electron application...');
    execSync('npm run electron:dist', { stdio: 'inherit' });

    console.log('✅ Build completed successfully!');
    console.log('📁 Executable location: dist/');
    
    // List built files
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      console.log('\n📋 Built files:');
      files.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   • ${file} (${size} MB)`);
      });
    }

    console.log('\n🎉 Audio Normalizer executable is ready!');
    console.log('💡 You can find the installer in the dist/ folder');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`   ✓ Node.js: ${nodeVersion}`);
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found. Run this script from the project root.');
    process.exit(1);
  }
  
  // Check if electron is in dependencies
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!packageJson.devDependencies?.electron) {
    console.error('❌ Electron not found in devDependencies. Run npm install first.');
    process.exit(1);
  }
  
  console.log('   ✓ All prerequisites met');
}

function showInstructions() {
  console.log('\n📖 Instructions:');
  console.log('1. The installer will be created in the dist/ folder');
  console.log('2. Run the .exe installer to install Audio Normalizer');
  console.log('3. The app will be available in Start Menu and Desktop');
  console.log('\n🔧 Development:');
  console.log('• npm run electron:dev - Run in development mode');
  console.log('• npm run electron - Run built version');
  console.log('• npm run electron:pack - Create portable version');
}

async function main() {
  checkPrerequisites();
  showInstructions();
  
  console.log('\n🚀 Starting build process...');
  await buildExecutable();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { buildExecutable, checkPrerequisites };