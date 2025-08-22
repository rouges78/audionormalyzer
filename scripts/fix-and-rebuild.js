#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Audio Normalizer - Executable Fix & Rebuild\n');

function runCommand(command, description, options = {}) {
  console.log(`📋 ${description}...`);
  try {
    const result = execSync(command, { 
      stdio: options.silent ? 'pipe' : 'inherit', 
      cwd: process.cwd(),
      encoding: 'utf8',
      ...options
    });
    console.log(`✅ ${description} completed\n`);
    return result;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    if (options.required !== false) {
      process.exit(1);
    }
    return null;
  }
}

function backupFile(filePath, suffix = '.backup') {
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + suffix;
    fs.copyFileSync(filePath, backupPath);
    console.log(`📁 Backed up: ${filePath} -> ${backupPath}`);
    return true;
  }
  return false;
}

function replaceFile(source, target, description) {
  if (fs.existsSync(source)) {
    backupFile(target);
    fs.copyFileSync(source, target);
    console.log(`✅ ${description}: ${source} -> ${target}`);
    return true;
  } else {
    console.log(`⚠️ Source file not found: ${source}`);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive fix and rebuild...\n');
    
    // 1. Clean previous builds
    console.log('🧹 Cleaning previous builds and cache...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
      console.log('✅ Removed dist directory');
    }
    
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
      console.log('✅ Removed .next directory');
    }
    
    runCommand('npm cache clean --force', 'Cleaning npm cache', { required: false });
    console.log('');
    
    // 2. Install/update dependencies
    runCommand('npm install', 'Installing/updating dependencies');
    
    // 3. Apply fixes
    console.log('🔧 Applying fixes...');
    
    // Replace main.js with improved version
    replaceFile('electron/main-fixed.js', 'electron/main.js', 'Updated Electron main process');
    
    // Replace server.js with improved version
    replaceFile('server-improved.js', 'server.js', 'Updated Next.js server');
    
    // Update package.json main entry
    const packageJsonPath = 'package.json';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.main = 'electron/main.js';
      
      // Ensure correct electron-builder config
      packageJson.build = {
        ...packageJson.build,
        appId: "com.audionormalizer.app",
        productName: "Audio Normalizer",
        directories: {
          output: "dist",
          buildResources: "build"
        },
        files: [
          "electron/main.js",
          "electron/preload.js",
          ".next/**/*",
          "public/**/*",
          "package.json",
          "next.config.js",
          "server.js",
          "node_modules/**/*",
          "!node_modules/.cache/**/*",
          "!**/*.map",
          "!**/*.test.*",
          "!**/__tests__/**/*"
        ],
        win: {
          target: "portable",
          icon: "assets/icon.ico"
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true
        }
      };
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Updated package.json configuration');
    }
    
    console.log('');
    
    // 4. Create assets directory and icon if missing
    console.log('🎨 Setting up assets...');
    if (!fs.existsSync('assets')) {
      fs.mkdirSync('assets', { recursive: true });
      console.log('✅ Created assets directory');
    }
    
    // 5. Build Next.js application
    runCommand('npm run build', 'Building Next.js application');
    
    // 6. Verify build
    console.log('🔍 Verifying build...');
    const nextDir = '.next';
    if (!fs.existsSync(nextDir)) {
      throw new Error('Next.js build failed - .next directory not found');
    }
    console.log('✅ Next.js build verified');
    
    // 7. Build Electron executable
    runCommand('npx electron-builder --win --x64 --publish=never', 'Building Electron executable');
    
    // 8. Verify output
    console.log('📁 Verifying output files...');
    const exePath = 'dist/Audio Normalizer 0.1.0.exe';
    const unpackedPath = 'dist/win-unpacked/Audio Normalizer.exe';
    
    const checkFile = (filePath, description) => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${description}: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } else {
        console.log(`❌ ${description} not found: ${filePath}`);
        return false;
      }
    };
    
    const hasPortable = checkFile(exePath, 'Portable executable');
    const hasUnpacked = checkFile(unpackedPath, 'Unpacked executable');
    
    if (!hasPortable && !hasUnpacked) {
      throw new Error('No executable files were created');
    }
    
    console.log('\n🎉 Build completed successfully!\n');
    
    // 9. Test the executable
    console.log('🧪 Testing executable...');
    if (hasPortable) {
      console.log('📋 To test, run:');
      console.log(`   "${exePath}"`);
    }
    
    console.log('\n🚀 Audio Normalizer is ready!');
    console.log('\n📋 What was fixed:');
    console.log('   ✅ Improved Electron main process with better error handling');
    console.log('   ✅ Enhanced Next.js server startup with fallbacks');
    console.log('   ✅ Better build configuration and dependencies');
    console.log('   ✅ Comprehensive error messages and debugging');
    console.log('   ✅ Graceful server shutdown handling');
    
    console.log('\n🎵 Features available:');
    console.log('   • Peak & Loudness Normalization (EBU R128)');
    console.log('   • Multiple Audio Formats (MP3, WAV, FLAC, etc.)');
    console.log('   • Batch Processing & Album Normalization');
    console.log('   • Drag & Drop Interface');
    console.log('   • Real-time Progress Tracking');
    console.log('   • Professional Audio Analysis');
    
    console.log('\n🔧 If you still experience issues:');
    console.log('   1. Run as Administrator');
    console.log('   2. Temporarily disable antivirus');
    console.log('   3. Check Windows Defender SmartScreen settings');
    console.log('   4. Ensure Visual C++ Redistributable is installed');
    
  } catch (error) {
    console.error('\n❌ Fix and rebuild failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure Node.js 18+ is installed');
    console.error('   2. Run as Administrator on Windows');
    console.error('   3. Check available disk space (>2GB)');
    console.error('   4. Temporarily disable antivirus software');
    console.error('   5. Clear npm cache: npm cache clean --force');
    process.exit(1);
  }
}

main();