/**
 * Audio Normalizer - Configurazione Electron Builder Minimale
 * Configurazione semplificata per garantire la creazione dell'EXE
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

  // Configurazione minimale senza dipendenze esterne
  buildDependenciesFromSource: false,
  npmRebuild: false,
  nodeGypRebuild: false,
  
  // Disabilita funzionalità che potrebbero causare problemi
  forceCodeSigning: false
}