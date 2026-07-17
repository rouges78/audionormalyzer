/**
 * Audio Normalizer - Electron Builder Configuration
 * Configurazione completa per la distribuzione desktop
 */

const { version, description, author } = require('./package.json')

module.exports = {
  appId: 'com.audionormalizer.app',
  productName: 'Audio Normalizer Professional',
  copyright: `Copyright © 2024 ${author}`,
  asar: true,
  compression: 'maximum',

  // Fix per problemi di file locking su Windows
  buildDependenciesFromSource: false,
  npmRebuild: false,
  nodeGypRebuild: false,

  // Evita conflitti durante il build
  removePackageScripts: true,
  removePackageKeywords: true,

  directories: {
    output: 'dist',
    buildResources: 'build'
  },

  files: [
    'electron/main.js',
    'electron/preload.js',
    '.next/standalone/**/*',
    '.next/static/**/*',
    'public/**/*',
    'package.json',
    '!**/node_modules/**/*',
    '!**/*.test.*',
    '!**/__tests__/**/*',
    '!scripts/**/*',
    '!docs/**/*',
    '!**/*.md',
    '!temp/**/*',
    '!output/**/*',
    '!logs/**/*'
  ],

  extraResources: [
    {
      from: 'public',
      to: 'public'
    }
  ],

  // Windows Configuration
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    requestedExecutionLevel: 'asInvoker',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    publisherName: 'Audio Normalizer Team',
    // Fix per problemi di build su Windows
    verifyUpdateCodeSignature: false,
    signAndEditExecutable: false
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    menuCategory: 'Audio Tools',
    shortcutName: 'Audio Normalizer Professional',
    include: 'build/installer.nsh',
    warningsAsErrors: false,
    runAfterFinish: true,
    allowElevation: true
  },

  portable: {
    artifactName: '${productName}-${version}-Portable-${arch}.${ext}',
    requestExecutionLevel: 'user'
  },

  // macOS Configuration
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'build/icon.icns',
    category: 'public.app-category.music',
    bundleVersion: version,
    minimumSystemVersion: '10.14.0',
    darkModeSupport: true,
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },

  dmg: {
    title: '${productName} ${version}',
    icon: 'build/icon.icns',
    background: 'build/dmg-background.png',
    window: {
      width: 660,
      height: 400
    },
    contents: [
      {
        x: 180,
        y: 170
      },
      {
        x: 480,
        y: 170,
        type: 'link',
        path: '/Applications'
      }
    ]
  },

  // Linux Configuration
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64', 'arm64']
      },
      {
        target: 'deb',
        arch: ['x64', 'arm64']
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64']
      },
      {
        target: 'tar.gz',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'build/icon.png',
    category: 'AudioVideo',
    desktop: {
      Name: 'Audio Normalizer Professional',
      Comment: description,
      Keywords: 'audio;normalizer;music;broadcast;lufs;ebu',
      MimeType: 'audio/mpeg;audio/wav;audio/flac;audio/ogg;audio/mp4'
    },
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },

  appImage: {
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },

  deb: {
    depends: ['gconf2', 'gconf-service', 'libnotify4', 'libappindicator1', 'libxtst6', 'libnss3'],
    recommends: ['pulseaudio']
  },

  rpm: {
    depends: ['libnotify', 'libappindicator-gtk3', 'libXtst', 'nss']
  },

  // Publishing Configuration
  publish: [
    {
      provider: 'github',
      owner: 'audionormalizer',
      repo: 'audio-normalizer'
    }
  ],

  // Code Signing (when certificates are available)
  forceCodeSigning: false,

  // Metadata
  buildVersion: version,
  buildDependenciesFromSource: false,
  npmRebuild: false,
  nodeGypRebuild: false,

  // Compression and optimization
  removePackageScripts: true,
  removePackageKeywords: true,

  // Protocols
  protocols: [
    {
      name: 'Audio Normalizer',
      schemes: ['audionormalizer']
    }
  ]
}
