# 🎵 Audio Normalizer

Professional audio level normalization tool with support for multiple formats and industry-standard compliance.

## ✨ Features

### 🎛️ Audio Processing
- **Multiple Format Support**: MP3, WAV, FLAC, AAC, M4A, OGG
- **Peak Normalization**: Normalize to target peak levels
- **Loudness Normalization**: EBU R128 compliant LUFS normalization
- **True Peak Limiting**: Prevent digital clipping
- **Quality Preservation**: Maintain audio quality during processing

### 📁 File Management
- **Batch Processing**: Handle multiple files and entire albums
- **Drag & Drop Upload**: Intuitive file upload interface
- **Metadata Preservation**: Keep ID3 tags and other metadata intact
- **Format Validation**: Automatic format detection and validation

### 🎨 User Interface
- **Real-time Preview**: See changes before applying
- **Waveform Visualization**: Visual representation of audio levels
- **Progress Tracking**: Real-time processing progress
- **Responsive Design**: Works on desktop and mobile devices

### ⚡ Performance
- **Concurrent Processing**: Efficient multi-file processing
- **Memory Management**: Optimized for large albums
- **Streaming Downloads**: Handle large files efficiently
- **Background Processing**: Non-blocking user interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- FFmpeg (automatically configured)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd audio-normalizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup audio environment**
   ```bash
   npm run setup:audio
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage

### Basic Workflow

1. **Upload Files**
   - Drag and drop audio files onto the upload area
   - Or click to select files from your computer
   - Supports multiple files and formats

2. **Configure Normalization**
   - Choose normalization method (Peak or Loudness)
   - Set target level (-1 dB for peak, -23 LUFS for broadcast)
   - Select output format (preserve original or convert)

3. **Preview Changes**
   - View waveform visualization
   - See before/after level comparisons
   - Check for potential clipping

4. **Process Files**
   - Start normalization with real-time progress
   - Monitor processing status for each file
   - Handle errors gracefully

5. **Download Results**
   - Download individual files
   - Or get entire album as ZIP
   - Files expire after 24 hours

### Normalization Methods

#### Peak Normalization
- Normalizes to maximum peak level
- Best for: Individual tracks, podcasts
- Target: -1 dB to -6 dB (recommended: -1 dB)

#### Loudness Normalization (LUFS)
- EBU R128 compliant loudness normalization
- Best for: Broadcast, streaming, album consistency
- Targets:
  - **Broadcast**: -23 LUFS (EBU R128)
  - **Streaming**: -14 to -16 LUFS
  - **Podcast**: -16 to -20 LUFS

## 🎯 Supported Standards

### Audio Formats
| Format | Extension | Metadata | Quality |
|--------|-----------|----------|---------|
| MP3 | .mp3 | ID3v2 | Lossy |
| WAV | .wav | None | Lossless |
| FLAC | .flac | Vorbis Comments | Lossless |
| AAC | .aac | ID3v2 | Lossy |
| M4A | .m4a | iTunes | Lossy |
| OGG | .ogg | Vorbis Comments | Lossy |

### Compliance Standards
- **EBU R128**: European broadcast standard (-23 LUFS)
- **ATSC A/85**: US broadcast standard (-24 LUFS)
- **ITU-R BS.1770**: International loudness measurement
- **True Peak Limiting**: -1.0 dBTP maximum

## 🛠️ Development

### Project Structure
```
audio-normalizer/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
├── services/              # Business logic services
├── types/                 # TypeScript type definitions
├── __tests__/             # Integration tests
├── docs/                  # Documentation
└── scripts/               # Build and setup scripts
```

### Available Scripts

#### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

#### Testing
```bash
npm run test                    # Run all tests
npm run test:unit              # Run unit tests only
npm run test:integration       # Run integration tests only
npm run test:coverage          # Generate coverage report
npm run test:comprehensive     # Run categorized test suite
```

#### Audio Setup
```bash
npm run setup:audio    # Configure audio environment
npm run test:audio     # Test audio setup
npm run clean:temp     # Clean temporary files
```

### Testing

The project includes a comprehensive test suite:

- **120+ Tests** covering all functionality
- **Unit Tests** for core services and components
- **Integration Tests** for complete workflows
- **Performance Tests** for large file processing
- **Error Handling Tests** for edge cases

Run the comprehensive test suite:
```bash
npm run test:comprehensive
```

### Configuration

#### Environment Variables
Create a `.env.local` file:
```env
# Optional: Custom temp directory
TEMP_AUDIO_DIR=/custom/temp/path

# Optional: Custom output directory  
OUTPUT_AUDIO_DIR=/custom/output/path

# Optional: Maximum file size (bytes)
MAX_FILE_SIZE=524288000

# Optional: Maximum album size (bytes)
MAX_ALBUM_SIZE=2147483648
```

#### Audio Processing
The application automatically configures FFmpeg for audio processing. For custom configurations, see `docs/AUDIO_SETUP.md`.

## 📊 Performance

### Benchmarks
- **Processing Speed**: ~2x real-time for most formats
- **Memory Usage**: <500MB for 20-track albums
- **Concurrent Files**: 3-5 simultaneous processing
- **File Size Limits**: 500MB per file, 2GB per album

### Optimization Tips
1. **Use FLAC/WAV** for best quality preservation
2. **Batch process** albums for consistency
3. **Monitor memory** usage with large files
4. **Clean temp files** regularly

## 🔧 Troubleshooting

### Common Issues

#### FFmpeg Not Found
```bash
# Run audio setup
npm run setup:audio

# Test audio environment
npm run test:audio
```

#### Memory Issues with Large Files
- Reduce concurrent processing
- Process files individually
- Increase Node.js memory limit:
  ```bash
  node --max-old-space-size=4096 server.js
  ```

#### Upload Failures
- Check file format support
- Verify file size limits
- Ensure sufficient disk space

### Debug Mode
Enable debug logging:
```bash
DEBUG=audio-normalizer:* npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FFmpeg** - Audio processing engine
- **EBU R128** - Loudness measurement standard
- **Next.js** - React framework
- **Tailwind CSS** - Styling framework
- **Vitest** - Testing framework

## 📞 Support

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

**Audio Normalizer** - Professional audio level normalization made simple.

Built with ❤️ using Next.js, TypeScript, and FFmpeg.