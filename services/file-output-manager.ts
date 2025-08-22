import { promises as fs, constants as fsConstants } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createFileManager } from './file-manager'
import { ProcessingResult, AudioFile } from '@/types/audio'

/**
 * Interface for file output management operations
 */
export interface FileOutputManager {
  saveProcessedFile(
    processedFilePath: string,
    originalFile: AudioFile,
    outputDirectory: string,
    preserveOriginalName?: boolean
  ): Promise<string>
  
  organizeAlbumOutput(
    results: ProcessingResult[],
    originalFiles: AudioFile[],
    albumName: string,
    outputDirectory: string
  ): Promise<AlbumOutputResult>
  
  prepareDownload(
    filePaths: string[],
    downloadType: 'single' | 'album'
  ): Promise<DownloadPreparation>
  
  cleanupProcessedFiles(filePaths: string[], maxAgeHours?: number): Promise<void>
  
  getProcessedFileInfo(filePath: string): Promise<ProcessedFileInfo | null>
  
  validateOutputDirectory(directory: string): Promise<ValidationResult>
}

export interface AlbumOutputResult {
  outputDirectory: string
  savedFiles: Array<{
    originalId: string
    originalName: string
    outputPath: string
    size: number
  }>
  totalSize: number
  processingReport: string
}

export interface DownloadPreparation {
  downloadId: string
  files: Array<{
    path: string
    name: string
    size: number
  }>
  totalSize: number
  expiresAt: Date
}

export interface ProcessedFileInfo {
  path: string
  originalName: string
  size: number
  format: string
  created: Date
  lastAccessed: Date
}

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * FileOutputManager implementation
 * Handles processed file storage, organization, and download preparation
 */
export class FileOutputManagerImpl implements FileOutputManager {
  private readonly outputBaseDir = path.join(process.cwd(), 'output', 'processed')
  private readonly downloadBaseDir = path.join(process.cwd(), 'output', 'downloads')
  private readonly fileManager = createFileManager()

  constructor() {
    this.ensureDirectoriesExist()
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.outputBaseDir, { recursive: true })
      await fs.mkdir(this.downloadBaseDir, { recursive: true })
    } catch (error) {
      console.warn('Error creating output directories:', error)
    }
  }

  /**
   * Save a processed audio file with proper organization and metadata preservation
   * @param processedFilePath Path to the processed audio file
   * @param originalFile Original file information
   * @param outputDirectory Target output directory
   * @param preserveOriginalName Whether to preserve the original filename
   * @returns Promise<string> Path to the saved file
   */
  async saveProcessedFile(
    processedFilePath: string,
    originalFile: AudioFile,
    outputDirectory: string,
    preserveOriginalName: boolean = true
  ): Promise<string> {
    try {
      // Validate inputs
      await fs.access(processedFilePath, fsConstants.R_OK)
      await this.validateOutputDirectory(outputDirectory)

      // Determine output filename
      const outputFileName = preserveOriginalName 
        ? this.sanitizeFileName(originalFile.name)
        : this.generateProcessedFileName(originalFile)

      const outputPath = path.join(outputDirectory, outputFileName)

      // Copy processed file to output location
      await fs.copyFile(processedFilePath, outputPath)

      // Preserve metadata from original file if possible
      if (originalFile.originalPath && this.fileManager.fileSupportsMetadata(outputPath)) {
        try {
          await this.fileManager.preserveMetadata(originalFile.originalPath, outputPath)
        } catch (error) {
          console.warn(`Could not preserve metadata for ${outputFileName}:`, error)
        }
      }

      // Verify file was saved correctly
      const stats = await fs.stat(outputPath)
      if (stats.size === 0) {
        throw new Error('Saved file is empty')
      }

      return outputPath
    } catch (error) {
      throw new Error(`Failed to save processed file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Organize album output with proper file structure and processing report
   * @param results Processing results for all files
   * @param originalFiles Original file information
   * @param albumName Name of the album
   * @param outputDirectory Base output directory
   * @returns Promise<AlbumOutputResult> Organization result with file paths and report
   */
  async organizeAlbumOutput(
    results: ProcessingResult[],
    originalFiles: AudioFile[],
    albumName: string,
    outputDirectory: string
  ): Promise<AlbumOutputResult> {
    try {
      // Create album-specific directory
      const sanitizedAlbumName = this.sanitizeFileName(albumName)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const albumDir = path.join(outputDirectory, `${sanitizedAlbumName}_${timestamp}`)
      
      await fs.mkdir(albumDir, { recursive: true })

      const savedFiles: AlbumOutputResult['savedFiles'] = []
      let totalSize = 0

      // Process each successful result
      for (const result of results) {
        if (!result.success || !result.outputPath) {
          continue
        }

        const originalFile = originalFiles.find(f => f.id === result.fileId)
        if (!originalFile) {
          console.warn(`Original file not found for result ${result.fileId}`)
          continue
        }

        try {
          // Save file to album directory
          const savedPath = await this.saveProcessedFile(
            result.outputPath,
            originalFile,
            albumDir,
            true
          )

          const stats = await fs.stat(savedPath)
          savedFiles.push({
            originalId: originalFile.id,
            originalName: originalFile.name,
            outputPath: savedPath,
            size: stats.size
          })

          totalSize += stats.size
        } catch (error) {
          console.error(`Failed to save file ${originalFile.name}:`, error)
        }
      }

      // Generate processing report
      const processingReport = this.generateProcessingReport(results, originalFiles, albumName)
      const reportPath = path.join(albumDir, 'processing_report.txt')
      await fs.writeFile(reportPath, processingReport, 'utf-8')

      return {
        outputDirectory: albumDir,
        savedFiles,
        totalSize,
        processingReport
      }
    } catch (error) {
      throw new Error(`Failed to organize album output: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Prepare files for download with temporary organization
   * @param filePaths Array of file paths to prepare for download
   * @param downloadType Type of download (single file or album)
   * @returns Promise<DownloadPreparation> Download preparation details
   */
  async prepareDownload(
    filePaths: string[],
    downloadType: 'single' | 'album'
  ): Promise<DownloadPreparation> {
    try {
      if (!filePaths || filePaths.length === 0) {
        throw new Error('No files provided for download preparation')
      }

      // Generate unique download ID
      const downloadId = randomUUID()
      const downloadDir = path.join(this.downloadBaseDir, downloadId)
      await fs.mkdir(downloadDir, { recursive: true })

      const files: DownloadPreparation['files'] = []
      let totalSize = 0

      // Prepare each file
      for (const filePath of filePaths) {
        try {
          await fs.access(filePath, fsConstants.R_OK)
          const stats = await fs.stat(filePath)
          const fileName = path.basename(filePath)

          // For single downloads, copy file to download directory
          if (downloadType === 'single') {
            const downloadPath = path.join(downloadDir, fileName)
            await fs.copyFile(filePath, downloadPath)
            
            files.push({
              path: downloadPath,
              name: fileName,
              size: stats.size
            })
          } else {
            // For album downloads, keep original paths for ZIP creation
            files.push({
              path: filePath,
              name: fileName,
              size: stats.size
            })
          }

          totalSize += stats.size
        } catch (error) {
          console.warn(`Could not prepare file ${filePath} for download:`, error)
        }
      }

      if (files.length === 0) {
        throw new Error('No valid files could be prepared for download')
      }

      // Set expiration time (24 hours from now)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      return {
        downloadId,
        files,
        totalSize,
        expiresAt
      }
    } catch (error) {
      throw new Error(`Failed to prepare download: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean up processed files based on age or explicit file list
   * @param filePaths Specific file paths to clean up, or empty for age-based cleanup
   * @param maxAgeHours Maximum age in hours for automatic cleanup (default: 48)
   */
  async cleanupProcessedFiles(filePaths: string[], maxAgeHours: number = 48): Promise<void> {
    try {
      if (filePaths && filePaths.length > 0) {
        // Clean up specific files
        await this.cleanupSpecificFiles(filePaths)
      } else {
        // Clean up old files
        await this.cleanupOldFiles(maxAgeHours)
      }
    } catch (error) {
      console.warn('Error during processed files cleanup:', error)
    }
  }

  /**
   * Get information about a processed file
   * @param filePath Path to the processed file
   * @returns Promise<ProcessedFileInfo | null> File information or null if not found
   */
  async getProcessedFileInfo(filePath: string): Promise<ProcessedFileInfo | null> {
    try {
      await fs.access(filePath, fsConstants.R_OK)
      const stats = await fs.stat(filePath)
      
      const fileName = path.basename(filePath)
      const format = this.detectFileFormat(fileName)

      return {
        path: filePath,
        originalName: fileName,
        size: stats.size,
        format,
        created: stats.birthtime,
        lastAccessed: stats.atime
      }
    } catch {
      return null
    }
  }

  /**
   * Validate that an output directory is suitable for saving files
   * @param directory Directory path to validate
   * @returns Promise<ValidationResult> Validation result
   */
  async validateOutputDirectory(directory: string): Promise<ValidationResult> {
    try {
      if (!directory || directory.trim() === '') {
        return {
          isValid: false,
          error: 'Output directory path is required'
        }
      }

      // Check if directory exists, create if it doesn't
      try {
        await fs.access(directory, fsConstants.W_OK)
      } catch {
        try {
          await fs.mkdir(directory, { recursive: true })
        } catch (error) {
          return {
            isValid: false,
            error: `Cannot create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      }

      // Verify write permissions
      const testFile = path.join(directory, '.write_test')
      try {
        await fs.writeFile(testFile, 'test')
        await fs.unlink(testFile)
      } catch (error) {
        return {
          isValid: false,
          error: `No write permission in output directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: `Directory validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Private utility methods

  /**
   * Clean up specific files
   */
  private async cleanupSpecificFiles(filePaths: string[]): Promise<void> {
    const errors: string[] = []

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    if (errors.length > 0) {
      console.warn('Errors during specific file cleanup:', errors.join(', '))
    }
  }

  /**
   * Clean up old files based on age
   */
  private async cleanupOldFiles(maxAgeHours: number): Promise<void> {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)
    
    await this.cleanupDirectoryByAge(this.outputBaseDir, cutoffTime)
    await this.cleanupDirectoryByAge(this.downloadBaseDir, cutoffTime)
  }

  /**
   * Clean up files in a directory by age
   */
  private async cleanupDirectoryByAge(directory: string, cutoffTime: number): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name)
        
        try {
          const stats = await fs.stat(fullPath)
          
          if (stats.mtime.getTime() < cutoffTime) {
            if (entry.isDirectory()) {
              await fs.rmdir(fullPath, { recursive: true })
            } else {
              await fs.unlink(fullPath)
            }
          }
        } catch {
          // Ignore errors for individual files/directories
        }
      }
    } catch (error) {
      console.warn(`Error cleaning up directory ${directory}:`, error)
    }
  }

  /**
   * Generate a filename for processed files
   */
  private generateProcessedFileName(originalFile: AudioFile): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = path.extname(originalFile.name)
    const baseName = path.basename(originalFile.name, extension)
    
    return `${this.sanitizeFileName(baseName)}_processed_${timestamp}${extension}`
  }

  /**
   * Sanitize filename for filesystem compatibility
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')  // Invalid filesystem characters
      .replace(/\s+/g, '_')          // Multiple spaces
      .replace(/_{2,}/g, '_')        // Multiple underscores
      .replace(/^_|_$/g, '')         // Leading/trailing underscores
      .substring(0, 200)             // Limit length
  }

  /**
   * Detect file format from filename
   */
  private detectFileFormat(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase()
    const formatMap: Record<string, string> = {
      '.mp3': 'MP3',
      '.wav': 'WAV',
      '.flac': 'FLAC',
      '.aac': 'AAC',
      '.m4a': 'M4A/AAC',
      '.ogg': 'OGG Vorbis'
    }
    
    return formatMap[extension] || 'Unknown'
  }

  /**
   * Generate processing report for album
   */
  private generateProcessingReport(
    results: ProcessingResult[],
    originalFiles: AudioFile[],
    albumName: string
  ): string {
    const timestamp = new Date().toISOString()
    const successfulResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    let report = `Audio Normalization Processing Report\n`
    report += `=====================================\n\n`
    report += `Album: ${albumName}\n`
    report += `Processing Date: ${timestamp}\n`
    report += `Total Files: ${results.length}\n`
    report += `Successful: ${successfulResults.length}\n`
    report += `Failed: ${failedResults.length}\n\n`

    if (successfulResults.length > 0) {
      report += `Successful Processing Results:\n`
      report += `------------------------------\n`
      
      for (const result of successfulResults) {
        const originalFile = originalFiles.find(f => f.id === result.fileId)
        const fileName = originalFile?.name || `File ${result.fileId}`
        
        report += `\n${fileName}:\n`
        report += `  Original Loudness: ${result.originalLoudness.toFixed(2)} LUFS\n`
        report += `  Final Loudness: ${result.finalLoudness.toFixed(2)} LUFS\n`
        report += `  Gain Applied: ${result.gainApplied.toFixed(2)} dB\n`
        report += `  Processing Time: ${result.processingTime.toFixed(2)}s\n`
      }
    }

    if (failedResults.length > 0) {
      report += `\n\nFailed Processing Results:\n`
      report += `--------------------------\n`
      
      for (const result of failedResults) {
        const originalFile = originalFiles.find(f => f.id === result.fileId)
        const fileName = originalFile?.name || `File ${result.fileId}`
        
        report += `\n${fileName}:\n`
        report += `  Error: ${result.error || 'Unknown error'}\n`
      }
    }

    // Add summary statistics
    if (successfulResults.length > 0) {
      const totalProcessingTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0)
      const averageGain = successfulResults.reduce((sum, r) => sum + r.gainApplied, 0) / successfulResults.length
      
      report += `\n\nSummary Statistics:\n`
      report += `------------------\n`
      report += `Total Processing Time: ${totalProcessingTime.toFixed(2)}s\n`
      report += `Average Gain Applied: ${averageGain.toFixed(2)} dB\n`
    }

    return report
  }
}

/**
 * Factory function to create FileOutputManager instance
 */
export function createFileOutputManager(): FileOutputManager {
  return new FileOutputManagerImpl()
}