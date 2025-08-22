/**
 * Audio processing configuration
 * Centralizes all audio-related settings and constants
 */

export const AUDIO_CONFIG = {
  // Supported audio formats
  SUPPORTED_FORMATS: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] as const,
  
  // File size limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_ALBUM_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
  
  // Processing limits
  MAX_CONCURRENT_PROCESSING: 3,
  PROCESSING_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  // Audio analysis settings
  ANALYSIS: {
    SAMPLE_RATE: 44100,
    CHANNELS: 2,
    BIT_DEPTH: 16,
    CLIPPING_THRESHOLD: -0.1, // dBFS
    SILENCE_THRESHOLD: -60, // dBFS
  },
  
  // Normalization settings
  NORMALIZATION: {
    PEAK: {
      DEFAULT_TARGET: -1.0, // dBFS
      MIN_TARGET: -6.0,
      MAX_TARGET: 0.0,
    },
    LOUDNESS: {
      DEFAULT_TARGET: -23.0, // LUFS (EBU R128 standard)
      MIN_TARGET: -30.0,
      MAX_TARGET: -16.0,
      TRUE_PEAK_LIMIT: -1.0, // dBTP
    },
  },
  
  // Directory paths
  PATHS: {
    TEMP: process.env.AUDIO_TEMP_DIR || './temp/audio',
    OUTPUT: process.env.AUDIO_OUTPUT_DIR || './output/audio',
    LOGS: './logs',
  },
  
  // FFmpeg settings
  FFMPEG: {
    TIMEOUT: 300000, // 5 minutes
    QUALITY: 'high',
    PRESERVE_METADATA: true,
  },
  
  // Error handling
  ERROR_HANDLING: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // ms
    BACKOFF_MULTIPLIER: 2,
  },
} as const

export type AudioFormat = typeof AUDIO_CONFIG.SUPPORTED_FORMATS[number]

export interface AudioProcessingConfig {
  maxFileSize: number
  maxConcurrentProcessing: number
  processingTimeout: number
  tempDir: string
  outputDir: string
}

export const getAudioConfig = (): AudioProcessingConfig => ({
  maxFileSize: AUDIO_CONFIG.MAX_FILE_SIZE,
  maxConcurrentProcessing: AUDIO_CONFIG.MAX_CONCURRENT_PROCESSING,
  processingTimeout: AUDIO_CONFIG.PROCESSING_TIMEOUT,
  tempDir: AUDIO_CONFIG.PATHS.TEMP,
  outputDir: AUDIO_CONFIG.PATHS.OUTPUT,
})

// Validation functions
export const isValidAudioFormat = (format: string): format is AudioFormat => {
  return AUDIO_CONFIG.SUPPORTED_FORMATS.includes(format.toLowerCase() as AudioFormat)
}

export const isValidFileSize = (size: number): boolean => {
  return size > 0 && size <= AUDIO_CONFIG.MAX_FILE_SIZE
}

export const isValidTargetLevel = (level: number, method: 'peak' | 'loudness'): boolean => {
  if (method === 'peak') {
    return level >= AUDIO_CONFIG.NORMALIZATION.PEAK.MIN_TARGET && 
           level <= AUDIO_CONFIG.NORMALIZATION.PEAK.MAX_TARGET
  } else {
    return level >= AUDIO_CONFIG.NORMALIZATION.LOUDNESS.MIN_TARGET && 
           level <= AUDIO_CONFIG.NORMALIZATION.LOUDNESS.MAX_TARGET
  }
}