// Core audio processing interfaces based on design document

export interface AudioAnalysis {
  duration: number
  sampleRate: number
  channels: number
  peakLevel: number // dB
  rmsLevel: number // dB
  lufsIntegrated: number // LUFS
  truePeak: number // dBTP
  hasClipping: boolean
}

export interface NormalizationOptions {
  method: 'peak' | 'loudness'
  targetLevel: number // dB or LUFS
  preserveFormat: boolean
  outputPath: string
}

export interface AudioProcessor {
  analyzeAudio(filePath: string): Promise<AudioAnalysis>
  normalizeAudio(filePath: string, options: NormalizationOptions): Promise<string>
  validateFormat(filePath: string): Promise<boolean>
}

export interface UploadResult {
  id: string
  originalName: string
  tempPath: string
  size: number
  format: string
}

export interface ValidationResult {
  isValid: boolean
  format?: string
  error?: string
}

export interface FileManager {
  uploadFiles(files: File[]): Promise<UploadResult[]>
  validateAudioFile(file: File): Promise<ValidationResult>
  createOutputDirectory(albumName: string): Promise<string>
  preserveMetadata(sourcePath: string, targetPath: string): Promise<void>
}

export interface AlbumOptions {
  normalizationMethod: 'peak' | 'loudness'
  targetLevel: number
  maintainRelativeLoudness: boolean
  outputFormat: string
}

export interface ProcessingResult {
  fileId: string
  success: boolean
  outputPath?: string
  originalLoudness: number
  finalLoudness: number
  gainApplied: number
  processingTime: number
  error?: string
}

export interface AlbumLoudnessData {
  averageLoudness: number
  loudnessRange: number
  files: Array<{
    id: string
    loudness: number
  }>
}

export interface ProcessingReport {
  totalFiles: number
  successfulFiles: number
  failedFiles: number
  totalProcessingTime: number
  averageGainApplied: number
  results: ProcessingResult[]
}

export interface AlbumProcessor {
  processAlbum(files: AudioFile[], options: AlbumOptions): Promise<ProcessingResult>
  calculateAlbumLoudness(files: AudioFile[]): Promise<AlbumLoudnessData>
  generateProcessingReport(results: ProcessingResult[]): ProcessingReport
}

export interface AudioFile {
  id: string
  name: string
  originalPath: string
  tempPath?: string
  size: number
  format: string
  analysis?: AudioAnalysis
  normalizationResult?: NormalizationResult
  status: 'uploaded' | 'analyzing' | 'ready' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface NormalizationResult {
  success: boolean
  outputPath?: string
  gainApplied: number
  finalLoudness: number
  processingTime: number
  error?: string
}

export interface Album {
  id: string
  name: string
  files: AudioFile[]
  settings: AlbumSettings
  overallLoudness?: number
  processingStatus: 'pending' | 'analyzing' | 'ready' | 'processing' | 'completed'
  createdAt: Date
  completedAt?: Date
}

export interface AlbumSettings {
  normalizationMethod: 'peak' | 'loudness'
  targetLevel: number
  outputFormat: string
  maintainRelativeLoudness: boolean
  outputDirectory: string
}

export interface ErrorRecoveryStrategy {
  retryableErrors: string[]
  maxRetries: number
  backoffStrategy: 'linear' | 'exponential'
  fallbackOptions: FallbackOption[]
}

export interface FallbackOption {
  name: string
  description: string
  action: () => Promise<void>
}