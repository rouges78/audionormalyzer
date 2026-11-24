import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetadataManager, createMetadataManager, AudioMetadata } from '../metadata-manager'
import { promises as fs } from 'fs'

// Mock the dependencies
vi.mock('fs', () => ({
  promises: {
    access: vi.fn()
  }
}))

vi.mock('music-metadata', () => ({
  parseFile: vi.fn()
}))

vi.mock('node-id3', () => ({
  default: {
    write: vi.fn(),
    removeTags: vi.fn()
  }
}))

describe('MetadataManager', () => {
  let metadataManager: MetadataManager
  const mockFs = fs as any

  beforeEach(() => {
    metadataManager = new MetadataManager()
    vi.clearAllMocks()
    
    // Setup default mocks
    mockFs.access.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('extractMetadata', () => {
    it('should extract metadata from an MP3 file', async () => {
      const mockMetadata = {
        common: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          year: 2024,
          genre: ['Rock'],
          track: { no: 1, of: 10 },
          albumartist: 'Test Album Artist',
          composer: 'Test Composer',
          comment: ['Test Comment']
        },
        format: {
          duration: 180.5,
          bitrate: 320,
          sampleRate: 44100,
          numberOfChannels: 2,
          container: 'MPEG'
        }
      }

      const { parseFile } = await import('music-metadata')
      vi.mocked(parseFile).mockResolvedValue(mockMetadata as any)

      const result = await metadataManager.extractMetadata('/test/song.mp3')

      expect(result.title).toBe('Test Song')
      expect(result.artist).toBe('Test Artist')
      expect(result.album).toBe('Test Album')
      expect(result.year).toBe(2024)
      expect(result.genre).toEqual(['Rock'])
      expect(result.duration).toBe(180.5)
      expect(result.bitrate).toBe(320)
      expect(result.sampleRate).toBe(44100)
      expect(result.channels).toBe(2)
    })

    it('should handle files without metadata', async () => {
      const mockMetadata = {
        common: {},
        format: {
          duration: 120,
          container: 'MPEG'
        }
      }

      const { parseFile } = await import('music-metadata')
      vi.mocked(parseFile).mockResolvedValue(mockMetadata as any)

      const result = await metadataManager.extractMetadata('/test/empty.mp3')

      expect(result.title).toBeUndefined()
      expect(result.artist).toBeUndefined()
      expect(result.duration).toBe(120)
    })

    it('should throw for a nonexistent file', async () => {
      mockFs.access.mockRejectedValue(new Error('File non trovato'))

      await expect(metadataManager.extractMetadata('/nonexistent.mp3'))
        .rejects.toThrow('Errore nell\'estrazione metadati')
    })

    it('should handle parsing errors', async () => {
      const { parseFile } = await import('music-metadata')
      vi.mocked(parseFile).mockRejectedValue(new Error('Formato non supportato'))

      await expect(metadataManager.extractMetadata('/test/corrupted.mp3'))
        .rejects.toThrow('Errore nell\'estrazione metadati')
    })
  })

  describe('preserveMetadata', () => {
    it('should preserve metadata between two MP3 files', async () => {
      const mockSourceMetadata = {
        common: {
          title: 'Source Song',
          artist: 'Source Artist',
          album: 'Source Album'
        },
        format: {
          container: 'MPEG'
        }
      }

      const { parseFile } = await import('music-metadata')
      const NodeID3Module = await import('node-id3')
      
      vi.mocked(parseFile).mockResolvedValue(mockSourceMetadata as any)
      vi.mocked(NodeID3Module.default.write).mockReturnValue(true as any)

      await metadataManager.preserveMetadata('/source.mp3', '/target.mp3')

      expect(parseFile).toHaveBeenCalledWith('/source.mp3')
      expect(NodeID3Module.default.write).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Source Song',
          artist: 'Source Artist',
          album: 'Source Album'
        }),
        '/target.mp3'
      )
    })

    it('should handle ID3 write errors', async () => {
      const mockSourceMetadata = {
        common: { title: 'Test' },
        format: { container: 'MPEG' }
      }

      const { parseFile } = await import('music-metadata')
      const NodeID3Module = await import('node-id3')
      
      vi.mocked(parseFile).mockResolvedValue(mockSourceMetadata as any)
      vi.mocked(NodeID3Module.default.write).mockReturnValue(false as any)

      await expect(metadataManager.preserveMetadata('/source.mp3', '/target.mp3'))
        .rejects.toThrow('Errore nella preservazione metadati')
    })
  })

  describe('supportsMetadata', () => {
    it('should identify supported formats', () => {
      expect(metadataManager.supportsMetadata('/test.mp3')).toBe(true)
      expect(metadataManager.supportsMetadata('/test.flac')).toBe(true)
      expect(metadataManager.supportsMetadata('/test.ogg')).toBe(true)
      expect(metadataManager.supportsMetadata('/test.m4a')).toBe(true)
      expect(metadataManager.supportsMetadata('/test.aac')).toBe(true)
      expect(metadataManager.supportsMetadata('/test.wav')).toBe(true)
    })

    it('should identify unsupported formats', () => {
      expect(metadataManager.supportsMetadata('/test.txt')).toBe(false)
      expect(metadataManager.supportsMetadata('/test.pdf')).toBe(false)
      expect(metadataManager.supportsMetadata('/test')).toBe(false)
    })
  })

  describe('getMetadataSupport', () => {
    it('should return correct info for MP3', () => {
      const support = metadataManager.getMetadataSupport('/test.mp3')

      expect(support.format).toBe('ID3v2')
      expect(support.supportsBasicTags).toBe(true)
      expect(support.supportsArtwork).toBe(true)
      expect(support.supportsCustomTags).toBe(true)
      expect(support.readOnly).toBe(false)
    })

    it('should return correct info for FLAC', () => {
      const support = metadataManager.getMetadataSupport('/test.flac')

      expect(support.format).toBe('Vorbis Comments')
      expect(support.supportsBasicTags).toBe(true)
      expect(support.supportsArtwork).toBe(true)
      expect(support.readOnly).toBe(true)
    })

    it('should return correct info for WAV', () => {
      const support = metadataManager.getMetadataSupport('/test.wav')

      expect(support.format).toBe('Limited')
      expect(support.supportsBasicTags).toBe(false)
      expect(support.supportsArtwork).toBe(false)
      expect(support.readOnly).toBe(true)
    })

    it('should handle unsupported formats', () => {
      const support = metadataManager.getMetadataSupport('/test.unknown')

      expect(support.format).toBe('Unsupported')
      expect(support.supportsBasicTags).toBe(false)
      expect(support.supportsArtwork).toBe(false)
      expect(support.readOnly).toBe(true)
    })
  })

  describe('createMetadataManager factory', () => {
    it('should create a MetadataManager instance', () => {
      const manager = createMetadataManager()
      expect(manager).toBeInstanceOf(MetadataManager)
    })
  })
})