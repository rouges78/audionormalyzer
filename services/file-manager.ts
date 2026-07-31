import { FileManager, UploadResult, ValidationResult } from '@/types/audio'
import { promises as fs, constants as fsConstants } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * FileManager service implementation
 * Gestisce upload, validazione e organizzazione dei file audio
 */
export class FileManagerImpl implements FileManager {
  private readonly tempDir = path.join(process.cwd(), 'temp', 'audio')
  private readonly outputDir = path.join(process.cwd(), 'output', 'audio')
  private readonly supportedFormats = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg']
  private readonly maxFileSize = 500 * 1024 * 1024 // 500MB
  private readonly maxAlbumSize = 2 * 1024 * 1024 * 1024 // 2GB

  constructor() {
    this.ensureDirectoriesExist()
  }

  /**
   * Assicura che le directory necessarie esistano
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
      await fs.mkdir(this.outputDir, { recursive: true })
    } catch (error) {
      console.warn('Errore nella creazione delle directory:', error)
    }
  }

  /**
   * Carica e processa file audio multipli
   * @param files Array di file da caricare
   * @returns Promise<UploadResult[]> Risultati dell'upload
   */
  async uploadFiles(files: File[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw new Error('Nessun file fornito per l\'upload')
    }

    // Verifica dimensione totale album
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > this.maxAlbumSize) {
      throw new Error(`Dimensione totale album troppo grande: ${this.formatFileSize(totalSize)} (limite: ${this.formatFileSize(this.maxAlbumSize)})`)
    }

    const results: UploadResult[] = []
    const errors: string[] = []

    for (const file of files) {
      try {
        const result = await this.uploadSingleFile(file)
        results.push(result)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
        errors.push(`${file.name}: ${errorMessage}`)
      }
    }

    // Se ci sono errori, pulisci i file caricati con successo e lancia errore
    if (errors.length > 0) {
      await this.cleanupFiles(results.map(r => r.tempPath))
      throw new Error(`Errori durante l'upload:\n${errors.join('\n')}`)
    }

    return results
  }

  /**
   * Carica un singolo file audio
   */
  private async uploadSingleFile(file: File): Promise<UploadResult> {
    // Validazione preliminare
    const validation = await this.validateAudioFile(file)
    if (!validation.isValid) {
      throw new Error(validation.error || 'File non valido')
    }

    // Genera ID univoco e percorso temporaneo
    const fileId = randomUUID()
    const fileExtension = this.getFileExtension(file.name)
    const tempFileName = `${fileId}${fileExtension}`
    const tempPath = path.join(this.tempDir, tempFileName)

    try {
      // Assicura che la directory temporanea esista
      await this.ensureDirectoriesExist()

      // Converte File in Buffer e salva
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(tempPath, buffer)

      // Verifica che il file sia stato scritto correttamente
      const stats = await fs.stat(tempPath)
      if (stats.size !== file.size) {
        throw new Error('Errore durante la scrittura del file')
      }

      return {
        id: fileId,
        originalName: file.name,
        tempPath,
        size: file.size,
        format: validation.format || 'Unknown'
      }
    } catch (error) {
      // Pulisci il file in caso di errore
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignora errori di cleanup
      }
      throw new Error(`Errore durante l'upload di ${file.name}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Valida un file audio
   * @param file File da validare
   * @returns Promise<ValidationResult> Risultato della validazione
   */
  async validateAudioFile(file: File): Promise<ValidationResult> {
    try {
      // Verifica che sia un oggetto File valido
      if (!file || (typeof file !== 'object')) {
        return {
          isValid: false,
          error: 'Oggetto file non valido'
        }
      }

      // In ambiente di test, accetta oggetti mock che hanno le proprietà necessarie
      if (process.env.NODE_ENV === 'test') {
        if (!('name' in file) || !('size' in file)) {
          return {
            isValid: false,
            error: 'Oggetto file non valido'
          }
        }
      } else if (!(file instanceof File)) {
        return {
          isValid: false,
          error: 'Oggetto file non valido'
        }
      }

      // Verifica nome file
      if (!file.name || file.name.trim() === '') {
        return {
          isValid: false,
          error: 'Nome file mancante'
        }
      }

      // Verifica dimensione file
      if (file.size === 0) {
        return {
          isValid: false,
          error: 'File vuoto'
        }
      }

      if (file.size > this.maxFileSize) {
        return {
          isValid: false,
          error: `File troppo grande: ${this.formatFileSize(file.size)} (limite: ${this.formatFileSize(this.maxFileSize)})`
        }
      }

      // Verifica formato
      const formatInfo = this.detectAudioFormat(file.name)
      if (!formatInfo.isSupported) {
        return {
          isValid: false,
          error: `Formato non supportato. Formati supportati: ${this.supportedFormats.join(', ')}`
        }
      }

      // Verifica MIME type se disponibile
      if (file.type && !this.isValidMimeType(file.type)) {
        return {
          isValid: false,
          error: `MIME type non supportato: ${file.type}`
        }
      }

      return {
        isValid: true,
        format: formatInfo.format
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Errore durante la validazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
      }
    }
  }

  /**
   * Crea directory di output per un album
   * @param albumName Nome dell'album
   * @returns Promise<string> Percorso della directory creata
   */
  async createOutputDirectory(albumName: string): Promise<string> {
    if (!albumName || albumName.trim() === '') {
      throw new Error('Nome album richiesto')
    }

    // Sanitizza il nome dell'album per il filesystem
    const sanitizedName = this.sanitizeFileName(albumName)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dirName = `${sanitizedName}_${timestamp}`
    const outputPath = path.join(this.outputDir, dirName)

    try {
      await fs.mkdir(outputPath, { recursive: true })
      
      // Verifica che la directory sia stata creata
      const stats = await fs.stat(outputPath)
      if (!stats.isDirectory()) {
        throw new Error('Impossibile creare la directory di output')
      }

      return outputPath
    } catch (error) {
      throw new Error(`Errore nella creazione della directory di output: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Costruisce il percorso di uscita per un singolo file normalizzato,
   * assicurandosi che la directory di output esista.
   *
   * La rotta /api/normalize chiamava questo metodo da sempre, ma non esisteva:
   * il bug era mascherato perché il fileManager vi era tipizzato `any` e i test
   * lo sostituiscono con un mock. In produzione sarebbe esploso con
   * "fileManager.createOutputPath is not a function".
   *
   * @param fileName Nome del file desiderato (viene sanificato)
   * @returns Percorso assoluto del file di uscita
   */
  async createOutputPath(fileName: string): Promise<string> {
    if (!fileName || fileName.trim() === '') {
      throw new Error('Nome file richiesto')
    }

    await fs.mkdir(this.outputDir, { recursive: true })

    const extension = this.getFileExtension(fileName)
    const baseName = this.sanitizeFileName(
      extension ? fileName.slice(0, -extension.length) : fileName
    )
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    return path.join(this.outputDir, `${baseName}_${timestamp}${extension}`)
  }

  /**
   * Preserva i metadati da un file sorgente a uno di destinazione
   * @param sourcePath Percorso del file sorgente
   * @param targetPath Percorso del file di destinazione
   */
  async preserveMetadata(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.access(sourcePath, fsConstants.R_OK)
      await fs.access(targetPath, fsConstants.R_OK)
      
      // Usa MetadataManager per preservare i metadati
      const { createMetadataManager } = await import('./metadata-manager')
      const metadataManager = createMetadataManager()
      
      // Verifica che entrambi i file supportino metadati
      if (!metadataManager.supportsMetadata(sourcePath)) {
        console.warn(`File sorgente ${sourcePath} non supporta metadati`)
        return
      }
      
      if (!metadataManager.supportsMetadata(targetPath)) {
        console.warn(`File destinazione ${targetPath} non supporta metadati`)
        return
      }
      
      // Preserva metadati con opzioni predefinite
      await metadataManager.preserveMetadata(sourcePath, targetPath, {
        preserveArtwork: true,
        preserveComments: true,
        preserveCustomTags: false,
        overwriteExisting: true
      })
      
    } catch (error) {
      throw new Error(`Errore nella preservazione metadati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Pulisce file temporanei
   * @param filePaths Array di percorsi file da eliminare
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    const errors: string[] = []

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
      }
    }

    if (errors.length > 0) {
      console.warn('Errori durante la pulizia dei file:', errors.join(', '))
    }
  }

  /**
   * Pulisce tutti i file temporanei più vecchi di un certo tempo
   * @param maxAgeHours Età massima in ore (default: 24)
   */
  async cleanupOldTempFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir)
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        try {
          const stats = await fs.stat(filePath)
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath)
          }
        } catch {
          // Ignora errori per file individuali
        }
      }
    } catch (error) {
      console.warn('Errore durante la pulizia dei file temporanei:', error)
    }
  }

  /**
   * Ottiene informazioni su un file temporaneo
   * @param fileId ID del file
   * @returns Informazioni sul file o null se non trovato
   */
  async getTempFileInfo(fileId: string): Promise<{
    path: string
    size: number
    created: Date
  } | null> {
    try {
      const files = await fs.readdir(this.tempDir)
      const matchingFile = files.find(file => file.startsWith(fileId))
      
      if (!matchingFile) {
        return null
      }

      const filePath = path.join(this.tempDir, matchingFile)
      const stats = await fs.stat(filePath)

      return {
        path: filePath,
        size: stats.size,
        created: stats.birthtime
      }
    } catch {
      return null
    }
  }

  // Metodi di utilità privati

  private detectAudioFormat(fileName: string): {
    isSupported: boolean
    format?: string
    extension?: string
  } {
    if (!fileName || typeof fileName !== 'string') {
      return { isSupported: false }
    }

    const lowerFileName = fileName.toLowerCase()
    const formatMap = {
      '.mp3': 'MP3',
      '.wav': 'WAV',
      '.flac': 'FLAC',
      '.aac': 'AAC',
      '.m4a': 'M4A/AAC',
      '.ogg': 'OGG Vorbis'
    }

    for (const [ext, format] of Object.entries(formatMap)) {
      if (lowerFileName.endsWith(ext)) {
        return {
          isSupported: true,
          format,
          extension: ext
        }
      }
    }

    return { isSupported: false }
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot !== -1 ? fileName.substring(lastDot) : ''
  }

  private isValidMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'audio/mpeg',      // MP3
      'audio/wav',       // WAV
      'audio/wave',      // WAV alternativo
      'audio/x-wav',     // WAV alternativo
      'audio/flac',      // FLAC
      'audio/x-flac',    // FLAC alternativo
      'audio/aac',       // AAC
      'audio/mp4',       // M4A
      'audio/x-m4a',     // M4A alternativo
      'audio/ogg',       // OGG
      'audio/vorbis'     // OGG Vorbis
    ]

    return validMimeTypes.includes(mimeType.toLowerCase())
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')  // Caratteri non validi per filesystem
      .replace(/\s+/g, '_')          // Spazi multipli
      .replace(/_{2,}/g, '_')        // Underscore multipli
      .replace(/^_|_$/g, '')         // Underscore all'inizio/fine
      .substring(0, 100)             // Limita lunghezza
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * Estrae metadati da un file audio
   * @param filePath Percorso del file
   * @returns Metadati estratti o null se non supportati
   */
  async extractFileMetadata(filePath: string): Promise<any | null> {
    try {
      const { createMetadataManager } = await import('./metadata-manager')
      const metadataManager = createMetadataManager()
      
      if (!metadataManager.supportsMetadata(filePath)) {
        return null
      }
      
      return await metadataManager.extractMetadata(filePath)
    } catch (error) {
      console.warn(`Errore nell'estrazione metadati da ${filePath}:`, error)
      return null
    }
  }

  /**
   * Verifica se un file supporta metadati
   * @param filePath Percorso del file
   * @returns True se il file supporta metadati
   */
  fileSupportsMetadata(filePath: string): boolean {
    const supportedExtensions = ['.mp3', '.flac', '.ogg', '.m4a', '.aac']
    const extension = path.extname(filePath).toLowerCase()
    return supportedExtensions.includes(extension)
  }

  /**
   * Ottiene informazioni sui metadati supportati per un file
   * @param filePath Percorso del file
   * @returns Informazioni sul supporto metadati
   */
  async getMetadataSupport(filePath: string): Promise<{
    format: string
    supportsBasicTags: boolean
    supportsArtwork: boolean
    supportsCustomTags: boolean
    readOnly: boolean
  }> {
    try {
      const { createMetadataManager } = await import('./metadata-manager')
      const metadataManager = createMetadataManager()
      return metadataManager.getMetadataSupport(filePath)
    } catch (error) {
      return {
        format: 'Error',
        supportsBasicTags: false,
        supportsArtwork: false,
        supportsCustomTags: false,
        readOnly: true
      }
    }
  }
}

/**
 * Factory function per creare istanza FileManager
 */
export function createFileManager(): FileManager {
  return new FileManagerImpl()
}