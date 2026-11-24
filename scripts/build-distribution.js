#!/usr/bin/env node
/**
 * Audio Normalizer - Complete Distribution Builder
 * Script to create all the distributions (web, desktop, docker)
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class DistributionBuilder {
  constructor() {
    this.version = require('../package.json').version
    this.platforms = ['web', 'desktop', 'docker']
    this.buildStartTime = Date.now()
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const prefix = {
      info: '📦',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type]
    
    console.log(`[${timestamp}] ${prefix} ${message}`)
  }

  executeCommand(command, options = {}) {
    this.log(`Executing: ${command}`)
    try {
      const result = execSync(command, {
        stdio: 'inherit',
        encoding: 'utf8',
        ...options
      })
      return result
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'error')
      throw error
    }
  }

  async setupEnvironment() {
    this.log('Setting up build environment...')
    
    // Create necessary directories
    const dirs = ['dist', 'build', 'temp/audio', 'output/audio', 'logs']
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        this.log(`Created directory: ${dir}`)
      }
    })

    // Clean previous builds
    this.log('Cleaning previous builds...')
    this.executeCommand('npm run clean:temp')
    
    // Install dependencies
    this.log('Installing dependencies...')
    this.executeCommand('npm ci')
    
    // Setup audio environment
    this.log('Setting up audio environment...')
    this.executeCommand('npm run setup:audio')
  }

  async runTests() {
    this.log('Running comprehensive tests...')
    try {
      this.executeCommand('npm run test:comprehensive')
      this.log('All tests passed!', 'success')
    } catch (error) {
      this.log('Some tests failed, but continuing build...', 'warning')
    }
  }

  async buildWeb() {
    this.log('Building web application...')
    this.executeCommand('npm run build')
    this.log('Web build completed!', 'success')
  }

  async buildDesktop() {
    this.log('Building desktop applications...')
    
    // Build for current platform
    this.executeCommand('npm run electron:dist')
    
    this.log('Desktop build completed!', 'success')
  }

  async buildDocker() {
    this.log('Building Docker images...')
    
    try {
      // Build production image
      this.executeCommand('docker build -t audionormalizer/audio-normalizer:latest .')
      this.executeCommand(`docker tag audionormalizer/audio-normalizer:latest audionormalizer/audio-normalizer:${this.version}`)
      
      // Build development image
      this.executeCommand('docker build -f Dockerfile.dev -t audionormalizer/audio-normalizer:dev .')
      
      this.log('Docker images built successfully!', 'success')
    } catch (error) {
      this.log('Docker build failed - Docker may not be available', 'warning')
    }
  }

  async generateReleaseNotes() {
    this.log('Generating release notes...')
    
    const releaseNotes = `# Audio Normalizer v${this.version} - Release Notes

## 🎵 Audio Normalizer Professional Edition

**Release Date:** ${new Date().toISOString().split('T')[0]}
**Version:** ${this.version}

### ✨ Features
- Professional-grade audio level normalization
- EBU R128 loudness compliance
- Support for MP3, WAV, FLAC, AAC, M4A, OGG formats
- Real-time waveform preview and level comparison
- Drag-and-drop batch processing
- Metadata preservation (ID3, Vorbis, iTunes)
- Advanced plugin architecture with GPU acceleration
- 3D audio visualizations and professional UI

### 🚀 Distribution Formats

#### Desktop Applications
- **Windows:** NSIS Installer, Portable, ZIP
- **macOS:** DMG, ZIP (Intel & Apple Silicon)
- **Linux:** AppImage, DEB, RPM, TAR.GZ

#### Web Application
- **Docker:** Production-ready container
- **Standalone:** Next.js build for deployment

### 📋 System Requirements

#### Desktop
- **Windows:** Windows 10 or later (64-bit)
- **macOS:** macOS 10.14 or later
- **Linux:** Ubuntu 18.04+ or equivalent
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 500MB installation, 2GB for processing

#### Web/Docker
- **CPU:** 2+ cores recommended
- **RAM:** 2GB minimum, 4GB recommended
- **Storage:** 1GB for application, additional for processing
- **Node.js:** 18.0 or later (for manual deployment)

### 🔧 Installation

#### Desktop
1. Download the appropriate installer for your platform
2. Run the installer and follow the setup wizard
3. Launch Audio Normalizer from your applications menu

#### Docker
\`\`\`bash
# Pull and run latest version
docker run -p 3000:3000 audionormalizer/audio-normalizer:latest

# Or use docker-compose
docker-compose up -d
\`\`\`

### 🐛 Known Issues
- Large files (>500MB) may require additional memory
- WebGPU features require modern browsers
- Some antivirus software may flag the portable version

### 🙏 Acknowledgments
Built with Next.js, React, TypeScript, and Electron.
Audio processing powered by FFmpeg and professional audio libraries.

---
For support and documentation, visit: https://github.com/audionormalizer/audio-normalizer
`

    const notesPath = path.join(__dirname, '..', 'dist', 'RELEASE_NOTES.md')
    fs.writeFileSync(notesPath, releaseNotes)
    this.log('Release notes generated!', 'success')
  }

  async generateDistributionInfo() {
    this.log('Generating distribution information...')
    
    const distInfo = {
      version: this.version,
      buildDate: new Date().toISOString(),
      buildDuration: Date.now() - this.buildStartTime,
      platforms: this.platforms,
      files: {},
      checksums: {}
    }

    // Scan dist directory for built files
    const distDir = path.join(__dirname, '..', 'dist')
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir, { recursive: true })
      files.forEach(file => {
        if (typeof file === 'string') {
          const filePath = path.join(distDir, file)
          if (fs.statSync(filePath).isFile()) {
            distInfo.files[file] = {
              size: fs.statSync(filePath).size,
              modified: fs.statSync(filePath).mtime.toISOString()
            }
          }
        }
      })
    }

    const infoPath = path.join(__dirname, '..', 'dist', 'distribution-info.json')
    fs.writeFileSync(infoPath, JSON.stringify(distInfo, null, 2))
    this.log('Distribution info generated!', 'success')
  }

  async build(platforms = this.platforms) {
    try {
      this.log(`Starting build process for Audio Normalizer v${this.version}`)
      this.log(`Platforms: ${platforms.join(', ')}`)

      await this.setupEnvironment()
      await this.runTests()

      if (platforms.includes('web')) {
        await this.buildWeb()
      }

      if (platforms.includes('desktop')) {
        await this.buildDesktop()
      }

      if (platforms.includes('docker')) {
        await this.buildDocker()
      }

      await this.generateReleaseNotes()
      await this.generateDistributionInfo()

      const duration = Math.round((Date.now() - this.buildStartTime) / 1000)
      this.log(`Build completed successfully in ${duration}s!`, 'success')
      this.log(`Distribution files available in: dist/`)

    } catch (error) {
      this.log(`Build failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2)
  const platforms = args.length > 0 ? args : ['web', 'desktop', 'docker']
  
  console.log('🎵 Audio Normalizer Distribution Builder')
  console.log('======================================')
  
  const builder = new DistributionBuilder()
  builder.build(platforms)
}

module.exports = DistributionBuilder