import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AlbumProcessorImpl } from '../album-processor'
import { AudioFile, AlbumOptions, AudioAnalysis } from '@/types/audio'

// Mock del AudioProcessor
vi.mock('../audio-processor', () => ({
  AudioProcessorImpl: vi.fn().mockImplementation(() => ({
    analyzeAudio: vi.fn(),
    normalizeAudio: vi.fn(),
    validateFormat: vi.fn()
  }))
}))

describe('AlbumProcessor', () => {
  let albumProcessor: AlbumProcessorImpl
  let mockAudioProcessor: any

  beforeEach(() => {
    albumProcessor = new AlbumProcessorImpl()
    mockAudioProcessor = (albumProcessor as any).audioProcessor
  })

  describe('calculateAlbumLoudness', () => {
    it('should correctly compute the album average loudness', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.5,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: false
          }
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 200,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -2.8,
            rmsLevel: -17.2,
            lufsIntegrated: -14.5,
            truePeak: -1.8,
            hasClipping: false
          }
        }
      ]

      const result = await albumProcessor.calculateAlbumLoudness(mockFiles)

      expect(result.averageLoudness).toBe(-15.25) // (-16.0 + -14.5) / 2
      expect(result.loudnessRange).toBe(1.5) // -14.5 - (-16.0)
      expect(result.files).toHaveLength(2)
      expect(result.files[0]).toEqual({ id: '1', loudness: -16.0 })
      expect(result.files[1]).toEqual({ id: '2', loudness: -14.5 })
    })

    it('should handle files without analysis', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'uploaded'
          // No analysis
        }
      ]

      await expect(albumProcessor.calculateAlbumLoudness(mockFiles))
        .rejects.toThrow('Nessun file valido per calcolo loudness album')
    })

    it('should ignore files in error state', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'error',
          error: 'File corrotto',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.5,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: false
          }
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 200,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -2.8,
            rmsLevel: -17.2,
            lufsIntegrated: -14.5,
            truePeak: -1.8,
            hasClipping: false
          }
        }
      ]

      const result = await albumProcessor.calculateAlbumLoudness(mockFiles)

      expect(result.averageLoudness).toBe(-14.5) // Only the second file
      expect(result.files).toHaveLength(1)
    })
  })

  describe('processAlbum', () => {
    it('should successfully process a complete album', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.5,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: false
          }
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -14.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock the AudioProcessor calls
      mockAudioProcessor.normalizeAudio.mockResolvedValue('/output/track1_normalized.mp3')
      mockAudioProcessor.analyzeAudio.mockResolvedValue({
        duration: 180,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -3.2,
        rmsLevel: -16.5,
        lufsIntegrated: -14.0,
        truePeak: -2.1,
        hasClipping: false
      })

      const result = await albumProcessor.processAlbum(mockFiles, options)

      expect(result.success).toBe(true)
      expect(result.originalLoudness).toBe(-16.0)
      expect(result.finalLoudness).toBe(-14.0)
      expect(result.gainApplied).toBe(2.0) // -14.0 - (-16.0)
      expect(mockAudioProcessor.normalizeAudio).toHaveBeenCalledTimes(1)
    })

    it('should handle errors while processing individual files', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.5,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: false
          }
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -14.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock error during normalization
      mockAudioProcessor.normalizeAudio.mockRejectedValue(new Error('Errore processing'))

      const result = await albumProcessor.processAlbum(mockFiles, options)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Nessun file processato con successo')
    })

    it('should maintain relative loudness when requested', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.5,
            lufsIntegrated: -18.0, // Quieter than the average
            truePeak: -2.1,
            hasClipping: false
          }
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 200,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -2.8,
            rmsLevel: -17.2,
            lufsIntegrated: -14.0, // Louder than the average
            truePeak: -1.8,
            hasClipping: false
          }
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: true,
        outputFormat: 'mp3'
      }

      mockAudioProcessor.normalizeAudio.mockResolvedValue('/output/normalized.mp3')
      mockAudioProcessor.analyzeAudio.mockResolvedValue({
        duration: 180,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -3.2,
        rmsLevel: -16.5,
        lufsIntegrated: -16.0,
        truePeak: -2.1,
        hasClipping: false
      })

      const result = await albumProcessor.processAlbum(mockFiles, options)

      expect(result.success).toBe(true)
      expect(mockAudioProcessor.normalizeAudio).toHaveBeenCalledTimes(2)
      
      // Check that the target levels were computed keeping relative positions
      const calls = mockAudioProcessor.normalizeAudio.mock.calls
      expect(calls[0][1].targetLevel).toBeLessThan(-16.0) // Track1 should stay quieter
      expect(calls[1][1].targetLevel).toBeGreaterThan(-16.0) // Track2 should stay louder
    })

    it('should analyze files not yet analyzed', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'uploaded'
          // No analysis
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -14.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      const mockAnalysis: AudioAnalysis = {
        duration: 180,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -3.2,
        rmsLevel: -18.5,
        lufsIntegrated: -16.0,
        truePeak: -2.1,
        hasClipping: false
      }

      mockAudioProcessor.analyzeAudio.mockResolvedValueOnce(mockAnalysis)
      mockAudioProcessor.normalizeAudio.mockResolvedValue('/output/normalized.mp3')
      mockAudioProcessor.analyzeAudio.mockResolvedValueOnce({
        ...mockAnalysis,
        lufsIntegrated: -14.0
      })

      const result = await albumProcessor.processAlbum(mockFiles, options)

      expect(result.success).toBe(true)
      expect(mockAudioProcessor.analyzeAudio).toHaveBeenCalledWith('/path/track1.mp3')
    })
  })

  describe('generateProcessingReport', () => {
    it('should generate a complete report', () => {
      const mockResults = [
        {
          fileId: '1',
          success: true,
          outputPath: '/output/track1.mp3',
          originalLoudness: -16.0,
          finalLoudness: -14.0,
          gainApplied: 2.0,
          processingTime: 1000
        },
        {
          fileId: '2',
          success: false,
          originalLoudness: -18.0,
          finalLoudness: 0,
          gainApplied: 0,
          processingTime: 500,
          error: 'Errore processing'
        },
        {
          fileId: '3',
          success: true,
          outputPath: '/output/track3.mp3',
          originalLoudness: -15.0,
          finalLoudness: -14.0,
          gainApplied: 1.0,
          processingTime: 800
        }
      ]

      const report = albumProcessor.generateProcessingReport(mockResults)

      expect(report.totalFiles).toBe(3)
      expect(report.successfulFiles).toBe(2)
      expect(report.failedFiles).toBe(1)
      expect(report.totalProcessingTime).toBe(2300) // 1000 + 500 + 800
      expect(report.averageGainApplied).toBe(1.5) // (2.0 + 1.0) / 2
      expect(report.results).toEqual(mockResults)
    })

    it('should handle reports with no successfully processed files', () => {
      const mockResults = [
        {
          fileId: '1',
          success: false,
          originalLoudness: -16.0,
          finalLoudness: 0,
          gainApplied: 0,
          processingTime: 1000,
          error: 'Errore'
        }
      ]

      const report = albumProcessor.generateProcessingReport(mockResults)

      expect(report.totalFiles).toBe(1)
      expect(report.successfulFiles).toBe(0)
      expect(report.failedFiles).toBe(1)
      expect(report.averageGainApplied).toBe(0)
    })
  })

  describe('validateAlbumOptions', () => {
    it('should validate correct options', () => {
      const validOptions: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: true,
        outputFormat: 'mp3'
      }

      const result = albumProcessor.validateAlbumOptions(validOptions)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect an invalid normalization method', () => {
      const invalidOptions = {
        normalizationMethod: 'invalid' as any,
        targetLevel: -16.0,
        maintainRelativeLoudness: true,
        outputFormat: 'mp3'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Metodo di normalizzazione non valido. Deve essere "peak" o "loudness"')
    })

    it('should detect an invalid target level for peak', () => {
      const invalidOptions: AlbumOptions = {
        normalizationMethod: 'peak',
        targetLevel: 5.0, // Too high
        maintainRelativeLoudness: false,
        outputFormat: 'wav'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Target level per peak deve essere <= 0 dB')
    })

    it('should detect an invalid target level for loudness', () => {
      const invalidOptions: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -5.0, // Too high
        maintainRelativeLoudness: false,
        outputFormat: 'flac'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Target level per loudness deve essere <= -6 LUFS')
    })

    it('should detect an invalid output format', () => {
      const invalidOptions: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'invalid'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Formato output non valido. Formati supportati: original, mp3, wav, flac, aac')
    })
  })

  describe('calculateConsistencyStats', () => {
    it('should compute consistency statistics for a uniform album', () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.0,
            rmsLevel: -18.0,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: false
          }
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 200,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.2,
            rmsLevel: -18.2,
            lufsIntegrated: -16.2,
            truePeak: -1.8,
            hasClipping: false
          }
        }
      ]

      const stats = albumProcessor.calculateConsistencyStats(mockFiles)

      expect(stats.loudnessConsistency).toBeGreaterThan(0.9) // Very consistent
      expect(stats.dynamicRangeVariation).toBeLessThan(1.0) // Little variation
      expect(stats.recommendedMethod).toBe('loudness')
      expect(stats.notes).toContain('Album già abbastanza consistente in loudness')
    })

    it('should recommend peak normalization for an album with variable dynamic range', () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -1.0, // High dynamic range
            rmsLevel: -20.0,
            lufsIntegrated: -16.0,
            truePeak: -0.5,
            hasClipping: false
          }
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 200,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -6.0, // Low dynamic range
            rmsLevel: -18.0,
            lufsIntegrated: -16.1,
            truePeak: -5.5,
            hasClipping: false
          }
        }
      ]

      const stats = albumProcessor.calculateConsistencyStats(mockFiles)

      expect(stats.dynamicRangeVariation).toBeGreaterThan(6.0)
      expect(stats.recommendedMethod).toBe('peak')
      expect(stats.notes).toContain('Raccomandato peak normalization per preservare dynamic range')
    })

    it('should detect files with clipping', () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'ready',
          analysis: {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.0,
            rmsLevel: -18.0,
            lufsIntegrated: -16.0,
            truePeak: -2.1,
            hasClipping: true // Clipping detected
          }
        }
      ]

      const stats = albumProcessor.calculateConsistencyStats(mockFiles)

      expect(stats.notes).toContain('1 file con clipping rilevato')
    })

    it('should handle albums without valid files', () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'error',
          error: 'File corrotto'
        }
      ]

      const stats = albumProcessor.calculateConsistencyStats(mockFiles)

      expect(stats.loudnessConsistency).toBe(0)
      expect(stats.dynamicRangeVariation).toBe(0)
      expect(stats.notes).toContain('Nessun file valido per analisi consistenza')
    })
  })
})