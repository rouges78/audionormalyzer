const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎵 Building Professional Visualizations Edition...');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

console.log('📁 Project root:', projectRoot);

// Function to forcefully terminate Audio Normalizer processes
function terminateAudioProcesses() {
  console.log('🔄 Terminating existing Audio Normalizer processes...');
  try {
    // Try multiple process names
    const processNames = [
      'Audio Normalizer Professional.exe',
      'AudioNormalizerProfessional.exe', 
      'electron.exe'
    ];
    
    for (const processName of processNames) {
      try {
        execSync(`taskkill /f /im "${processName}"`, { stdio: 'pipe' });
        console.log(`   ✅ Terminated ${processName} processes`);
      } catch (error) {
        // Process not running, which is fine
        console.log(`   ℹ️ No ${processName} processes to terminate`);
      }
    }
    
    // Wait for processes to fully terminate
    console.log('   ⏳ Waiting for processes to terminate...');
    execSync('ping 127.0.0.1 -n 3 > nul', { stdio: 'pipe' }); // 2 second wait
    
  } catch (error) {
    console.log('   ⚠️ Error terminating processes:', error.message);
  }
}

// Function to clean build directory with retry
function cleanBuildDirectory() {
  console.log('🧹 Cleaning previous builds...');
  
  const distPath = path.join(projectRoot, 'dist');
  const maxRetries = 5;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(distPath)) {
        // First try to delete just the exe files one by one
        try {
          const files = fs.readdirSync(distPath);
          const exeFiles = files.filter(f => f.endsWith('.exe'));
          
          for (const file of exeFiles) {
            const filePath = path.join(distPath, file);
            if (fs.existsSync(filePath)) {
              // Try to unlock the file first
              try {
                execSync(`attrib -R "${filePath}"`, { stdio: 'pipe' });
              } catch (e) {}
              
              fs.unlinkSync(filePath);
              console.log(`   🗑️ Deleted ${file}`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Could not delete individual files: ${error.message}`);
        }
        
        // Wait a bit for file system
        execSync('ping 127.0.0.1 -n 2 > nul', { stdio: 'pipe' });
        
        // Then remove the entire directory
        execSync('rmdir /s /q dist', { stdio: 'pipe' });
        console.log('   ✅ Build directory cleaned');
      } else {
        console.log('   ℹ️ No previous build directory found');
      }
      break;
    } catch (error) {
      console.log(`   ⚠️ Cleanup attempt ${i + 1}/${maxRetries} failed:`, error.message.substring(0, 100));
      if (i < maxRetries - 1) {
        console.log(`   ⏳ Waiting ${(i + 1) * 2} seconds before retry...`);
        execSync(`ping 127.0.0.1 -n ${(i + 1) * 2 + 1} > nul`, { stdio: 'pipe' });
      } else {
        console.log('   ⚠️ Could not clean build directory completely, proceeding anyway...');
      }
    }
  }
}

// Function to build with retry logic
function buildWithRetry() {
  console.log('🔨 Building Professional Visualizations executable...');
  const maxRetries = 3;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`   📦 Build attempt ${i + 1}/${maxRetries}...`);
      
      execSync('npx electron-builder --win --x64 --publish=never', { 
        stdio: 'inherit',
        timeout: 600000 // 10 minutes timeout
      });
      
      console.log('✅ Professional Visualizations build completed!');
      return true;
      
    } catch (error) {
      console.log(`   ❌ Build attempt ${i + 1}/${maxRetries} failed:`);
      console.log(`      Error: ${error.message.substring(0, 200)}...`);
      
      if (error.message.includes('output file is locked') || 
          error.message.includes('EBUSY') || 
          error.message.includes('EPERM') ||
          error.message.includes('virus scanner')) {
        
        console.log('   🔒 File locking detected - attempting to resolve...');
        terminateAudioProcesses();
        
        if (i < maxRetries - 1) {
          console.log(`   ⏳ Waiting ${(i + 1) * 5} seconds for file system to stabilize...`);
          execSync(`ping 127.0.0.1 -n ${(i + 1) * 5 + 1} > nul`, { stdio: 'pipe' });
          cleanBuildDirectory();
        }
      } else if (i < maxRetries - 1) {
        console.log(`   ⏳ Waiting ${(i + 1) * 3} seconds before retry...`);
        execSync(`ping 127.0.0.1 -n ${(i + 1) * 3 + 1} > nul`, { stdio: 'pipe' });
      }
    }
  }
  
  return false;
}

try {
  // Step 1: Terminate any running processes
  terminateAudioProcesses();
  
  // Step 2: Wait for file system to stabilize
  console.log('⏳ Waiting for file system to stabilize...');
  execSync('ping 127.0.0.1 -n 3 > nul', { stdio: 'pipe' });
  
  // Step 3: Clean previous builds
  cleanBuildDirectory();
  
  // Step 4: Update configuration for professional version
  console.log('⚙️ Configuring for professional visualizations...');
  const packagePath = path.join(projectRoot, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageData.main = 'electron/main-professional-viz.js';
  packageData.build.productName = 'Audio Normalizer Professional';
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
  console.log('   ✅ Configuration updated');
  
  // Step 5: Build with retry logic
  const buildSuccess = buildWithRetry();
  
  if (!buildSuccess) {
    throw new Error('Build failed after all retry attempts');
  }
  
  // Step 6: Verify build results
  const distPath = path.join(projectRoot, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    const exeFiles = files.filter(file => file.endsWith('.exe'));
    
    if (exeFiles.length > 0) {
      console.log('🎉 Professional Visualizations executable created:');
      exeFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        console.log(`   📦 ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
      });
      
      console.log('\n🎵 Professional Features Included:');
      console.log('   ✅ Waveform visualization con canvas rendering');
      console.log('   ✅ Level meters professionali (Peak, RMS, LUFS)');
      console.log('   ✅ Spectrum analyzer real-time');
      console.log('   ✅ Settings panel avanzato');
      console.log('   ✅ Sistema presets professionali');
      console.log('   ✅ Controlli real-time');
      console.log('   ✅ Interface layout professionale');
      console.log('   ✅ Menu e shortcuts avanzati');
      
      console.log('\n📊 Visualizations & Controls:');
      console.log('   🎵 Waveforms interattive');
      console.log('   📊 Live level meters');
      console.log('   📈 Spectrum analyzer');
      console.log('   ⚙️ Advanced settings');
      console.log('   📋 Professional presets');
      console.log('   🎛️ Real-time controls');
      
      console.log('\n🚀 Ready for professional audio work!');
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
  
  if (error.message.includes('output file is locked') || error.message.includes('EBUSY')) {
    console.log('\n📜 ANTIVIRUS FILE LOCKING DETECTED!');
    console.log('\n💡 Solution Steps:');
    console.log('   1. 🚫 Temporarily disable Windows Defender real-time protection');
    console.log('   2. 📁 Add this project folder to Windows Defender exclusions:');
    console.log(`      "${projectRoot}"`);
    console.log('   3. 🔄 Close any running Audio Normalizer processes');
    console.log('   4. ♾️ Wait 30 seconds, then run: npm run build:professional');
    console.log('\n🔧 Alternative Commands:');
    console.log('   taskkill /f /im "Audio Normalizer Professional.exe"');
    console.log('   rmdir /s /q dist');
    console.log('   npm run build:professional');
    console.log('\nℹ️ This is a known Windows antivirus issue with Electron builds.');
  } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
    console.log('\n📜 DEPENDENCY MISSING!');
    console.log('\n💡 Solution Steps:');
    console.log('   1. 📝 Install missing dependencies: npm install');
    console.log('   2. 🔧 Verify electron-builder: npm list electron-builder');
    console.log('   3. ♾️ Retry build: npm run build:professional');
  } else {
    console.log('\n📜 GENERAL BUILD ERROR!');
    console.log('\n💡 Solution Steps:');
    console.log('   1. 🧹 Clean node modules: npm run clean');
    console.log('   2. 📝 Reinstall dependencies: npm install');
    console.log('   3. ♾️ Retry build: npm run build:professional');
  }
  
  process.exit(1);
}