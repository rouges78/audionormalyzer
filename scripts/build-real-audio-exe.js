const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎵 Building Real Audio Processing Edition...');

// Ensure we're in the right directory
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

console.log('📁 Project root:', projectRoot);

try {
  // Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  if (fs.existsSync('dist')) {
    execSync('rmdir /s /q dist', { stdio: 'inherit' });
  }

  // Update main entry point to real audio version
  console.log('⚙️ Configuring for real audio processing...');
  const packagePath = path.join(projectRoot, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageData.main = 'electron/main-with-real-audio.js';
  packageData.build.productName = 'Audio Normalizer - Real Audio Processing';
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));

  // Build the executable
  console.log('🔨 Building Real Audio Processing executable...');
  execSync('npx electron-builder --win --x64 --publish=never', { 
    stdio: 'inherit',
    timeout: 300000 // 5 minutes timeout
  });

  console.log('✅ Real Audio Processing build completed!');
  
  // Check if build was successful
  const distPath = path.join(projectRoot, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    const exeFiles = files.filter(file => file.endsWith('.exe'));
    
    if (exeFiles.length > 0) {
      console.log('🎉 Real Audio Processing executable created:');
      exeFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        console.log(`   📦 ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
      });
      
      console.log('\n🎵 Real Audio Processing Features:');
      console.log('   ✅ Real FFmpeg audio analysis');
      console.log('   ✅ Peak detection and LUFS measurement');
      console.log('   ✅ Professional normalization algorithms');
      console.log('   ✅ EBU R128 compliance');
      console.log('   ✅ Multi-format support (MP3, WAV, FLAC, AAC, M4A, OGG)');
      console.log('   ✅ Batch processing with real-time progress');
      console.log('   ✅ Professional TRON-style interface');
      
      console.log('\n🚀 Ready to test real audio processing!');
      console.log(`   Run: "${path.join(distPath, exeFiles[0])}"`);
      
    } else {
      console.error('❌ No executable found in dist folder');
      process.exit(1);
    }
  } else {
    console.error('❌ Dist folder not created');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  if (error.message.includes('output file is locked')) {
    console.log('\n💡 Tip: If antivirus is blocking the build:');
    console.log('   1. Temporarily disable real-time protection');
    console.log('   2. Add project folder to antivirus exclusions');
    console.log('   3. Run: npm run build:real-audio');
  }
  
  process.exit(1);
}