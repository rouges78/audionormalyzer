import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FileManagerImpl, createFileManager } from '../file-manager'
import { promises as fs } from 'fs'
import path from 'path'

// Mock delle dipendenze
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
    it('dovrebbe validare un file MP3 valido', async () => {
      const mockFile = new File(['test content'], 'test.mp3', {
        type: 'audio/mpeg'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('MP3')
    })

    it('dovrebbe rifiutare un file con formato non supportato', async () => {
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Formato non supportato')
    })

    it('dovrebbe rifiutare un file vuoto', async () => {
      const mockFile = new File([], 'test.mp3', {
        type: 'audio/mpeg'
      })

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('File vuoto')
    })

    it('dovrebbe rifiutare un file troppo grande', async () => {
      // Crea un file mock che supera il limite di 500MB
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

    it('dovrebbe validare tutti i formati supportati', async () => {
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

    it('dovrebbe gestire file senza MIME type', async () => {
      const mockFile = new File(['test content'], 'test.mp3')

      const result = await fileManager.validateAudioFile(mockFile)

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('MP3')
    })

    it('dovrebbe rifiutare oggetti non validi', async () => {
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

    it('dovrebbe caricare con successo file validi', async () => {
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

    it('dovrebbe lanciare errore se nessun file fornito', async () => {
      await expect(fileManager.uploadFiles([])).rejects.toThrow('Nessun file fornito')
    })

    it('dovrebbe lanciare errore se la dimensione totale supera il limite', async () => {
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

    it('dovrebbe pulire i file in caso di errore parziale', async () => {
      const mockFile1 = {
        name: 'test1.mp3',
        size: 1000,
        type: 'audio/mpeg',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }

      const mockFile2 = {
        name: 'test2.txt',
        size: 1000,
        type: 'text/plain' // File non valido
      }

      const mockFiles = [mockFile1 as unknown as File, mockFile2 as unknown as File]
      mockFs.unlink.mockResolvedValue(undefined)

      await expect(fileManager.uploadFiles(mockFiles)).rejects.toThrow('Errori durante l\'upload')
      expect(mockFs.unlink).toHaveBeenCalled()
    })

    it('dovrebbe gestire errori di scrittura file', async () => {
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
    it('dovrebbe creare directory di output con nome valido', async () => {
      const albumName = 'My Album'
      
      const result = await fileManager.createOutputDirectory(albumName)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('My_Album'),
        { recursive: true }
      )
      expect(result).toContain('My_Album')
    })

    it('dovrebbe sanitizzare nomi di album con caratteri speciali', async () => {
      const albumName = 'Album/With<Special>Characters'
      
      await fileManager.createOutputDirectory(albumName)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('Album_With_Special_Characters'),
        { recursive: true }
      )
    })

    it('dovrebbe lanciare errore per nome album vuoto', async () => {
      await expect(fileManager.createOutputDirectory('')).rejects.toThrow('Nome album richiesto')
      await expect(fileManager.createOutputDirectory('   ')).rejects.toThrow('Nome album richiesto')
    })

    it('dovrebbe gestire errori di creazione directory', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permessi insufficienti'))

      await expect(fileManager.createOutputDirectory('Test Album'))
        .rejects.toThrow('Errore nella creazione della directory di output')
    })
  })

  describe('cleanupFiles', () => {
    it('dovrebbe eliminare file specificati', async () => {
      const filePaths = ['/temp/file1.mp3', '/temp/file2.wav']
      mockFs.unlink.mockResolvedValue(undefined)

      await fileManager.cleanupFiles(filePaths)

      expect(mockFs.unlink).toHaveBeenCalledTimes(2)
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file1.mp3')
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file2.wav')
    })

    it('dovrebbe gestire errori di eliminazione senza lanciare eccezioni', async () => {
      const filePaths = ['/temp/file1.mp3']
      mockFs.unlink.mockRejectedValue(new Error('File non trovato'))

      // Non dovrebbe lanciare errore
      await expect(fileManager.cleanupFiles(filePaths)).resolves.toBeUndefined()
    })
  })

  describe('cleanupOldTempFiles', () => {
    it('dovrebbe eliminare file più vecchi del limite specificato', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 ore fa
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 ora fa

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

    it('dovrebbe gestire directory temporanea inesistente', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory non trovata'))

      // Non dovrebbe lanciare errore
      await expect(fileManager.cleanupOldTempFiles()).resolves.toBeUndefined()
    })
  })

  describe('getTempFileInfo', () => {
    it('dovrebbe restituire informazioni su file esistente', async () => {
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

    it('dovrebbe restituire null per file inesistente', async () => {
      mockFs.readdir.mockResolvedValue(['other-file.mp3'])

      const result = await fileManager.getTempFileInfo('non-existent-id')

      expect(result).toBeNull()
    })

    it('dovrebbe gestire errori di accesso directory', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Accesso negato'))

      const result = await fileManager.getTempFileInfo('test-id')

      expect(result).toBeNull()
    })
  })

  describe('preserveMetadata', () => {
    it('dovrebbe verificare esistenza file sorgente e destinazione', async () => {
      const sourcePath = '/temp/source.mp3'
      const targetPath = '/output/target.mp3'

      // Mock del MetadataManager
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

    it('dovrebbe lanciare errore se file sorgente non esiste', async () => {
      mockFs.access.mockRejectedValue(new Error('File non trovato'))

      await expect(fileManager.preserveMetadata('/nonexistent.mp3', '/target.mp3'))
        .rejects.toThrow('Errore nella preservazione metadati')
    })

    it('dovrebbe gestire file che non supportano metadati', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock del MetadataManager che non supporta metadati
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(false)
        })
      }))

      await fileManager.preserveMetadata('/source.txt', '/target.txt')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non supporta metadati')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('extractFileMetadata', () => {
    it('dovrebbe estrarre metadati da file supportato', async () => {
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

    it('dovrebbe restituire null per file non supportato', async () => {
      vi.doMock('../metadata-manager', () => ({
        createMetadataManager: () => ({
          supportsMetadata: vi.fn().mockReturnValue(false)
        })
      }))

      const result = await fileManager.extractFileMetadata('/test.txt')

      expect(result).toBeNull()
    })

    it('dovrebbe gestire errori di estrazione', async () => {
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
    it('dovrebbe identificare formati supportati', () => {
      expect(fileManager.fileSupportsMetadata('/test.mp3')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.flac')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.ogg')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.m4a')).toBe(true)
      expect(fileManager.fileSupportsMetadata('/test.aac')).toBe(true)
    })

    it('dovrebbe identificare formati non supportati', () => {
      expect(fileManager.fileSupportsMetadata('/test.wav')).toBe(false)
      expect(fileManager.fileSupportsMetadata('/test.txt')).toBe(false)
    })
  })

  describe('getMetadataSupport', () => {
    it('dovrebbe restituire informazioni supporto metadati', async () => {
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

    it('dovrebbe gestire errori', async () => {
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
    it('dovrebbe creare istanza FileManager', () => {
      const manager = createFileManager()
      expect(manager).toBeInstanceOf(FileManagerImpl)
    })
  })
})