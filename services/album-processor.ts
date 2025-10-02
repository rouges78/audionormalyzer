import { 
  AlbumProcessor, 
  AudioFile, 
  AlbumOptions, 
  ProcessingResult, 
  AlbumLoudnessData, 
  ProcessingReport,
  AudioAnalysis,
  NormalizationOptions
} from '@/types/audio'
import { AudioProcessorImpl } from './audio-processor'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * AlbumProcessor service implementation
 * Gestisce il processing batch di album completi con analisi di consistenza
 */
export class AlbumProcessorImpl implements AlbumProcessor {
  private audioProcessor: AudioProcessorImpl

  constructor() {
    this.audioProcessor = new AudioProcessorImpl()
  }

  /**
   * Processa un album completo applicando normalizzazione consistente
   * @param files Array di file audio dell'album
   * @param options Opzioni di processing per l'album
   * @returns Promise<ProcessingResult> Risultato del processing dell'album
   */
  async processAlbum(files: AudioFile[], options: AlbumOptions): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Validazione input
      if (!files || files.length === 0) {
        throw new Error('Nessun file audio fornito per il processing')
      }

      // Analizza tutti i file se non già analizzati
      const analyzedFiles = await this.ensureFilesAnalyzed(files)
      
      // Calcola loudness dell'album per consistenza
      const albumLoudness = await this.calculateAlbumLoudness(analyzedFiles)
      
      // Determina target level ottimale per l'album
      const optimizedTargetLevel = this.calculateOptimalTargetLevel(
        albumLoudness, 
        options
      )
      
      // Processa ogni file mantenendo consistenza relativa
      const results: ProcessingResult[] = []
      
      for (const file of analyzedFiles) {
        try {
          const fileResult = await this.processAlbumFile(
            file, 
            options, 
            optimizedTargetLevel,
            albumLoudness
          )
          results.push(fileResult)
        } catch (error) {
          // Gestisce errori per singoli file senza fermare l'intero album
          results.push({
            fileId: file.id,
            success: false,
            originalLoudness: file.analysis?.lufsIntegrated || 0,
            finalLoudness: 0,
            gainApplied: 0,
            processingTime: 0,
            error: error instanceof Error ? error.message : 'Errore sconosciuto'
          })
        }
      }

      const processingTime = Date.now() - startTime
      const successfulResults = results.filter(r => r.success)
      
      // Calcola statistiche aggregate per l'album
      const avgGain = successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + r.gainApplied, 0) / successfulResults.length
        : 0
      
      const avgFinalLoudness = successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.finalLoudness, 0) / successfulResults.length
        : 0

      return {
        fileId: `album-${Date.now()}`, // ID per l'intero album
        success: successfulResults.length > 0,
        originalLoudness: albumLoudness.averageLoudness,
        finalLoudness: avgFinalLoudness,
        gainApplied: avgGain,
        processingTime,
        error: successfulResults.length === 0 ? 'Nessun file processato con successo' : undefined
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      return {
        fileId: `album-error-${Date.now()}`,
        success: false,
        originalLoudness: 0,
        finalLoudness: 0,
        gainApplied: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Errore sconosciuto nel processing dell\'album'
      }
    }
  }

  /**
   * Assicura che tutti i file abbiano analisi audio completata
   * @param files Array di file audio
   * @returns Promise<AudioFile[]> File con analisi completata
   */
  private async ensureFilesAnalyzed(files: AudioFile[]): Promise<AudioFile[]> {
    const analyzedFiles: AudioFile[] = []
    
    for (const file of files) {
      if (!file.analysis) {
        try {
          // Usa il path temporaneo se disponibile, altrimenti quello originale
          const filePath = file.tempPath || file.originalPath
          const analysis = await this.audioProcessor.analyzeAudio(filePath)
          
          analyzedFiles.push({
            ...file,
            analysis,
            status: 'ready'
          })
        } catch (error) {
          // Marca il file come errore ma continua con gli altri
          analyzedFiles.push({
            ...file,
            status: 'error',
            error: `Analisi fallita: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
          })
        }
      } else {
        analyzedFiles.push(file)
      }
    }
    
    return analyzedFiles
  }

  /**
   * Calcola la loudness complessiva dell'album per analisi di consistenza
   * @param files Array di file audio analizzati
   * @returns Promise<AlbumLoudnessData> Dati di loudness dell'album
   */
  async calculateAlbumLoudness(files: AudioFile[]): Promise<AlbumLoudnessData> {
    try {
      const validFiles = files.filter(f => f.analysis && f.status !== 'error')
      
      if (validFiles.length === 0) {
        throw new Error('Nessun file valido per calcolo loudness album')
      }

      // Calcola loudness media dell'album
      const loudnessValues = validFiles.map(f => f.analysis!.lufsIntegrated)
      const averageLoudness = loudnessValues.reduce((sum, val) => sum + val, 0) / loudnessValues.length
      
      // Calcola range di loudness (differenza tra max e min)
      const maxLoudness = Math.max(...loudnessValues)
      const minLoudness = Math.min(...loudnessValues)
      const loudnessRange = maxLoudness - minLoudness
      
      // Crea mapping file-loudness per riferimento
      const filesLoudness = validFiles.map(f => ({
        id: f.id,
        loudness: f.analysis!.lufsIntegrated
      }))

      return {
        averageLoudness,
        loudnessRange,
        files: filesLoudness
      }
    } catch (error) {
      throw new Error(`Calcolo loudness album fallito: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Calcola il target level ottimale per l'album considerando la consistenza
   * @param albumLoudness Dati di loudness dell'album
   * @param options Opzioni di processing
   * @returns Target level ottimizzato
   */
  private calculateOptimalTargetLevel(
    albumLoudness: AlbumLoudnessData, 
    options: AlbumOptions
  ): number {
    let targetLevel = options.targetLevel
    
    if (options.maintainRelativeLoudness && options.normalizationMethod === 'loudness') {
      // Per mantenere loudness relativa, usa la media dell'album come riferimento
      // e applica un offset conservativo se necessario
      const currentAverage = albumLoudness.averageLoudness
      const targetOffset = options.targetLevel - currentAverage
      
      // Limita l'offset per evitare cambiamenti troppo drastici
      const maxOffset = 6.0 // dB
      const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, targetOffset))
      
      targetLevel = currentAverage + limitedOffset
      
      // Log se l'offset è stato limitato
      if (Math.abs(limitedOffset - targetOffset) > 0.1) {
        console.warn(
          `Target level ottimizzato da ${options.targetLevel} a ${targetLevel.toFixed(1)} LUFS ` +
          `per mantenere consistenza album (range: ${albumLoudness.loudnessRange.toFixed(1)} LU)`
        )
      }
    }
    
    return targetLevel
  }

  /**
   * Processa un singolo file dell'album mantenendo consistenza
   * @param file File audio da processare
   * @param options Opzioni di processing
   * @param targetLevel Target level ottimizzato per l'album
   * @param albumLoudness Dati di loudness dell'album
   * @returns Promise<ProcessingResult> Risultato del processing del file
   */
  private async processAlbumFile(
    file: AudioFile,
    options: AlbumOptions,
    targetLevel: number,
    albumLoudness: AlbumLoudnessData
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      if (!file.analysis) {
        throw new Error('File non analizzato')
      }

      if (file.status === 'error') {
        throw new Error(file.error || 'File in stato di errore')
      }

      // Calcola target specifico per questo file se manteniamo loudness relativa
      let fileTargetLevel = targetLevel
      
      if (options.maintainRelativeLoudness && options.normalizationMethod === 'loudness') {
        // Mantiene la posizione relativa del file rispetto alla media dell'album
        const currentRelativePosition = file.analysis.lufsIntegrated - albumLoudness.averageLoudness
        fileTargetLevel = targetLevel + currentRelativePosition
        
        // Limita il target per evitare valori estremi
        const maxDeviation = 3.0 // LUFS
        const limitedTarget = Math.max(
          targetLevel - maxDeviation,
          Math.min(targetLevel + maxDeviation, fileTargetLevel)
        )
        
        if (Math.abs(limitedTarget - fileTargetLevel) > 0.1) {
          console.warn(
            `Target per file ${file.name} limitato da ${fileTargetLevel.toFixed(1)} a ${limitedTarget.toFixed(1)} LUFS`
          )
        }
        
        fileTargetLevel = limitedTarget
      }

      // Prepara opzioni di normalizzazione
      const inputPath = file.tempPath || file.originalPath
      const outputPath = this.generateOutputPath(file, options.outputFormat)
      
      const normalizationOptions: NormalizationOptions = {
        method: options.normalizationMethod,
        targetLevel: fileTargetLevel,
        preserveFormat: options.outputFormat === 'original',
        outputPath
      }

      // Applica normalizzazione
      const resultPath = await this.audioProcessor.normalizeAudio(inputPath, normalizationOptions)
      
      // Analizza il risultato per verificare il processing
      const finalAnalysis = await this.audioProcessor.analyzeAudio(resultPath)
      
      const processingTime = Date.now() - startTime
      const gainApplied = fileTargetLevel - file.analysis.lufsIntegrated
      
      return {
        fileId: file.id,
        success: true,
        outputPath: resultPath,
        originalLoudness: file.analysis.lufsIntegrated,
        finalLoudness: finalAnalysis.lufsIntegrated,
        gainApplied,
        processingTime
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      return {
        fileId: file.id,
        success: false,
        originalLoudness: file.analysis?.lufsIntegrated || 0,
        finalLoudness: 0,
        gainApplied: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      }
    }
  }

  /**
   * Genera il path di output per un file processato
   * @param file File audio originale
   * @param outputFormat Formato di output desiderato
   * @returns Path di output
   */
  private generateOutputPath(file: AudioFile, outputFormat: string): string {
    const outputDir = path.join(process.cwd(), 'output', 'normalized')
    const baseName = path.parse(file.name).name
    
    let extension: string
    if (outputFormat === 'original') {
      extension = path.extname(file.name)
    } else {
      const formatMap: Record<string, string> = {
        'mp3': '.mp3',
        'wav': '.wav',
        'flac': '.flac',
        'aac': '.aac'
      }
      extension = formatMap[outputFormat] || '.mp3'
    }
    
    return path.join(outputDir, `${baseName}_normalized${extension}`)
  }

  /**
   * Genera un report completo del processing dell'album
   * @param results Array di risultati di processing
   * @returns ProcessingReport Report dettagliato
   */
  generateProcessingReport(results: ProcessingResult[]): ProcessingReport {
    const totalFiles = results.length
    const successfulFiles = results.filter(r => r.success).length
    const failedFiles = totalFiles - successfulFiles
    
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0)
    
    const successfulResults = results.filter(r => r.success)
    const averageGainApplied = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.gainApplied, 0) / successfulResults.length
      : 0

    return {
      totalFiles,
      successfulFiles,
      failedFiles,
      totalProcessingTime,
      averageGainApplied,
      results
    }
  }

  /**
   * Valida le opzioni di processing dell'album
   * @param options Opzioni da validare
   * @returns Risultato della validazione
   */
  validateAlbumOptions(options: AlbumOptions): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    // Valida metodo di normalizzazione
    if (!['peak', 'loudness'].includes(options.normalizationMethod)) {
      errors.push('Metodo di normalizzazione non valido. Deve essere "peak" o "loudness"')
    }
    
    // Valida target level
    if (options.normalizationMethod === 'peak') {
      if (options.targetLevel > 0) {
        errors.push('Target level per peak deve essere <= 0 dB')
      }
      if (options.targetLevel < -60) {
        errors.push('Target level per peak troppo basso (< -60 dB)')
      }
    } else if (options.normalizationMethod === 'loudness') {
      if (options.targetLevel > -6) {
        errors.push('Target level per loudness deve essere <= -6 LUFS')
      }
      if (options.targetLevel < -50) {
        errors.push('Target level per loudness troppo basso (< -50 LUFS)')
      }
    }
    
    // Valida formato output
    const validFormats = ['original', 'mp3', 'wav', 'flac', 'aac']
    if (!validFormats.includes(options.outputFormat)) {
      errors.push(`Formato output non valido. Formati supportati: ${validFormats.join(', ')}`)
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calcola statistiche di consistenza per l'album
   * @param files File dell'album analizzati
   * @returns Statistiche di consistenza
   */
  calculateConsistencyStats(files: AudioFile[]): {
    loudnessConsistency: number // 0-1, dove 1 è perfettamente consistente
    dynamicRangeVariation: number // Variazione in dB
    recommendedMethod: 'peak' | 'loudness'
    notes: string[]
  } {
    const validFiles = files.filter(f => f.analysis && f.status !== 'error')
    const notes: string[] = []
    
    if (validFiles.length === 0) {
      return {
        loudnessConsistency: 0,
        dynamicRangeVariation: 0,
        recommendedMethod: 'loudness',
        notes: ['Nessun file valido per analisi consistenza']
      }
    }

    // Calcola consistenza loudness (basata su deviazione standard)
    const loudnessValues = validFiles.map(f => f.analysis!.lufsIntegrated)
    const avgLoudness = loudnessValues.reduce((sum, val) => sum + val, 0) / loudnessValues.length
    const variance = loudnessValues.reduce((sum, val) => sum + Math.pow(val - avgLoudness, 2), 0) / loudnessValues.length
    const stdDev = Math.sqrt(variance)
    
    // Consistenza: più bassa la deviazione standard, più alta la consistenza
    const loudnessConsistency = Math.max(0, 1 - (stdDev / 10)) // Normalizzato su 10 LUFS di range
    
    // Calcola variazione dynamic range
    const dynamicRanges = validFiles.map(f => f.analysis!.peakLevel - f.analysis!.rmsLevel)
    const maxDR = Math.max(...dynamicRanges)
    const minDR = Math.min(...dynamicRanges)
    const dynamicRangeVariation = maxDR - minDR
    
    // Raccomanda metodo basato su analisi
    let recommendedMethod: 'peak' | 'loudness' = 'loudness'
    
    if (stdDev < 2.0) {
      notes.push('Album già abbastanza consistente in loudness')
      if (dynamicRangeVariation > 6.0) {
        recommendedMethod = 'peak'
        notes.push('Raccomandato peak normalization per preservare dynamic range')
      }
    } else {
      notes.push('Album necessita normalizzazione loudness per consistenza')
      if (dynamicRangeVariation < 3.0) {
        notes.push('Dynamic range uniforme, loudness normalization ideale')
      }
    }
    
    // Note aggiuntive basate su analisi
    const clippingFiles = validFiles.filter(f => f.analysis!.hasClipping).length
    if (clippingFiles > 0) {
      notes.push(`${clippingFiles} file con clipping rilevato`)
    }
    
    const loudFiles = validFiles.filter(f => f.analysis!.lufsIntegrated > -14).length
    if (loudFiles > 0) {
      notes.push(`${loudFiles} file molto loud (> -14 LUFS)`)
    }
    
    return {
      loudnessConsistency,
      dynamicRangeVariation,
      recommendedMethod,
      notes
    }
  }

  /**
   * Pulisce i dati temporanei di processing (per test)
   */
  private async cleanupProcessingData(): Promise<void> {
    // Implementazione di cleanup per test
    // In futuro potrebbe pulire cache, file temporanei, etc.
  }
}

/**
 * Factory function per creare istanza AlbumProcessor
 */
export function createAlbumProcessor(): AlbumProcessor {
  return new AlbumProcessorImpl()
}