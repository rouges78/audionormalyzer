#!/usr/bin/env node

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
  require('@ffmpeg/ffmpeg')
  console.log('✅ @ffmpeg/ffmpeg can be imported')
} catch (error) {
  console.log('❌ @ffmpeg/ffmpeg import failed:', error.message)
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
