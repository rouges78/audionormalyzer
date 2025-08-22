#!/usr/bin/env node

/**
 * Setup script for audio processing environment
 * Handles native dependencies and development environment configuration
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🎵 Setting up audio processing environment...')

// Create necessary directories
const directories = [
  './temp',
  './temp/audio',
  './output',
  './output/audio',
  './logs'
]

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✅ Created directory: ${dir}`)
  } else {
    console.log(`📁 Directory already exists: ${dir}`)
  }
})

// Create .gitignore entries for temporary and output directories
const gitignorePath = './.gitignore'
const gitignoreEntries = [
  '# Audio processing temporary files',
  'temp/audio/*',
  '!temp/audio/.gitkeep',
  'output/audio/*',
  '!output/audio/.gitkeep',
  'logs/*.log',
  ''
].join('\n')

if (fs.existsSync(gitignorePath)) {
  const currentGitignore = fs.readFileSync(gitignorePath, 'utf8')
  if (!currentGitignore.includes('temp/audio')) {
    fs.appendFileSync(gitignorePath, '\n' + gitignoreEntries)
    console.log('✅ Updated .gitignore with audio processing entries')
  }
} else {
  fs.writeFileSync(gitignorePath, gitignoreEntries)
  console.log('✅ Created .gitignore with audio processing entries')
}

// Create .gitkeep files to preserve empty directories
const gitkeepFiles = [
  './temp/audio/.gitkeep',
  './output/audio/.gitkeep'
]

gitkeepFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '')
    console.log(`✅ Created ${file}`)
  }
})

// Check for FFmpeg installation
try {
  execSync('ffmpeg -version', { stdio: 'pipe' })
  console.log('✅ FFmpeg is installed and available')
} catch (error) {
  console.log('⚠️  FFmpeg not found. Please install FFmpeg for full functionality:')
  console.log('   Windows: Download from https://ffmpeg.org/download.html')
  console.log('   macOS: brew install ffmpeg')
  console.log('   Linux: sudo apt-get install ffmpeg')
}

// Create environment configuration file
const envConfigPath = './.env.local'
const envConfig = `# Audio processing configuration
AUDIO_TEMP_DIR=./temp/audio
AUDIO_OUTPUT_DIR=./output/audio
AUDIO_MAX_FILE_SIZE=104857600
AUDIO_MAX_CONCURRENT=3
AUDIO_PROCESSING_TIMEOUT=300000
`

if (!fs.existsSync(envConfigPath)) {
  fs.writeFileSync(envConfigPath, envConfig)
  console.log('✅ Created .env.local with audio processing configuration')
} else {
  console.log('📄 .env.local already exists - please verify audio configuration')
}

// Verify package.json has the required dependencies
const packageJsonPath = './package.json'
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const requiredDeps = ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'loudness', 'audio-buffer-utils']
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep])
  
  if (missingDeps.length === 0) {
    console.log('✅ All required audio processing dependencies are installed')
  } else {
    console.log(`⚠️  Missing dependencies: ${missingDeps.join(', ')}`)
    console.log('   Run: pnpm add ' + missingDeps.join(' '))
  }
}

// Create a simple test script to verify setup
const testScriptPath = './scripts/test-audio-setup.js'
const testScript = `#!/usr/bin/env node

/**
 * Test script to verify audio processing setup
 */

const fs = require('fs')

console.log('🧪 Testing audio processing setup...')

// Test directory structure
const requiredDirs = ['./temp/audio', './output/audio']
const missingDirs = requiredDirs.filter(dir => !fs.existsSync(dir))

if (missingDirs.length === 0) {
  console.log('✅ Directory structure is correct')
} else {
  console.log('❌ Missing directories:', missingDirs)
}

// Test module imports
try {
  require('node-ffmpeg')
  console.log('✅ node-ffmpeg can be imported')
} catch (error) {
  console.log('❌ node-ffmpeg import failed:', error.message)
}

try {
  require('loudness')
  console.log('✅ loudness can be imported')
} catch (error) {
  console.log('❌ loudness import failed:', error.message)
}

try {
  require('audio-buffer-utils')
  console.log('✅ audio-buffer-utils can be imported')
} catch (error) {
  console.log('❌ audio-buffer-utils import failed:', error.message)
}

console.log('🎵 Audio setup test completed')
`

fs.writeFileSync(testScriptPath, testScript)
fs.chmodSync(testScriptPath, '755')
console.log('✅ Created test script: scripts/test-audio-setup.js')

console.log('\n🎉 Audio processing environment setup completed!')
console.log('\nNext steps:')
console.log('1. Run: node scripts/test-audio-setup.js')
console.log('2. Install FFmpeg if not already installed')
console.log('3. Start development: pnpm dev')