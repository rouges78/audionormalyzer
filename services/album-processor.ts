import { 
  AlbumProcessor, 
  AudioFile, 
  AlbumOptions,
  ProcessingResult,
  AlbumProcessingResult,
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
 * Handles batch processing of complete albums with consistency analysis
 */
export class AlbumProcessorImpl implements AlbumProcessor {
  private audioProcessor: AudioProcessorImpl

  /**
   * @param audioProcessor Audio processor to use. Injectable: it used to be
   * built in here and there was no way to replace it, so tests that
   * mocked their own AudioProcessorImpl instance had no
   * effect on the album processor and ended up analyzing nonexistent files.
   */
  constructor(audioProcessor: AudioProcessorImpl = new AudioProcessorImpl()) {
    this.audioProcessor = audioProcessor
  }

  /**
   * Processes a complete album applying consistent normalization
   * @param files Array of the album's audio files
   * @param options Processing options for the album
   * @returns Promise<ProcessingResult> Result of the album processing
   */
  async processAlbum(files: AudioFile[], options: AlbumOptions): Promise<AlbumProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Input validation
      if (!files || files.length === 0) {
        throw new Error('Nessun file audio fornito per il processing')
      }

      // Analyze all files if not already analyzed
      const analyzedFiles = await this.ensureFilesAnalyzed(files)
      
      // Compute the album loudness for consistency
      const albumLoudness = await this.calculateAlbumLoudness(analyzedFiles)
      
      // Determine the optimal target level for the album
      const optimizedTargetLevel = this.calculateOptimalTargetLevel(
        albumLoudness, 
        options
      )
      
      // Process each file keeping relative consistency
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
          // Handle errors for individual files without stopping the whole album
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
      
      // Compute aggregate statistics for the album
      const avgGain = successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + r.gainApplied, 0) / successfulResults.length
        : 0
      
      const avgFinalLoudness = successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.finalLoudness, 0) / successfulResults.length
        : 0

      return {
        fileId: `album-${Date.now()}`, // ID for the whole album
        success: successfulResults.length > 0,
        originalLoudness: albumLoudness.averageLoudness,
        finalLoudness: avgFinalLoudness,
        gainApplied: avgGain,
        processingTime,
        error: successfulResults.length === 0 ? 'Nessun file processato con successo' : undefined,
        fileResults: results,
        totalFiles: results.length,
        successfulFiles: successfulResults.length,
        failedFiles: results.length - successfulResults.length,
        errors: results
          .filter(r => !r.success)
          .map(r => r.error ?? 'Errore sconosciuto')
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
        error: error instanceof Error ? error.message : 'Errore sconosciuto nel processing dell\'album',
        fileResults: [],
        totalFiles: files?.length ?? 0,
        successfulFiles: 0,
        failedFiles: files?.length ?? 0,
        errors: [error instanceof Error ? error.message : 'Errore sconosciuto nel processing dell\'album']
      }
    }
  }

  /**
   * Ensures that all files have a completed audio analysis
   * @param files Array of audio files
   * @returns Promise<AudioFile[]> Files with completed analysis
   */
  private async ensureFilesAnalyzed(files: AudioFile[]): Promise<AudioFile[]> {
    const analyzedFiles: AudioFile[] = []
    
    for (const file of files) {
      if (!file.analysis) {
        try {
          // Use the temporary path if available, otherwise the original one
          const filePath = file.tempPath || file.originalPath
          const analysis = await this.audioProcessor.analyzeAudio(filePath)
          
          analyzedFiles.push({
            ...file,
            analysis,
            status: 'ready'
          })
        } catch (error) {
          // Mark the file as errored but continue with the others
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
   * Computes the overall album loudness for consistency analysis
   * @param files Array of analyzed audio files
   * @returns Promise<AlbumLoudnessData> Album loudness data
   */
  async calculateAlbumLoudness(files: AudioFile[]): Promise<AlbumLoudnessData> {
    try {
      const validFiles = files.filter(f => f.analysis && f.status !== 'error')
      
      if (validFiles.length === 0) {
        throw new Error('Nessun file valido per calcolo loudness album')
      }

      // Compute the album average loudness
      const loudnessValues = validFiles.map(f => f.analysis!.lufsIntegrated)
      const averageLoudness = loudnessValues.reduce((sum, val) => sum + val, 0) / loudnessValues.length
      
      // Compute the loudness range (difference between max and min)
      const maxLoudness = Math.max(...loudnessValues)
      const minLoudness = Math.min(...loudnessValues)
      const loudnessRange = maxLoudness - minLoudness
      
      // Create a file-loudness mapping for reference
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
   * Computes the optimal target level for the album taking consistency into account
   * @param albumLoudness Album loudness data
   * @param options Processing options
   * @returns Optimized target level
   */
  private calculateOptimalTargetLevel(
    albumLoudness: AlbumLoudnessData, 
    options: AlbumOptions
  ): number {
    let targetLevel = options.targetLevel
    
    if (options.maintainRelativeLoudness && options.normalizationMethod === 'loudness') {
      // To keep relative loudness, use the album average as the reference
      // and apply a conservative offset if needed
      const currentAverage = albumLoudness.averageLoudness
      const targetOffset = options.targetLevel - currentAverage
      
      // Limit the offset to avoid overly drastic changes
      const maxOffset = 6.0 // dB
      const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, targetOffset))
      
      targetLevel = currentAverage + limitedOffset
      
      // Log if the offset was limited
      if (Math.abs(limitedOffset - targetOffset) > 0.1) {
        console.warn(
          `Target level optimized from ${options.targetLevel} to ${targetLevel.toFixed(1)} LUFS ` +
          `to keep album consistency (range: ${albumLoudness.loudnessRange.toFixed(1)} LU)`
        )
      }
    }
    
    return targetLevel
  }

  /**
   * Processes a single album file keeping consistency
   * @param file Audio file to process
   * @param options Processing options
   * @param targetLevel Target level optimized for the album
   * @param albumLoudness Album loudness data
   * @returns Promise<ProcessingResult> Result of processing the file
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

      // Compute a specific target for this file if we keep relative loudness
      let fileTargetLevel = targetLevel
      
      if (options.maintainRelativeLoudness && options.normalizationMethod === 'loudness') {
        // Keep the file's position relative to the album average
        const currentRelativePosition = file.analysis.lufsIntegrated - albumLoudness.averageLoudness
        fileTargetLevel = targetLevel + currentRelativePosition
        
        // Limit the target to avoid extreme values
        const maxDeviation = 3.0 // LUFS
        const limitedTarget = Math.max(
          targetLevel - maxDeviation,
          Math.min(targetLevel + maxDeviation, fileTargetLevel)
        )
        
        if (Math.abs(limitedTarget - fileTargetLevel) > 0.1) {
          console.warn(
            `Target for file ${file.name} limited from ${fileTargetLevel.toFixed(1)} to ${limitedTarget.toFixed(1)} LUFS`
          )
        }
        
        fileTargetLevel = limitedTarget
      }

      // Prepare the normalization options
      const inputPath = file.tempPath || file.originalPath
      const outputPath = this.generateOutputPath(file, options.outputFormat)
      
      const normalizationOptions: NormalizationOptions = {
        method: options.normalizationMethod,
        targetLevel: fileTargetLevel,
        preserveFormat: options.outputFormat === 'original',
        outputPath
      }

      // Apply normalization
      const resultPath = await this.audioProcessor.normalizeAudio(inputPath, normalizationOptions)
      
      // Analyze the result to verify the processing
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
   * Generates the output path for a processed file
   * @param file Original audio file
   * @param outputFormat Desired output format
   * @returns Output path
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
   * Generates a complete report of the album processing
   * @param results Array of processing results
   * @returns ProcessingReport Detailed report
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
   * Validates the album processing options
   * @param options Options to validate
   * @returns Validation result
   */
  validateAlbumOptions(options: AlbumOptions): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    // Validate the normalization method
    if (!['peak', 'loudness'].includes(options.normalizationMethod)) {
      errors.push('Metodo di normalizzazione non valido. Deve essere "peak" o "loudness"')
    }
    
    // Validate the target level
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
    
    // Validate the output format
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
   * Computes consistency statistics for the album
   * @param files Analyzed album files
   * @returns Consistency statistics
   */
  calculateConsistencyStats(files: AudioFile[]): {
    loudnessConsistency: number // 0-1, where 1 is perfectly consistent
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

    // Compute loudness consistency (based on standard deviation)
    const loudnessValues = validFiles.map(f => f.analysis!.lufsIntegrated)
    const avgLoudness = loudnessValues.reduce((sum, val) => sum + val, 0) / loudnessValues.length
    const variance = loudnessValues.reduce((sum, val) => sum + Math.pow(val - avgLoudness, 2), 0) / loudnessValues.length
    const stdDev = Math.sqrt(variance)
    
    // Consistency: the lower the standard deviation, the higher the consistency
    const loudnessConsistency = Math.max(0, 1 - (stdDev / 10)) // Normalized over a 10 LUFS range
    
    // Compute dynamic range variation
    const dynamicRanges = validFiles.map(f => f.analysis!.peakLevel - f.analysis!.rmsLevel)
    const maxDR = Math.max(...dynamicRanges)
    const minDR = Math.min(...dynamicRanges)
    const dynamicRangeVariation = maxDR - minDR
    
    // Recommend a method based on the analysis
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
    
    // Additional notes based on the analysis
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
   * Cleans up temporary processing data (for tests)
   */
  private async cleanupProcessingData(): Promise<void> {
    // Cleanup implementation for tests
    // In the future it could clean caches, temporary files, etc.
  }
}

/**
 * Factory function to create an AlbumProcessor instance
 */
export function createAlbumProcessor(): AlbumProcessor {
  return new AlbumProcessorImpl()
}