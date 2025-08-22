# Audio Processing Setup Guide

This document describes the audio processing infrastructure setup for the audio normalizer application.

## Dependencies Installed

### Core Audio Processing Libraries

1. **@ffmpeg/ffmpeg** - Web-based FFmpeg for audio format conversion and manipulation
2. **@ffmpeg/util** - Utility functions for FFmpeg operations
3. **loudness** - LUFS/EBU R128 loudness analysis and normalization
4. **audio-buffer-utils** - Audio buffer manipulation utilities

### TypeScript Support

Custom type definitions have been created for all audio processing libraries:
- `types/ffmpeg.d.ts` - @ffmpeg/ffmpeg and @ffmpeg/util types
- `types/loudness.d.ts` - loudness library types  
- `types/audio-buffer-utils.d.ts` - audio buffer utilities types
- `types/audio.ts` - Core audio processing interfaces

## Project Structure

```
├── types/                    # TypeScript definitions
│   ├── audio.ts             # Core audio interfaces
│   ├── ffmpeg.d.ts          # FFmpeg library types
│   ├── loudness.d.ts        # Loudness library types
│   └── audio-buffer-utils.d.ts # Audio buffer utilities types
├── config/
│   └── audio.config.ts      # Audio processing configuration
├── scripts/
│   ├── setup-audio-env.js   # Environment setup script
│   └── test-audio-setup.js  # Setup verification script
├── temp/
│   └── audio/               # Temporary audio files
├── output/
│   └── audio/               # Processed audio output
└── docs/
    └── AUDIO_SETUP.md       # This documentation
```

## Configuration

### Environment Variables (.env.local)

```env
AUDIO_TEMP_DIR=./temp/audio
AUDIO_OUTPUT_DIR=./output/audio
AUDIO_MAX_FILE_SIZE=104857600
AUDIO_MAX_CONCURRENT=3
AUDIO_PROCESSING_TIMEOUT=300000
```

### Audio Configuration (config/audio.config.ts)

- **Supported Formats**: MP3, WAV, FLAC, AAC, M4A, OGG
- **File Size Limits**: 100MB per file, 2GB per album
- **Processing Limits**: 3 concurrent files, 5-minute timeout
- **Normalization Defaults**: -1.0 dB peak, -23.0 LUFS loudness

## Core Interfaces

### AudioAnalysis
```typescript
interface AudioAnalysis {
  duration: number
  sampleRate: number
  channels: number
  peakLevel: number      // dB
  rmsLevel: number       // dB
  lufsIntegrated: number // LUFS
  truePeak: number       // dBTP
  hasClipping: boolean
}
```

### NormalizationOptions
```typescript
interface NormalizationOptions {
  method: 'peak' | 'loudness'
  targetLevel: number    // dB or LUFS
  preserveFormat: boolean
  outputPath: string
}
```

### AudioProcessor Service
```typescript
interface AudioProcessor {
  analyzeAudio(filePath: string): Promise<AudioAnalysis>
  normalizeAudio(filePath: string, options: NormalizationOptions): Promise<string>
  validateFormat(filePath: string): Promise<boolean>
}
```

## Development Environment

### Prerequisites

1. **Node.js** 18+ with pnpm package manager
2. **FFmpeg** installed system-wide (for native operations)
3. **TypeScript** 5+ for type checking

### Setup Commands

```bash
# Install dependencies
pnpm install

# Run environment setup
node scripts/setup-audio-env.js

# Verify setup
node scripts/test-audio-setup.js

# Start development
pnpm dev
```

### FFmpeg Installation

- **Windows**: Download from https://ffmpeg.org/download.html
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg`

## Usage Examples

### Basic Audio Analysis
```typescript
import { AudioProcessor } from '@/types/audio'

const processor: AudioProcessor = new AudioProcessorImpl()
const analysis = await processor.analyzeAudio('./input/song.mp3')
console.log(`Loudness: ${analysis.lufsIntegrated} LUFS`)
```

### Normalization
```typescript
const options: NormalizationOptions = {
  method: 'loudness',
  targetLevel: -23.0, // LUFS
  preserveFormat: true,
  outputPath: './output/normalized.mp3'
}

const outputPath = await processor.normalizeAudio('./input/song.mp3', options)
```

## Error Handling

The system includes comprehensive error handling for:
- Unsupported audio formats
- File size limitations
- Processing timeouts
- Memory constraints
- FFmpeg execution errors

## Performance Considerations

- **Concurrent Processing**: Limited to 3 files simultaneously
- **Memory Management**: Automatic cleanup of temporary files
- **Timeout Handling**: 5-minute processing timeout per file
- **Progress Tracking**: Real-time progress updates via WebSocket

## Testing

Run the setup verification:
```bash
node scripts/test-audio-setup.js
```

This verifies:
- Directory structure
- Library imports
- FFmpeg availability
- Configuration validity

## Next Steps

After completing this setup, you can proceed to implement:
1. AudioProcessor service (Task 2.1)
2. Format validation (Task 2.2)
3. File management system (Task 3.1)
4. Normalization algorithms (Task 4.1-4.2)

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Install FFmpeg system-wide
2. **Native module errors**: Run `pnpm rebuild`
3. **Permission errors**: Check directory permissions for temp/output folders
4. **Memory issues**: Reduce MAX_CONCURRENT_PROCESSING in config

### Support

For issues with this setup, check:
1. Node.js version compatibility
2. FFmpeg installation
3. File system permissions
4. Available disk space for temporary files