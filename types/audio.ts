// Core audio processing interfaces based on design document

/**
 * Provenienza dei valori di un'AudioAnalysis. Serve a non spacciare mai una
 * stima per una misura: la UI deve poter dire all'utente quanto fidarsi.
 *
 *  - 'measured'  → tutto misurato davvero (richiede un ffmpeg reale che
 *                  esegua il filtro `ebur128`; vedi core-04).
 *  - 'partial'   → contenitore reale (durata, sample rate, canali, formato,
 *                  letti con `music-metadata`) ma loudness NON misurata.
 *  - 'estimated' → nessun valore reale: fallback deterministico ricavato dal
 *                  file. Utile solo per far girare la UI, non per decidere.
 *
 * Opzionale per retrocompatibilità: se assente, tratta il dato come 'estimated'.
 */
export type AnalysisSource = 'measured' | 'partial' | 'estimated'

export interface AudioAnalysis {
  duration: number // secondi
  sampleRate: number // Hz
  channels: number
  peakLevel: number // dBFS
  rmsLevel: number // dB
  lufsIntegrated: number // LUFS (EBU R128 integrated)
  truePeak: number // dBTP
  hasClipping: boolean
  /**
   * Formato/estensione rilevato (es. "MP3", "WAV"). Opzionale: non tutti i
   * produttori lo popolano (l'anteprima client, ad esempio, può ometterlo).
   */
  format?: string
  /**
   * Loudness Range in LU (EBU R128 LRA). Opzionale: disponibile solo dagli
   * engine che eseguono una misura loudnorm reale (WASM/nativo), non
   * dall'anteprima basata sul gain.
   */
  loudnessRange?: number
  /**
   * Quanto di questa analisi è misurato davvero. Vedi {@link AnalysisSource}.
   * Assente = da trattare come 'estimated'.
   */
  source?: AnalysisSource
  /** Bitrate in bit/s, quando il contenitore lo dichiara. */
  bitrate?: number
}

/** True se l'analisi contiene valori di loudness realmente misurati. */
export function hasMeasuredLoudness(a: Pick<AudioAnalysis, 'source'>): boolean {
  return a.source === 'measured'
}

/**
 * Predizione dell'analisi dopo l'applicazione di un guadagno costante.
 * Un gain puro trasla tutti i livelli in dB della stessa quantità; LUFS/LRA
 * "veri" richiedono comunque una nuova misura (vedi engine WASM/nativo).
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
   * Livello target. L'unità dipende dal metodo:
   *  - method === 'peak'     → dBFS (tipicamente <= 0)
   *  - method === 'loudness' → LUFS (tipicamente tra -30 e -6)
   */
  targetLevel: number
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
  /** Percorso file di output (engine server/desktop). */
  outputPath?: string
  /** Blob di output (engine browser: l'anteprima non scrive su filesystem). */
  outputBlob?: Blob
  /** Object URL del blob di output (browser), pronto per <audio>/download. */
  outputUrl?: string
  gainApplied: number // dB
  finalLoudness: number // LUFS (o stima, per anteprime basate sul gain)
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