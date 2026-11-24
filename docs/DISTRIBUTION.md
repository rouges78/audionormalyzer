# Audio Normalizer - Distribution Guide

This guide explains how to build and distribute Audio Normalizer for all supported formats.

## 🚀 Quick Start

### Full Build (All Formats)
```bash
npm run build:all
```

### Specific Builds
```bash
# Web application only
npm run build:dist:web

# Desktop applications only
npm run build:dist:desktop

# Docker images only
npm run build:dist:docker
```

## 📦 Distribution Formats

### 1. Web Application (Next.js)

**Output:** `.next/` directory for deployment
**Command:** `npm run build:dist:web`

**Deployment Options:**
- **Vercel/Netlify:** Deploy directly from the repository
- **Node.js server:** Use `npm start` after the build
- **Static Export:** Configure `next.config.js` for static export

### 2. Desktop Applications (Electron)

**Output:** `dist/` directory with installers
**Command:** `npm run build:dist:desktop`

**Formats per Platform:**
- **Windows:** NSIS Installer (.exe), Portable (.exe), ZIP
- **macOS:** DMG (.dmg), ZIP (Intel & Apple Silicon)
- **Linux:** AppImage (.AppImage), DEB (.deb), RPM (.rpm), TAR.GZ

### 3. Docker Containers

**Output:** Docker images
**Command:** `npm run build:dist:docker`

**Generated Images:**
- `audionormalizer/audio-normalizer:latest` - Production
- `audionormalizer/audio-normalizer:dev` - Development
- `audionormalizer/audio-normalizer:x.x.x` - Specific version

## 🛠️ Build Configuration

### Electron Builder
Configuration in `electron-builder.config.js`:
- Multi-platform support
- Code signing (when certificates are available)
- Built-in auto-updater
- Optimized compression

### Docker
- **Production:** Optimized multi-stage build
- **Development:** Hot reload and volume mounting
- **Nginx:** Optional reverse proxy

### GitHub Actions
Automated workflow for:
- Full test runs
- Multi-platform builds
- Automatic releases
- Docker Hub publishing

## 📋 System Requirements

### For the Build Environment
- **Node.js:** 18.0 or later
- **NPM:** 8.0 or later
- **Git:** For cloning the repository
- **Docker:** For container builds (optional)

### Target Systems
#### Desktop
- **Windows:** 10 or later (64-bit)
- **macOS:** 10.14 or later
- **Linux:** Ubuntu 18.04+ or equivalent

#### Web/Container
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+
- **Server:** Node.js 18+, 2GB RAM minimum

## 🔧 Build Scripts

### `build-distribution.js`
Master script for all distribution formats:

```bash
# Build everything
node scripts/build-distribution.js

# Specific build
node scripts/build-distribution.js web desktop
```

### Features:
- ✅ Automatic environment setup
- ✅ Full pre-build tests
- ✅ Multi-format build
- ✅ Release notes generation
- ✅ Checksum calculation
- ✅ Output validation

## 🚀 Deployment

### Web Application

#### Vercel
```bash
# Link the repository
vercel --prod

# Required environment variables:
# TEMP_AUDIO_DIR=/tmp/audio
# OUTPUT_AUDIO_DIR=/tmp/output
```

#### Docker
```bash
# Build and run
docker build -t audionormalizer .
docker run -p 3000:3000 audionormalizer

# With Docker Compose
docker-compose up -d
```

#### Traditional Server
```bash
# Build and deploy
npm run build
npm start

# With PM2
pm2 start npm --name "audio-normalizer" -- start
```

### Desktop Applications

#### Windows
1. Build: `npm run build:dist:desktop`
2. Files generated in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.exe` (NSIS)
   - `Audio-Normalizer-Professional-x.x.x-Portable.exe`
   - `Audio-Normalizer-Professional-x.x.x-win.zip`

#### macOS
1. Build: `npm run build:dist:desktop`
2. Files generated in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.dmg`
   - `Audio-Normalizer-Professional-x.x.x-mac.zip`

#### Linux
1. Build: `npm run build:dist:desktop`
2. Files generated in `dist/`:
   - `Audio-Normalizer-Professional-x.x.x.AppImage`
   - `audio-normalizer-professional_x.x.x_amd64.deb`
   - `audio-normalizer-professional-x.x.x.x86_64.rpm`

## 🔐 Code Signing

### Windows
```javascript
// electron-builder.config.js
win: {
  certificateFile: "path/to/certificate.p12",
  certificatePassword: process.env.CSC_KEY_PASSWORD
}
```

### macOS
```javascript
// electron-builder.config.js
mac: {
  identity: "Developer ID Application: Your Name",
  provisioningProfile: "path/to/profile.mobileprovision"
}
```

## 📊 Monitoring Build

### Log Output
All builds produce detailed logs:
- `logs/build-{timestamp}.log`
- Console output with timestamps
- Duration and size information

### Distribution Info
The file `dist/distribution-info.json` contains:
```json
{
  "version": "0.1.0",
  "buildDate": "2024-01-01T00:00:00.000Z",
  "buildDuration": 120000,
  "platforms": ["web", "desktop", "docker"],
  "files": {
    "Audio-Normalizer-Professional-0.1.0.exe": {
      "size": 150000000,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## 🐛 Troubleshooting

### Common Build Errors

#### Error: "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

#### Error: "Docker not found"
```bash
# Install Docker Desktop
# Or skip it: npm run build:dist web desktop
```

#### Error: "ENOENT: no such file or directory"
```bash
# Clean and reinstall
npm run clean:temp
npm ci
```

### Performance Issues
- **Large files:** Increase memory: `--max-old-space-size=4096`
- **Slow builds:** Use incremental builds
- **Disk space:** Regularly clean `dist/` and `node_modules/`

## 📱 Continuous Integration

### GitHub Actions
Workflow in `.github/workflows/build-release.yml`:
- Triggered on `v*` tags or manually
- Parallel multi-platform builds
- Automated tests
- Automatic GitHub releases
- Docker Hub push

### Local CI
```bash
# Simulate CI locally
npm run release
```

## 🎯 Best Practices

1. **Versioning:** Use Semantic Versioning (x.y.z)
2. **Testing:** Run `npm run test:comprehensive` before the build
3. **Environment:** Use `.env.local` for specific configurations
4. **Security:** Do not commit certificates or private keys
5. **Documentation:** Update README.md for every release
6. **Backup:** Keep backups of the distribution files

## 📞 Support

For distribution problems:
1. Check the logs in `logs/`
2. Verify the system requirements
3. Consult the GitHub documentation
4. Open an issue with full logs

---

**Audio Normalizer Professional** - Professional Distribution for All Platforms