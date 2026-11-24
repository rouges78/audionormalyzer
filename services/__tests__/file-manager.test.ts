import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FileManagerImpl, createFileManager } from '../file-manager'
import { promises as fs } from 'fs'
import path from 'path'

// Mock the dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn()
  },
  constants: {
    R_OK: 4
  }
}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123')
}))

describe('FileManager', () => {
  let fileManager: FileManagerImpl
  const mockFs = fs as any

  beforeEach(() => {
    fileManager = new FileManagerImpl()
    vi.clearAllMocks()
    
    // Setup default mocks
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.stat.mockResolvedValue({
      size: 1000,
      isDirectory: () => true,
      birthtime: new Date(),
      mtime: new Date()
    })
    mockFs.access.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('validateAudioFile', () => {
    it('should validate a valid MP3 file', async () => {
      const mockFile = new File(['test content'], 'test.mp3', {
        type: 'audio/mpeg'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('MP3')
    })

    it('should reject a file with an unsupported format', async () => {
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Formato non supportato')
    })

    it('should reject an empty file', async () => {
      const mockFile = new File([], 'test.mp3', {
        type: 'audio/mpeg'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('File vuoto')
    })

    it('should reject a file that is too large', async () => {
      // Create a mock file that exceeds the 500MB limit
      const largeSize = 600 * 1024 * 1024 // 600MB
      const mockFile = {
        name: 'large.mp3',
        size: largeSize,
        type: 'audio/mpeg'
      }

      const result = await fileManager.validateAudioFile(mockFile as File)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('File troppo grande')
    })

    it('should validate all supported formats', async () => {
      const supportedFormats = [
        { ext: 'mp3', type: 'audio/mpeg', format: 'MP3' },
        { ext: 'wav', type: 'audio/wav', format: 'WAV' },
        { ext: 'flac', type: 'audio/flac', format: 'FLAC' },
        { ext: 'aac', type: 'audio/aac', format: 'AAC' },
        { ext: 'm4a', type: 'audio/mp4', format: 'M4A/AAC' },
        { ext: 'ogg', type: 'audio/ogg', format: 'OGG Vorbis' }
      ]

      for (const format of supportedFormats) {
        const mockFile = new File(['test'], `test.${format.ext}`, {
          type: format.type
        })

        const result = await fileManager.validateAudioFile(mockFile)

        expect(result.isValid).toBe(true)
        expect(result.format).toBe(format.format)
      }
    })

    it('should handle files without a MIME type', async () => {
      const mockFile = new File(['test content'], 'test.mp3')

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('MP3')
    })

    it('should reject invalid objects', async () => {
      const result = await fileManager.validateAudioFile(null as any)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Oggetto file non valido')
    })
  })

  describe('uploadFiles', () => {
    beforeEach(() => {
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.stat.mockResolvedValue({
        size: 1000
      })
    })

    it('should successfully upload valid files', async () => {
      const mockFile1 = {
        name: 'test1.mp3',
        size: 1000,
        type: 'audio/mpeg',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }

      const mockFile2 = {
        name: 'test2.wav',
        size: 1000,
        type: 'audio/wav',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }

      const mockFiles = [mockFile1 as unknown as File, mockFile2 as unknown as File]

      const results = await fileManager.uploadFiles(mockFiles)

      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('test-uuid-123')
      expect(results[0].originalName).toBe('test1.mp3')
      expect(results[0].format).toBe('MP3')
      expect(results[1].format).toBe('WAV')
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2)
    })

    it('should throw if no file is provided', async () => {
      await expect(fileManager.uploadFiles([])).rejects.toThrow('Nessun file fornito')
    })

    it('should throw if the total size exceeds the limit', async () => {
      const largeFile = {
        name: 'large.mp3',
        size: 1.5 * 1024 * 1024 * 1024, // 1.5GB
        type: 'audio/mpeg'
      }

      const largeFile2 = {
        name: 'large2.mp3',
        size: 1 * 1024 * 1024 * 1024, // 1GB
        type: 'audio/mpeg'
      }

      await expect(fileManager.uploadFiles([largeFile as File, largeFile2 as File]))
        .rejects.toThrow('Dimensione totale album troppo grande')
    })

    it('should clean up files on partial error', async () => {
      const mockFile1 = {
        name: 'test1.mp3',
        size: 1000,
        type: 'audio/mpeg',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }

      const mockFile2 = {
        name: 'test2.txt',
        size: 1000,
        type: 'text/plain' // Invalid file
      }

      const mockFiles = [mockFile1 as unknown as File, mockFile2 as unknown as File]
      mockFs.unlink.mockResolvedValue(undefined)

      await expect(fileManager.uploadFiles(mockFiles)).rejects.toThrow('Errori durante l\'upload')
      expect(mockFs.unlink).toHaveBeenCalled()
    })

    it('should handle file write errors', async () => {
      const mockFile = {
        name: 'test.mp3',
        size: 1000,
        type: 'audio/mpeg',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }

      mockFs.writeFile.mockRejectedValue(new Error('Errore scrittura'))

      await expect(fileManager.uploadFiles([mockFile as unknown as File])).rejects.toThrow('Errori durante l\'upload')
    })
  })

  describe('createOutputDirectory', () => {
    it('should create an output directory with a valid name', async () => {
      const albumName = 'My Album'
      
      const result = await fileManager.createOutputDirectory(albumName)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('My_Album'),
        { recursive: true }
      )
      expect(result).toContain('My_Album')
    })

    it('should sanitize album names with special characters', async () => {
      const albumName = 'Album/With<Special>Characters'
      
      await fileManager.createOutputDirectory(albumName)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('Album_With_Special_Characters'),
        { recursive: true }
      )
    })

    it('should throw for an empty album name', async () => {
      await expect(fileManager.createOutputDirectory('')).rejects.toThrow('Nome album richiesto')
      await expect(fileManager.createOutputDirectory('   ')).rejects.toThrow('Nome album richiesto')
    })

    it('should handle directory creation errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permessi insufficienti'))

      await expect(fileManager.createOutputDirectory('Test Album'))
        .rejects.toThrow('Errore nella creazione della directory di output')
    })
  })

  describe('cleanupFiles', () => {
    it('should delete the specified files', async () => {
      const filePaths = ['/temp/file1.mp3', '/temp/file2.wav']
      mockFs.unlink.mockResolvedValue(undefined)

      await fileManager.cleanupFiles(filePaths)

      expect(mockFs.unlink).toHaveBeenCalledTimes(2)
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file1.mp3')
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file2.wav')
    })

    it('should handle deletion errors without throwing', async () => {
      const filePaths = ['/temp/file1.mp3']
      mockFs.unlink.mockRejectedValue(new Error('File non trovato'))

      // Should not throw
      await expect(fileManager.cleanupFiles(filePaths)).resolves.toBeUndefined()
    })
  })

  describe('cleanupOldTempFiles', () => {
    it('should delete files older than the specified limit', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago

      mockFs.readdir.mockResolvedValue(['old-file.mp3', 'recent-file.mp3'])
      mockFs.stat
        .mockResolvedValueOnce({ mtime: oldDate })
        .mockResolvedValueOnce({ mtime: recentDate })
      mockFs.unlink.mockResolvedValue(undefined)

      await fileManager.cleanupOldTempFiles(24)

      expect(mockFs.unlink).toHaveBeenCalledTimes(1)
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-file.mp3')
      )
    })

    it('should handle a nonexistent temporary directory', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory non trovata'))

      // Should not throw
      await expect(fileManager.cleanupOldTempFiles()).resolves.toBeUndefined()
    })
  })

  describe('getTempFileInfo', () => {
    it('should return info about an existing file', async () => {
      const fileId = 'test-uuid-123'
      const fileName = `${fileId}.mp3`
      const mockStats = {
        size: 1000,
        birthtime: new Date('2024-01-01')
      }

      mockFs.readdir.mockResolvedValue([fileName, 'other-file.wav'])
      mockFs.stat.mockResolvedValue(mockStats)

      const result = await fileManager.getTempFileInfo(fileId)

      expect(result).toEqual({
        path: expect.stringContaining(fileName),
        size: 1000,
        created: mockStats.birthtime
      })
    })

    it('should return null for a nonexistent file', async () => {
      mockFs.readdir.mockResolvedValue(['other-file.mp3'])

      const result = await fileManager.getTempFileInfo('non-existent-id')

      expect(result).toBeNull()
    })

    it('should handle directory access errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Accesso negato'))

      const result = await fileManager.getTempFileInfo('test-id')

      expect(result).toBeNull()
    })
  })

  describe('preserveMetadata', () => {
    it('should check that source and destination files exist', async () => {
      const sourcePath = '/temp/source.mp3'
      const targetPath = '/output/target.mp3'

      // Mock the MetadataManager
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(true),
          preserveMetadata: vi.fn().mockResolvedValue(undefined)
        })
      }))

      await fileManager.preserveMetadata(sourcePath, targetPath)

      expect(mockFs.access).toHaveBeenCalledWith(sourcePath, 4) // R_OK
      expect(mockFs.access).toHaveBeenCalledWith(targetPath, 4)
    })

    it('should throw if the source file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File non trovato'))

      await expect(fileManager.preserveMetadata('/nonexistent.mp3', '/target.mp3'))
        .rejects.toThrow('Errore nella preservazione metadati')
    })

    it('should handle files that do not support metadata', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock a MetadataManager that does not support metadata
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(false)
        })
      }))

      await fileManager.preserveMetadata('/source.txt', '/target.txt')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support metadata')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('extractFileMetadata', () => {
    it('should extract metadata from a supported file', async () => {
      const mockMetadata = { title: 'Test Song', artist: 'Test Artist' }
      
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(true),
          extractMetadata: vi.fn().mockResolvedValue(mockMetadata)
        })
      }))

      const result = await fileManager.extractFileMetadata('/test.mp3')

      expect(result).toEqual(mockMetadata)
    })

    it('should return null for an unsupported file', async () => {
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(false)
        })
      }))

      const result = await fileManager.extractFileMetadata('/test.txt')

      expect(result).toBeNull()
    })

    it('should handle extraction errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(true),
          extractMetadata: vi.fn().mockRejectedValue(new Error('Errore estrazione'))
        })
      }))

      const result = await fileManager.extractFileMetadata('/test.mp3')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('fileSupportsMetadata', () => {
    it('should identify supported formats', () => {
      expect(fileManager.fileSupportsMetadata('/test.mp3')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.flac')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.ogg')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.m4a')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.aac')).toBe(true)
    })

    it('should identify unsupported formats', () => {
      expect(fileManager.fileSupportsMetadata('/test.wav')).toBe(false)
      expect(fileManager.fileSupportsMetadata('/test.txt')).toBe(false)
    })
  })

  describe('getMetadataSupport', () => {
    it('should return metadata support info', async () => {
      const mockSupport = {
        format: 'ID3v2',
        supportsBasicTags: true,
        supportsArtwork: true,
        supportsCustomTags: true,
        readOnly: false
      }
      
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          getMetadataSupport: vi.fn().mockReturnValue(mockSupport)
        })
      }))

      const result = await fileManager.getMetadataSupport('/test.mp3')

      expect(result).toEqual(mockSupport)
    })

    it('should handle errors', async () => {
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => {
          throw new Error('Errore inizializzazione')
        }
      }))

      const result = await fileManager.getMetadataSupport('/test.mp3')

      expect(result.format).toBe('Error')
      expect(result.supportsBasicTags).toBe(false)
    })
  })

  describe('createFileManager factory', () => {
    it('should create a FileManager instance', () => {
      const manager = createFileManager()
      expect(manager).toBeInstanceOf(FileManagerImpl)
    })
  })
})