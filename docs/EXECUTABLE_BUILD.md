# 🎵 Audio Normalizer - Windows Executable Build

Guide to building the Windows executable (.exe) of Audio Normalizer.

## 📋 Prerequisites

### Required Software
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (included with Node.js)
- **Git** (optional) - [Download](https://git-scm.com/)

### Operating System
- **Windows 10/11** (recommended for Windows builds)
- **macOS/Linux** (supported but requires additional configuration)

## 🚀 Quick Build

### Single Command
```bash
npm run build:exe
```

This command:
1. Installs the dependencies
2. Builds the Next.js app
3. Creates the Electron executable
4. Generates the Windows installer

## 🔧 Manual Build

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Next.js
```bash
npm run build
```

### 3. Build Electron
```bash
npm run electron:dist
```

## 📁 Output

### Generated Files
```
dist/
├── Audio Normalizer Setup 0.1.0.exe    # Windows installer
├── win-unpacked/                        # Unpacked app
│   ├── Audio Normalizer.exe            # Main executable
│   ├── resources/                       # App resources
│   └── ...
└── latest.yml                          # Update metadata
```

### Typical Sizes
- **Installer**: ~150-200 MB
- **Installed app**: ~300-400 MB
- **Executable**: ~200 MB

## 🎯 Build Types

### 1. Installer (NSIS)
```bash
npm run electron:dist
```
- Creates a complete Windows installer
- Includes an uninstaller
- Registers with the system
- Creates desktop/menu shortcuts

### 2. Portable
```bash
npm run electron:pack
```
- Creates a portable version
- Requires no installation
- Self-contained folder

### 3. Development
```bash
npm run electron:dev
```
- Starts in development mode
- Hot reload enabled
- DevTools open

## ⚙️ Configuration

### Customizing the Build
Edit the `"build"` section of `package.json`:

```json
{
  "build": {
    "appId": "com.audionormalizer.app",
    "productName": "Audio Normalizer",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    }
  }
}
```

### Custom Icons
Replace the files in `assets/`:
- `icon.ico` - Windows (256x256)
- `icon.png` - Linux (512x512)
- `icon.icns` - macOS (512x512)

### Code Signing (Optional)
For public distribution:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "password"
    }
  }
}
```

## 🧪 Testing

### Local Test
```bash
# Build and test
npm run build:exe
cd dist/win-unpacked
"Audio Normalizer.exe"
```

### Installer Test
```bash
# Install from the installer
dist/"Audio Normalizer Setup 0.1.0.exe"
```

### Feature Test
1. **Audio file upload** - Drag & drop
2. **Automatic analysis** - Check levels
3. **Normalization** - Peak and Loudness
4. **Download results** - Single files and ZIP
5. **Application menu** - All options

## 🔍 Troubleshooting

### Common Errors

#### "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

#### "FFmpeg not working"
```bash
npm run setup:audio
npm run test:audio
```

#### "Build fails on Windows"
- Run as Administrator
- Temporarily disable the antivirus
- Check disk space (>2GB free)

#### "App does not start"
- Check Node.js 18+
- Check the logs in `%APPDATA%/Audio Normalizer/logs/`
- Reinstall the Visual C++ Redistributable

### Debug Build
```bash
# Build with debug
DEBUG=electron-builder npm run electron:dist

# Detailed logs
npm run electron:dist -- --verbose
```

### Cache Cleanup
```bash
# Clean the Electron cache
npm run clean:temp
rm -rf node_modules/.cache
rm -rf dist/
```

## 📦 Distribution

### Local Distribution
1. Share the `.exe` installer file
2. Users run the installer
3. The app installs automatically

### Online Distribution
1. Upload the installer to a server/GitHub Releases
2. Share the download link
3. Consider code signing to avoid warnings

### Auto-Update (Advanced)
Configure automatic updates:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "audio-normalizer"
    }
  }
}
```

## 🎨 Customization

### Branding
- Change the app name in `package.json`
- Replace the icons in `assets/`
- Customize the splash screen
- Change the theme colors

### Extra Features
- Add context menus
- Integrate with Windows Explorer
- File association support
- System notifications

## 📊 Performance

### Build Optimizations
- Use `--win --x64` for a specific target
- Enable compression: `"compression": "maximum"`
- Exclude unneeded files: `"files": ["!tests/**/*"]`

### Runtime Performance
- The app uses ~100-200MB RAM
- Audio processing: CPU-intensive
- Temp files: cleaned up automatically

## 🔐 Security

### Best Practices
- Do not include credentials in the build
- Validate user input
- Sandbox audio processes
- Update dependencies regularly

### Antivirus
- Some antivirus products may flag the app
- Consider code signing
- Test with Windows Defender
- Document false positives

## 📞 Support

### Build Problems
1. Check the build logs
2. Verify the prerequisites
3. Test on a clean system
4. Consult the Electron documentation

### Runtime Problems
1. Check the application logs
2. Test the audio features
3. Check file permissions
4. Reinstall if necessary

---

**Audio Normalizer** - Professional Windows build with Electron.

For support: [GitHub Issues](https://github.com/your-repo/audio-normalizer/issues)