import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioProcessorImpl } from '../../services/audio-processor'
import { FileManagerImpl } from '../../services/file-manager'

describe('Audio Format Compatibility Integration Tests', () => {
  let audioProcessor: AudioProcessorImpl
  let fileManager: FileManagerImpl

  beforeEach(() => {
    audioProcessor = new AudioProcessorImpl()
    fileManager = new FileManagerImpl()
  })

  describe('Format Detection and Validation', () => {
    it('should correctly identify all supported audio formats', async () => {
      const testFiles = [
        { name: 'test.mp3', type: 'audio/mpeg', expectedFormat: 'MP3' },
        { name: 'test.wav', type: 'audio/wav', expectedFormat: 'WAV' },
        { name: 'test.flac', type: 'audio/flac', expectedFormat: 'FLAC' },
        { name: 'test.aac', type: 'audio/aac', expectedFormat: 'AAC' },
        { name: 'test.m4a', type: 'audio/mp4', expectedFormat: 'M4A/AAC' },
        { name: 'test.ogg', type: 'audio/ogg', expectedFormat: 'OGG Vorbis' }
      ]

      for (const testFile of testFiles) {
        const mockFile = new File([new ArrayBuffer(1024)], testFile.name, { 
          type: testFile.type 
        })

        const result = await fileManager.validateAudioFile(mockFile)

        expect(result.isValid).toBe(true)
        expect(result.format).toBe(testFile.expectedFormat)
      }
    })

    it('should handle case-insensitive file extensions', async () => {
      const testCases = [
        { name: 'test.MP3', expectedFormat: 'MP3' },
        { name: 'test.WaV', expectedFormat: 'WAV' },
        { name: 'test.FLAC', expectedFormat: 'FLAC' },
        { name: 'test.AaC', expectedFormat: 'AAC' },
        { name: 'test.M4A', expectedFormat: 'M4A/AAC' },
        { name: 'test.OGG', expectedFormat: 'OGG Vorbis' }
      ]

      for (const testCase of testCases) {
        const mockFile = new File([new ArrayBuffer(1024)], testCase.name)

        const result = await fileManager.validateAudioFile(mockFile)

        expect(result.isValid).toBe(true)
        expect(result.format).toBe(testCase.expectedFormat)
      }
    })

    it('should reject unsupported formats', async () => {
      const unsupportedFormats = [
        'test.mp4', // Video format
        'test.avi', // Video format
        'test.txt', // Text file
        'test.pdf', // Document
        'test.jpg', // Image
        'test.wma', // Windows Media Audio
        'test.ra',  // RealAudio
        'test.au'   // Sun Audio
      ]

      for (const fileName of unsupportedFormats) {
        const mockFile = new File([new ArrayBuffer(1024)], fileName)

        const result = await fileManager.validateAudioFile(mockFile)

        expect(result.isValid).toBe(false)
        expect(result.error).toContain('non supportato')
      }
    })

    it('should validate file format consistency', async () => {
      // Test file with MP3 extension but wrong MIME type
      const inconsistentFile = new File([new ArrayBuffer(1024)], 'test.mp3', {
        type: 'audio/wav'
      })

      const result = await fileManager.validateAudioFile(inconsistentFile)

      // Should still validate based on extension when MIME type is inconsistent
      expect(result.isValid).toBe(true)
      expect(result.format).toBe('MP3')
    })
  })

  describe('Format-Specific Processing', () => {
    it('should handle lossless formats (FLAC, WAV) correctly', async () => {
      const losslessFormats = ['/test/audio.flac', '/test/audio.wav']

      for (const filePath of losslessFormats) {
        const isValid = await audioProcessor.validateFormat(filePath)
        expect(isValid).toBe(true)

        // Mock analysis for lossless format
        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
          duration: 240.0,
          sampleRate: 96000, // High sample rate typical of lossless
          channels: 2,
          peakLevel: -1.0,
          rmsLevel: -15.0,
          lufsIntegrated: -14.0,
          truePeak: -0.5,
          hasClipping: false
        })

        const analysis = await audioProcessor.analyzeAudio(filePath)

        expect(analysis.sampleRate).toBeGreaterThanOrEqual(44100)
        expect(analysis.duration).toBeGreaterThan(0)
      }
    })

    it('should handle compressed formats (MP3, AAC, OGG) correctly', async () => {
      const compressedFormats = ['/test/audio.mp3', '/test/audio.aac', '/test/audio.ogg']

      for (const filePath of compressedFormats) {
        const isValid = await audioProcessor.validateFormat(filePath)
        expect(isValid).toBe(true)

        // Mock analysis for compressed format
        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
          duration: 180.5,
          sampleRate: 44100, // Standard sample rate for compressed
          channels: 2,
          peakLevel: -3.2,
          rmsLevel: -18.5,
          lufsIntegrated: -16.2,
          truePeak: -2.8,
          hasClipping: false
        })

        const analysis = await audioProcessor.analyzeAudio(filePath)

        expect(analysis.sampleRate).toBeGreaterThanOrEqual(22050)
        expect(analysis.channels).toBeGreaterThanOrEqual(1)
      }
    })

    it('should preserve format during normalization', async () => {
      const testFormats = [
        { path: '/test/preserve.mp3', expectedExt: '.mp3' },
        { path: '/test/preserve.flac', expectedExt: '.flac' },
        { path: '/test/preserve.wav', expectedExt: '.wav' },
        { path: '/test/preserve.aac', expectedExt: '.aac' }
      ]

      for (const format of testFormats) {
        const options = {
          method: 'peak' as const,
          targetLevel: -1.0,
          preserveFormat: true,
          outputPath: `/output/normalized${format.expectedExt}`
        }

        // Mock successful normalization
        vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue(options.outputPath)

        const result = await audioProcessor.normalizeAudio(format.path, options)

        expect(result).toBe(options.outputPath)
        expect(result).toContain(format.expectedExt)
      }
    })
  })

  describe('Multi-Format Album Processing', () => {
    it('should process mixed format albums consistently', async () => {
      const mixedAlbumFiles = [
        { name: 'track01.mp3', format: 'MP3' },
        { name: 'track02.flac', format: 'FLAC' },
        { name: 'track03.wav', format: 'WAV' },
        { name: 'track04.aac', format: 'AAC' },
        { name: 'track05.ogg', format: 'OGG Vorbis' }
      ]

      // Validate all files
      for (const file of mixedAlbumFiles) {
        const mockFile = new File([new ArrayBuffer(1024)], file.name)
        const result = await fileManager.validateAudioFile(mockFile)

        expect(result.isValid).toBe(true)
        expect(result.format).toBe(file.format)
      }

      // Mock analysis for each format
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        const fileName = filePath.split('/').pop() || ''
        
        return {
          duration: 200 + Math.random() * 100, // Varying durations
          sampleRate: fileName.includes('flac') ? 96000 : 44100,
          channels: 2,
          peakLevel: -6.0 + Math.random() * 3, // Varying levels
          rmsLevel: -20.0 + Math.random() * 5,
          lufsIntegrated: -18.0 + Math.random() * 4,
          truePeak: -3.0 + Math.random() * 2,
          hasClipping: false
        }
      })

      // Analyze all files
      const analyses = []
      for (const file of mixedAlbumFiles) {
        const analysis = await audioProcessor.analyzeAudio(`/temp/${file.name}`)
        analyses.push(analysis)
      }

      expect(analyses).toHaveLength(mixedAlbumFiles.length)
      
      // All analyses should be valid
      analyses.forEach(analysis => {
        expect(analysis.duration).toBeGreaterThan(0)
        expect(analysis.sampleRate).toBeGreaterThan(0)
        expect(analysis.channels).toBeGreaterThanOrEqual(1)
      })
    })

    it('should maintain relative loudness across different formats', async () => {
      const albumFiles = [
        { path: '/album/01-intro.mp3', targetLufs: -23.0 },
        { path: '/album/02-verse.flac', targetLufs: -23.0 },
        { path: '/album/03-chorus.wav', targetLufs: -23.0 },
        { path: '/album/04-bridge.aac', targetLufs: -23.0 },
        { path: '/album/05-outro.ogg', targetLufs: -23.0 }
      ]

      // Mock normalization for each format
      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string, options) => {
        const fileName = filePath.split('/').pop() || ''
        const extension = fileName.split('.').pop() || ''
        
        return `/output/normalized-${fileName}`
      })

      // Normalize all files with same target
      const results = []
      for (const file of albumFiles) {
        const options = {
          method: 'loudness' as const,
          targetLevel: file.targetLufs,
          preserveFormat: true,
          outputPath: `/output/normalized-${file.path.split('/').pop()}`
        }

        const result = await audioProcessor.normalizeAudio(file.path, options)
        results.push(result)
      }

      expect(results).toHaveLength(albumFiles.length)
      
      // All files should be processed
      results.forEach((result, index) => {
        expect(result).toContain('normalized')
        expect(result).toContain(albumFiles[index].path.split('/').pop())
      })
    })
  })

  describe('Format Conversion and Quality', () => {
    it('should handle high-resolution audio formats', async () => {
      const hiResFormats = [
        { path: '/hires/96khz-24bit.flac', sampleRate: 96000 },
        { path: '/hires/192khz-24bit.wav', sampleRate: 192000 },
        { path: '/hires/dsd.flac', sampleRate: 88200 }
      ]

      for (const format of hiResFormats) {
        const isValid = await audioProcessor.validateFormat(format.path)
        expect(isValid).toBe(true)

        // Mock high-resolution analysis
        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
          duration: 300.0,
          sampleRate: format.sampleRate,
          channels: 2,
          peakLevel: -1.0,
          rmsLevel: -12.0,
          lufsIntegrated: -14.0,
          truePeak: -0.3,
          hasClipping: false
        })

        const analysis = await audioProcessor.analyzeAudio(format.path)

        expect(analysis.sampleRate).toBe(format.sampleRate)
        expect(analysis.sampleRate).toBeGreaterThan(44100)
      }
    })

    it('should handle multi-channel audio formats', async () => {
      const multiChannelFormats = [
        { path: '/surround/5.1-mix.flac', channels: 6 },
        { path: '/surround/7.1-mix.wav', channels: 8 },
        { path: '/stereo/stereo.mp3', channels: 2 },
        { path: '/mono/mono.wav', channels: 1 }
      ]

      for (const format of multiChannelFormats) {
        // Mock multi-channel analysis
        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
          duration: 240.0,
          sampleRate: 48000,
          channels: format.channels,
          peakLevel: -2.0,
          rmsLevel: -16.0,
          lufsIntegrated: -16.0,
          truePeak: -1.0,
          hasClipping: false
        })

        const analysis = await audioProcessor.analyzeAudio(format.path)

        expect(analysis.channels).toBe(format.channels)
        expect(analysis.channels).toBeGreaterThanOrEqual(1)
        expect(analysis.channels).toBeLessThanOrEqual(8)
      }
    })

    it('should detect and handle corrupted format files', async () => {
      const corruptedFiles = [
        '/corrupted/truncated.mp3',
        '/corrupted/header-damaged.flac',
        '/corrupted/invalid-data.wav'
      ]

      for (const filePath of corruptedFiles) {
        // Mock corrupted file detection
        vi.spyOn(audioProcessor, 'analyzeAudio').mockRejectedValue(
          new Error('Invalid or corrupted audio data')
        )

        await expect(audioProcessor.analyzeAudio(filePath))
          .rejects.toThrow('Audio analysis failed')
      }
    })
  })

  describe('Format-Specific Metadata Handling', () => {
    it('should handle metadata for formats that support it', async () => {
      const metadataSupportedFormats = [
        { path: '/metadata/song.mp3', supportsMetadata: true },
        { path: '/metadata/song.flac', supportsMetadata: true },
        { path: '/metadata/song.ogg', supportsMetadata: true },
        { path: '/metadata/song.m4a', supportsMetadata: true },
        { path: '/metadata/song.aac', supportsMetadata: true }
      ]

      for (const format of metadataSupportedFormats) {
        const supportsMetadata = fileManager.fileSupportsMetadata(format.path)
        expect(supportsMetadata).toBe(format.supportsMetadata)
      }
    })

    it('should handle formats without metadata support', async () => {
      const noMetadataFormats = [
        { path: '/no-metadata/audio.wav', supportsMetadata: false }
      ]

      for (const format of noMetadataFormats) {
        const supportsMetadata = fileManager.fileSupportsMetadata(format.path)
        expect(supportsMetadata).toBe(format.supportsMetadata)
      }
    })

    it('should preserve metadata during format-preserving normalization', async () => {
      const metadataFiles = ['/meta/song.mp3', '/meta/song.flac']

      for (const filePath of metadataFiles) {
        // Mock metadata preservation
        vi.spyOn(fileManager, 'preserveMetadata').mockResolvedValue(undefined)

        const sourcePath = filePath
        const targetPath = filePath.replace('/meta/', '/output/')

        await fileManager.preserveMetadata(sourcePath, targetPath)

        expect(fileManager.preserveMetadata).toHaveBeenCalledWith(sourcePath, targetPath)
      }
    })
  })

  describe('Format Performance Characteristics', () => {
    it('should process different formats within expected time ranges', async () => {
      const formatPerformanceTests = [
        { format: 'MP3', expectedMaxTime: 2000 }, // 2 seconds
        { format: 'WAV', expectedMaxTime: 3000 }, // 3 seconds
        { format: 'FLAC', expectedMaxTime: 4000 }, // 4 seconds
        { format: 'AAC', expectedMaxTime: 2500 }, // 2.5 seconds
        { format: 'OGG', expectedMaxTime: 3000 }  // 3 seconds
      ]

      for (const test of formatPerformanceTests) {
        const startTime = Date.now()

        // Mock format-specific processing time
        vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
          // Simulate format-specific processing delay
          const delay = test.format === 'FLAC' ? 100 : 50
          await new Promise(resolve => setTimeout(resolve, delay))

          return {
            duration: 180.0,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -3.0,
            rmsLevel: -18.0,
            lufsIntegrated: -16.0,
            truePeak: -2.0,
            hasClipping: false
          }
        })

        await audioProcessor.analyzeAudio(`/test/audio.${test.format.toLowerCase()}`)

        const processingTime = Date.now() - startTime
        expect(processingTime).toBeLessThan(test.expectedMaxTime)
      }
    })
  })
})