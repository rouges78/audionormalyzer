/**
 * Audio Normalizer - Minimal Electron Builder Configuration
 * Simplified configuration to guarantee the EXE gets created
 */

module.exports = {
  appId: 'com.audionormalizer.app',
  productName: 'Audio Normalizer',
  
  directories: {
    output: 'dist'
  },

  files: [
    'electron/**/*',
    'package.json',
    '!**/*.test.*',
    '!**/__tests__/**/*',
    '!node_modules/**/*',
    '!scripts/**/*',
    '!docs/**/*',
    '!**/*.md'
  ],

  win: {
    target: 'portable',
    artifactName: '${productName}-${version}.exe'
  },

  portable: {
    artifactName: '${productName}-${version}-Portable.exe'
  },

  // Minimal configuration without external dependencies
  buildDependenciesFromSource: false,
  npmRebuild: false,
  nodeGypRebuild: false,
  
  // Disable features that could cause problems
  forceCodeSigning: false
}