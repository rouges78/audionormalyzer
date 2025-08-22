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
    it('dovrebbe calcolare correttamente la loudness media dell\'album', async () => {
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

    it('dovrebbe gestire file senza analisi', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'uploaded'
          // Nessuna analisi
        }
      ]

      await expect(albumProcessor.calculateAlbumLoudness(mockFiles))
        .rejects.toThrow('Nessun file valido per calcolo loudness album')
    })

    it('dovrebbe ignorare file in stato di errore', async () => {
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

      expect(result.averageLoudness).toBe(-14.5) // Solo il secondo file
      expect(result.files).toHaveLength(1)
    })
  })

  describe('processAlbum', () => {
    it('dovrebbe processare con successo un album completo', async () => {
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

      // Mock delle chiamate al AudioProcessor
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

    it('dovrebbe gestire errori durante il processing di singoli file', async () => {
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

      // Mock errore durante normalizzazione
      mockAudioProcessor.normalizeAudio.mockRejectedValue(new Error('Errore processing'))

      const result = await albumProcessor.processAlbum(mockFiles, options)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Nessun file processato con successo')
    })

    it('dovrebbe mantenere loudness relativa quando richiesto', async () => {
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
            lufsIntegrated: -18.0, // Più quiet della media
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
            lufsIntegrated: -14.0, // Più loud della media
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
      
      // Verifica che i target level siano stati calcolati mantenendo posizioni relative
      const calls = mockAudioProcessor.normalizeAudio.mock.calls
      expect(calls[0][1].targetLevel).toBeLessThan(-16.0) // Track1 dovrebbe rimanere più quiet
      expect(calls[1][1].targetLevel).toBeGreaterThan(-16.0) // Track2 dovrebbe rimanere più loud
    })

    it('dovrebbe analizzare file non ancora analizzati', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000,
          format: 'MP3',
          status: 'uploaded'
          // Nessuna analisi
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
    it('dovrebbe generare un report completo', () => {
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

    it('dovrebbe gestire report senza file processati con successo', () => {
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
    it('dovrebbe validare opzioni corrette', () => {
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

    it('dovrebbe rilevare metodo di normalizzazione non valido', () => {
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

    it('dovrebbe rilevare target level non valido per peak', () => {
      const invalidOptions: AlbumOptions = {
        normalizationMethod: 'peak',
        targetLevel: 5.0, // Troppo alto
        maintainRelativeLoudness: false,
        outputFormat: 'wav'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Target level per peak deve essere <= 0 dB')
    })

    it('dovrebbe rilevare target level non valido per loudness', () => {
      const invalidOptions: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -5.0, // Troppo alto
        maintainRelativeLoudness: false,
        outputFormat: 'flac'
      }

      const result = albumProcessor.validateAlbumOptions(invalidOptions)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Target level per loudness deve essere <= -6 LUFS')
    })

    it('dovrebbe rilevare formato output non valido', () => {
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
    it('dovrebbe calcolare statistiche di consistenza per album uniforme', () => {
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

      expect(stats.loudnessConsistency).toBeGreaterThan(0.9) // Molto consistente
      expect(stats.dynamicRangeVariation).toBeLessThan(1.0) // Poca variazione
      expect(stats.recommendedMethod).toBe('loudness')
      expect(stats.notes).toContain('Album già abbastanza consistente in loudness')
    })

    it('dovrebbe raccomandare peak normalization per album con dynamic range variabile', () => {
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
            peakLevel: -1.0, // Alto dynamic range
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
            peakLevel: -6.0, // Basso dynamic range
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

    it('dovrebbe rilevare file con clipping', () => {
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
            hasClipping: true // Clipping rilevato
          }
        }
      ]

      const stats = albumProcessor.calculateConsistencyStats(mockFiles)

      expect(stats.notes).toContain('1 file con clipping rilevato')
    })

    it('dovrebbe gestire album senza file validi', () => {
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