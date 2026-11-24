// Core audio processing interfaces based on design document

/**
 * Provenance of the values of an AudioAnalysis. It exists so that an estimate
 * is never passed off as a measurement: the UI must be able to tell the user how far to trust it.
 *
 *  - 'measured'  → everything really measured (requires a real ffmpeg that
 *                  runs the `ebur128` filter; see core-04).
 *  - 'partial'   → real container (duration, sample rate, channels, format,
 *                  read with `music-metadata`) but loudness NOT measured.
 *  - 'estimated' → no real value: deterministic fallback derived from the
 *                  file. Only useful to keep the UI running, not to decide.
 *
 * Optional for backward compatibility: if absent, treat the data as 'estimated'.
 */
export type AnalysisSource = 'measured' | 'partial' | 'estimated'

export interface AudioAnalysis {
  duration: number // seconds
  sampleRate: number // Hz
  channels: number
  peakLevel: number // dBFS
  rmsLevel: number // dB
  lufsIntegrated: number // LUFS (EBU R128 integrated)
  truePeak: number // dBTP
  hasClipping: boolean
  /**
   * Detected format/extension (e.g. "MP3", "WAV"). Optional: not all
   * producers fill it in (the client preview, for example, may omit it).
   */
  format?: string
  /**
   * Loudness Range in LU (EBU R128 LRA). Optional: only available from
   * engines that run a real loudnorm measurement (WASM/native), not
   * from the gain-based preview.
   */
  loudnessRange?: number
  /**
   * How much of this analysis is really measured. See {@link AnalysisSource}.
   * Absent = to be treated as 'estimated'.
   */
  source?: AnalysisSource
  /** Bitrate in bit/s, when the container declares it. */
  bitrate?: number
}

/** True if the analysis contains really measured loudness values. */
export function hasMeasuredLoudness(a: Pick<AudioAnalysis, 'source'>): boolean {
  return a.source === 'measured'
}

/**
 * Prediction of the analysis after applying a constant gain.
 * A pure gain shifts all dB levels by the same amount; "true"
 * LUFS/LRA still require a new measurement (see WASM/native engine).
 */
export interface AnalysisPrediction {
  peakLevel: number // dBFS
  rmsLevel: number // dB
  lufsIntegrated: number // LUFS
  truePeak: number // dBTP
  gainApplied: number // dB
}

export interface NormalizationOptions {
  method: 'peak' | 'loudness'
  /**
   * Target level. The unit depends on the method:
   *  - method === 'peak'     → dBFS (typically <= 0)
   *  - method === 'loudness' → LUFS (typically between -30 and -6)
   */
  targetLevel: number
  preserveFormat: boolean
  outputPath: string
}

export interface AudioProcessor {
  analyzeAudio(filePath: string): Promise<AudioAnalysis>
  normalizeAudio(filePath: string, options: NormalizationOptions): Promise<string>
  validateFormat(filePath: string): Promise<boolean>
  validateNormalizationOptions(options: NormalizationOptions): {
    isValid: boolean
    errors: string[]
  }
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

/** Info about an uploaded temporary file, returned by getTempFileInfo. */
export interface TempFileInfo {
  path: string
  size: number
  created: Date
  /**
   * Original file name, when known.
   * Optional: on disk temp files are saved with the fileId only, so
   * whoever reads this field must provide a fallback.
   */
  originalName?: string
}

export interface FileManager {
  uploadFiles(files: File[]): Promise<UploadResult[]>
  validateAudioFile(file: File): Promise<ValidationResult>
  createOutputDirectory(albumName: string): Promise<string>
  createOutputPath(fileName: string): Promise<string>
  preserveMetadata(sourcePath: string, targetPath: string): Promise<void>
  getTempFileInfo(fileId: string): Promise<TempFileInfo | null>
  cleanupFiles(filePaths: string[]): Promise<void>
  cleanupOldTempFiles(maxAgeHours?: number): Promise<void>
  fileSupportsMetadata(filePath: string): boolean
  extractFileMetadata(filePath: string): Promise<any | null>
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

/**
 * Outcome of processing an album.
 *
 * The fields inherited from ProcessingResult describe the album as a whole
 * (average loudness, average gain, total time); `fileResults` keeps
 * the outcome track by track, which used to be computed and then discarded —
 * the /api/normalize route looked for it and found `undefined`.
 */
export interface AlbumProcessingResult extends ProcessingResult {
  fileResults: ProcessingResult[]
  /** Number of tracks processed (= fileResults.length). */
  totalFiles: number
  /** Tracks completed successfully. */
  successfulFiles: number
  /** Failed tracks (totalFiles - successfulFiles). */
  failedFiles: number
  /** Error messages of the failed tracks, one per track. */
  errors: string[]
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
  processAlbum(files: AudioFile[], options: AlbumOptions): Promise<AlbumProcessingResult>
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
  /** Output file path (server/desktop engine). */
  outputPath?: string
  /** Output blob (browser engine: the preview does not write to the filesystem). */
  outputBlob?: Blob
  /** Object URL of the output blob (browser), ready for <audio>/download. */
  outputUrl?: string
  gainApplied: number // dB
  finalLoudness: number // LUFS (or estimate, for gain-based previews)
  processingTime: number // ms
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