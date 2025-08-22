import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { FileOutputManagerImpl } from '../file-output-manager'
import { AudioFile, ProcessingResult } from '@/types/audio'

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    access: vi.fn(),
    copyFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn()
  },
  constants: {
    R_OK: 4,
    W_OK: 2
  }
}))

// Mock file manager
vi.mock('../file-manager', () => ({
  createFileManager: () => ({
    preserveMetadata: vi.fn(),
    fileSupportsMetadata: vi.fn().mockReturnValue(true)
  })
}))

describe('FileOutputManager', () => {
  let fileOutputManager: FileOutputManagerImpl
  const mockFs = fs as any

  beforeEach(() => {
    fileOutputManager = new FileOutputManagerImpl()
    vi.clearAllMocks()
    
    // Default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)
    mockFs.copyFile.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      atime: new Date(),
      mtime: new Date(),
      isDirectory: () => false
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('saveProcessedFile', () => {
    const mockProcessedFilePath = '/temp/processed.mp3'
    const mockOriginalFile: AudioFile = {
      id: 'test-id',
      name: 'test-song.mp3',
      originalPath: '/temp/original.mp3',
      size: 1024,
      format: 'MP3',
      status: 'completed'
    }
    const mockOutputDirectory = '/output/test'

    it('should save processed file successfully', async () => {
      const result = await fileOutputManager.saveProcessedFile(
        mockProcessedFilePath,
        mockOriginalFile,
        mockOutputDirectory
      )

      expect(mockFs.access).toHaveBeenCalledWith(mockProcessedFilePath, 4)
      expect(mockFs.copyFile).toHaveBeenCalledWith(
        mockProcessedFilePath,
        expect.stringContaining('test-song.mp3')
      )
      expect(result).toContain('test-song.mp3')
    })

    it('should generate new filename when preserveOriginalName is false', async () => {
      const result = await fileOutputManager.saveProcessedFile(
        mockProcessedFilePath,
        mockOriginalFile,
        mockOutputDirectory,
        false
      )

      expect(result).toContain('processed')
      expect(result).toContain('.mp3')
    })

    it('should handle file access errors', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'))

      await expect(
        fileOutputManager.saveProcessedFile(
          mockProcessedFilePath,
          mockOriginalFile,
          mockOutputDirectory
        )
      ).rejects.toThrow('Failed to save processed file')
    })

    it('should handle empty saved files', async () => {
      mockFs.stat.mockResolvedValue({ size: 0 })

      await expect(
        fileOutputManager.saveProcessedFile(
          mockProcessedFilePath,
          mockOriginalFile,
          mockOutputDirectory
        )
      ).rejects.toThrow('Saved file is empty')
    })

    it('should sanitize filenames with invalid characters', async () => {
      const fileWithInvalidChars: AudioFile = {
        ...mockOriginalFile,
        name: 'test<>song|?.mp3'
      }

      const result = await fileOutputManager.saveProcessedFile(
        mockProcessedFilePath,
        fileWithInvalidChars,
        mockOutputDirectory
      )

      expect(result).toContain('test_song_.mp3')
    })
  })

  describe('organizeAlbumOutput', () => {
    const mockResults: ProcessingResult[] = [
      {
        fileId: 'file1',
        success: true,
        outputPath: '/temp/processed1.mp3',
        originalLoudness: -20,
        finalLoudness: -18,
        gainApplied: 2,
        processingTime: 5.5
      },
      {
        fileId: 'file2',
        success: true,
        outputPath: '/temp/processed2.mp3',
        originalLoudness: -22,
        finalLoudness: -18,
        gainApplied: 4,
        processingTime: 6.2
      },
      {
        fileId: 'file3',
        success: false,
        originalLoudness: -19,
        finalLoudness: 0,
        gainApplied: 0,
        processingTime: 0,
        error: 'Processing failed'
      }
    ]

    const mockOriginalFiles: AudioFile[] = [
      {
        id: 'file1',
        name: 'song1.mp3',
        originalPath: '/temp/song1.mp3',
        size: 1024,
        format: 'MP3',
        status: 'completed'
      },
      {
        id: 'file2',
        name: 'song2.mp3',
        originalPath: '/temp/song2.mp3',
        size: 2048,
        format: 'MP3',
        status: 'completed'
      },
      {
        id: 'file3',
        name: 'song3.mp3',
        originalPath: '/temp/song3.mp3',
        size: 1536,
        format: 'MP3',
        status: 'error'
      }
    ]

    it('should organize album output successfully', async () => {
      const result = await fileOutputManager.organizeAlbumOutput(
        mockResults,
        mockOriginalFiles,
        'Test Album',
        '/output/test'
      )

      expect(result.savedFiles).toHaveLength(2) // Only successful files
      expect(result.totalSize).toBe(2048) // 1024 + 1024 from mocked stats
      expect(result.processingReport).toContain('Test Album')
      expect(result.processingReport).toContain('Total Files: 3')
      expect(result.processingReport).toContain('Successful: 2')
      expect(result.processingReport).toContain('Failed: 1')
    })

    it('should create album directory with timestamp', async () => {
      await fileOutputManager.organizeAlbumOutput(
        mockResults,
        mockOriginalFiles,
        'Test Album',
        '/output/test'
      )

      // Check that mkdir was called with a path containing the album name and timestamp
      const mkdirCalls = mockFs.mkdir.mock.calls
      const albumDirCall = mkdirCalls.find((call: any) => 
        call[0].includes('Test_Album_') && call[0].includes('output')
      )
      expect(albumDirCall).toBeDefined()
      expect(albumDirCall[1]).toEqual({ recursive: true })
    })

    it('should generate processing report with detailed statistics', async () => {
      const result = await fileOutputManager.organizeAlbumOutput(
        mockResults,
        mockOriginalFiles,
        'Test Album',
        '/output/test'
      )

      expect(result.processingReport).toContain('song1.mp3')
      expect(result.processingReport).toContain('Original Loudness: -20.00 LUFS')
      expect(result.processingReport).toContain('Final Loudness: -18.00 LUFS')
      expect(result.processingReport).toContain('Gain Applied: 2.00 dB')
      expect(result.processingReport).toContain('Processing Time: 5.50s')
      expect(result.processingReport).toContain('song3.mp3')
      expect(result.processingReport).toContain('Error: Processing failed')
      expect(result.processingReport).toContain('Total Processing Time: 11.70s')
      expect(result.processingReport).toContain('Average Gain Applied: 3.00 dB')
    })

    it('should handle empty results gracefully', async () => {
      const result = await fileOutputManager.organizeAlbumOutput(
        [],
        [],
        'Empty Album',
        '/output/test'
      )

      expect(result.savedFiles).toHaveLength(0)
      expect(result.totalSize).toBe(0)
    })

    it('should sanitize album name for directory creation', async () => {
      await fileOutputManager.organizeAlbumOutput(
        mockResults,
        mockOriginalFiles,
        'Test<>Album|?',
        '/output/test'
      )

      // Check that mkdir was called with a sanitized album name
      const mkdirCalls = mockFs.mkdir.mock.calls
      const albumDirCall = mkdirCalls.find((call: any) => 
        call[0].includes('Test_Album_') && call[0].includes('output')
      )
      expect(albumDirCall).toBeDefined()
    })
  })

  describe('prepareDownload', () => {
    const mockFilePaths = ['/output/song1.mp3', '/output/song2.mp3']

    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isDirectory: () => false
      })
    })

    it('should prepare single file download', async () => {
      const result = await fileOutputManager.prepareDownload(
        ['/output/song1.mp3'],
        'single'
      )

      expect(result.downloadId).toBeDefined()
      expect(result.files).toHaveLength(1)
      expect(result.files[0].name).toBe('song1.mp3')
      expect(result.files[0].size).toBe(1024)
      expect(result.totalSize).toBe(1024)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('should prepare album download', async () => {
      const result = await fileOutputManager.prepareDownload(
        mockFilePaths,
        'album'
      )

      expect(result.downloadId).toBeDefined()
      expect(result.files).toHaveLength(2)
      expect(result.totalSize).toBe(2048)
    })

    it('should handle file access errors gracefully', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('File not found'))

      const result = await fileOutputManager.prepareDownload(
        mockFilePaths,
        'album'
      )

      // Should still process the accessible file
      expect(result.files).toHaveLength(1)
    })

    it('should reject empty file list', async () => {
      await expect(
        fileOutputManager.prepareDownload([], 'single')
      ).rejects.toThrow('No files provided for download preparation')
    })

    it('should reject when no valid files found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'))

      await expect(
        fileOutputManager.prepareDownload(mockFilePaths, 'single')
      ).rejects.toThrow('No valid files could be prepared for download')
    })
  })

  describe('validateOutputDirectory', () => {
    it('should validate existing writable directory', async () => {
      const result = await fileOutputManager.validateOutputDirectory('/valid/path')

      expect(result.isValid).toBe(true)
      expect(mockFs.access).toHaveBeenCalledWith('/valid/path', 2) // W_OK
    })

    it('should create directory if it does not exist', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('Directory not found'))

      const result = await fileOutputManager.validateOutputDirectory('/new/path')

      expect(result.isValid).toBe(true)
      expect(mockFs.mkdir).toHaveBeenCalledWith('/new/path', { recursive: true })
    })

    it('should reject empty directory path', async () => {
      const result = await fileOutputManager.validateOutputDirectory('')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Output directory path is required')
    })

    it('should handle directory creation errors', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('Directory not found'))
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await fileOutputManager.validateOutputDirectory('/invalid/path')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Cannot create output directory')
    })

    it('should test write permissions', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await fileOutputManager.validateOutputDirectory('/readonly/path')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('No write permission')
    })
  })

  describe('getProcessedFileInfo', () => {
    it('should return file information for existing file', async () => {
      const mockStats = {
        size: 2048,
        birthtime: new Date('2023-01-01'),
        atime: new Date('2023-01-02')
      }
      mockFs.stat.mockResolvedValue(mockStats)

      const result = await fileOutputManager.getProcessedFileInfo('/output/test.mp3')

      expect(result).toEqual({
        path: '/output/test.mp3',
        originalName: 'test.mp3',
        size: 2048,
        format: 'MP3',
        created: mockStats.birthtime,
        lastAccessed: mockStats.atime
      })
    })

    it('should return null for non-existent file', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'))

      const result = await fileOutputManager.getProcessedFileInfo('/nonexistent/file.mp3')

      expect(result).toBeNull()
    })

    it('should detect file format correctly', async () => {
      const result = await fileOutputManager.getProcessedFileInfo('/output/test.flac')

      expect(result?.format).toBe('FLAC')
    })
  })

  describe('cleanupProcessedFiles', () => {
    it('should clean up specific files', async () => {
      const filePaths = ['/output/file1.mp3', '/output/file2.mp3']

      await fileOutputManager.cleanupProcessedFiles(filePaths)

      expect(mockFs.unlink).toHaveBeenCalledWith('/output/file1.mp3')
      expect(mockFs.unlink).toHaveBeenCalledWith('/output/file2.mp3')
    })

    it('should handle cleanup errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'))

      // Should not throw
      await expect(
        fileOutputManager.cleanupProcessedFiles(['/output/file1.mp3'])
      ).resolves.not.toThrow()
    })

    it('should clean up old files when no specific paths provided', async () => {
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000) // 50 hours ago
      
      mockFs.readdir.mockResolvedValue([
        { name: 'old-file.mp3', isDirectory: () => false },
        { name: 'recent-file.mp3', isDirectory: () => false }
      ])
      
      mockFs.stat
        .mockResolvedValueOnce({ mtime: oldDate }) // old file
        .mockResolvedValueOnce({ mtime: new Date() }) // recent file

      await fileOutputManager.cleanupProcessedFiles([], 24)

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-file.mp3')
      )
      expect(mockFs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('recent-file.mp3')
      )
    })
  })
})