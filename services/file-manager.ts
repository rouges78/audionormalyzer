import { FileManager, UploadResult, ValidationResult } from '@/types/audio'
import { promises as fs, constants as fsConstants } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * FileManager service implementation
 * Handles upload, validation and organization of audio files
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
   * Ensures the required directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
      await fs.mkdir(this.outputDir, { recursive: true })
    } catch (error) {
      console.warn('Error creating directories:', error)
    }
  }

  /**
   * Uploads and processes multiple audio files
   * @param files Array of files to upload
   * @returns Promise<UploadResult[]> Upload results
   */
  async uploadFiles(files: File[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw new Error('Nessun file fornito per l\'upload')
    }

    // Check the total album size
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

    // If there are errors, clean up the successfully uploaded files and throw
    if (errors.length > 0) {
      await this.cleanupFiles(results.map(r => r.tempPath))
      throw new Error(`Errori durante l'upload:\n${errors.join('\n')}`)
    }

    return results
  }

  /**
   * Uploads a single audio file
   */
  private async uploadSingleFile(file: File): Promise<UploadResult> {
    // Preliminary validation
    const validation = await this.validateAudioFile(file)
    if (!validation.isValid) {
      throw new Error(validation.error || 'File non valido')
    }

    // Generate a unique ID and temporary path
    const fileId = randomUUID()
    const fileExtension = this.getFileExtension(file.name)
    const tempFileName = `${fileId}${fileExtension}`
    const tempPath = path.join(this.tempDir, tempFileName)

    try {
      // Ensure the temporary directory exists
      await this.ensureDirectoriesExist()

      // Convert File to Buffer and save
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(tempPath, buffer)

      // Check that the file was written correctly
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
      // Clean up the file on error
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Errore durante l'upload di ${file.name}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    }
  }

  /**
   * Validates an audio file
   * @param file File to validate
   * @returns Promise<ValidationResult> Validation result
   */
  async validateAudioFile(file: File): Promise<ValidationResult> {
    try {
      // Check that it is a valid File object
      if (!file || (typeof file !== 'object')) {
        return {
          isValid: false,
          error: 'Oggetto file non valido'
        }
      }

      // In the test environment, accept mock objects that have the required properties
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

      // Check the file name
      if (!file.name || file.name.trim() === '') {
        return {
          isValid: false,
          error: 'Nome file mancante'
        }
      }

      // Check the file size
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

      // Check the format
      const formatInfo = this.detectAudioFormat(file.name)
      if (!formatInfo.isSupported) {
        return {
          isValid: false,
          error: `Formato non supportato. Formati supportati: ${this.supportedFormats.join(', ')}`
        }
      }

      // Check the MIME type if available
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
   * Creates an output directory for an album
   * @param albumName Album name
   * @returns Promise<string> Path of the created directory
   */
  async createOutputDirectory(albumName: string): Promise<string> {
    if (!albumName || albumName.trim() === '') {
      throw new Error('Nome album richiesto')
    }

    // Sanitize the album name for the filesystem
    const sanitizedName = this.sanitizeFileName(albumName)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dirName = `${sanitizedName}_${timestamp}`
    const outputPath = path.join(this.outputDir, dirName)

    try {
      await fs.mkdir(outputPath, { recursive: true })
      
      // Check that the directory was created
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
   * Builds the output path for a single normalized file,
   * making sure the output directory exists.
   *
   * The /api/normalize route had always called this method, but it did not exist:
   * the bug was masked because fileManager was typed `any` there and the tests
   * replace it with a mock. In production it would have blown up with
   * "fileManager.createOutputPath is not a function".
   *
   * @param fileName Desired file name (it gets sanitized)
   * @returns Absolute path of the output file
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
   * Preserves the metadata from a source file to a destination one
   * @param sourcePath Path of the source file
   * @param targetPath Path of the destination file
   */
  async preserveMetadata(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.access(sourcePath, fsConstants.R_OK)
      await fs.access(targetPath, fsConstants.R_OK)
      
      // Use MetadataManager to preserve the metadata
      const { createMetadataManager } = await import('./metadata-manager')
      const metadataManager = createMetadataManager()
      
      // Check that both files support metadata
      if (!metadataManager.supportsMetadata(sourcePath)) {
        console.warn(`Source file ${sourcePath} does not support metadata`)
        return
      }
      
      if (!metadataManager.supportsMetadata(targetPath)) {
        console.warn(`Destination file ${targetPath} does not support metadata`)
        return
      }
      
      // Preserve metadata with default options
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
   * Cleans up temporary files
   * @param filePaths Array of file paths to delete
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
      console.warn('Errors while cleaning up files:', errors.join(', '))
    }
  }

  /**
   * Cleans up all temporary files older than a certain time
   * @param maxAgeHours Maximum age in hours (default: 24)
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
          // Ignore errors for individual files
        }
      }
    } catch (error) {
      console.warn('Error while cleaning up temporary files:', error)
    }
  }

  /**
   * Gets info about a temporary file
   * @param fileId File ID
   * @returns File info or null if not found
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

  // Private utility methods

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
      'audio/wave',      // alternative WAV
      'audio/x-wav',     // alternative WAV
      'audio/flac',      // FLAC
      'audio/x-flac',    // alternative FLAC
      'audio/aac',       // AAC
      'audio/mp4',       // M4A
      'audio/x-m4a',     // alternative M4A
      'audio/ogg',       // OGG
      'audio/vorbis'     // OGG Vorbis
    ]

    return validMimeTypes.includes(mimeType.toLowerCase())
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')  // Characters invalid for the filesystem
      .replace(/\s+/g, '_')          // Multiple spaces
      .replace(/_{2,}/g, '_')        // Multiple underscores
      .replace(/^_|_$/g, '')         // Leading/trailing underscores
      .substring(0, 100)             // Limit length
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
   * Extracts metadata from an audio file
   * @param filePath File path
   * @returns Extracted metadata or null if not supported
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
      console.warn(`Error extracting metadata from ${filePath}:`, error)
      return null
    }
  }

  /**
   * Checks whether a file supports metadata
   * @param filePath File path
   * @returns True if the file supports metadata
   */
  fileSupportsMetadata(filePath: string): boolean {
    const supportedExtensions = ['.mp3', '.flac', '.ogg', '.m4a', '.aac']
    const extension = path.extname(filePath).toLowerCase()
    return supportedExtensions.includes(extension)
  }

  /**
   * Gets info about the metadata supported for a file
   * @param filePath File path
   * @returns Metadata support info
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
 * Factory function to create a FileManager instance
 */
export function createFileManager(): FileManager {
  return new FileManagerImpl()
}