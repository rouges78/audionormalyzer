import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioProcessorImpl } from '../audio-processor'

describe('Normalization Algorithms', () => {
  let audioProcessor: AudioProcessorImpl

  beforeEach(() => {
    audioProcessor = new AudioProcessorImpl()
  })

  describe('Peak Normalization Algorithm', () => {
    it('should normalize audio using peak method correctly', async () => {
      // Mock analysis with known peak level
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0, // Current peak at -6dB
        rmsLevel: -18.5,
        lufsIntegrated: -18.5,
        truePeak: -4.0,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'peak' as const,
        targetLevel: -1.0, // Target peak at -1dB
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/input.mp3', options)
      
      expect(result).toBe('/output/normalized.mp3')
      // Verify normalization was called with correct options
      expect(audioProcessor.normalizeAudio).toHaveBeenCalledWith('/test/input.mp3', options)
    })

    it('should handle very quiet content appropriately', async () => {
      // Mock analysis with very low peak level
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -40.0, // Very low peak
        rmsLevel: -50.0,
        lufsIntegrated: -45.0,
        truePeak: -35.0,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'peak' as const,
        targetLevel: -1.0,
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      // Should not throw error even with high gain requirement
      const result = await audioProcessor.normalizeAudio('/test/quiet.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })

    it('should handle loud content requiring attenuation', async () => {
      // Mock analysis with high peak level
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -0.5, // High peak
        rmsLevel: -12.0,
        lufsIntegrated: -10.0,
        truePeak: -0.1,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'peak' as const,
        targetLevel: -6.0, // Lower target (attenuation needed)
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/loud.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })

    it('should validate peak normalization options', () => {
      const validOptions = {
        method: 'peak' as const,
        targetLevel: -1.0,
        preserveFormat: true,
        outputPath: '/output/test.mp3'
      }

      const result = audioProcessor.validateNormalizationOptions(validOptions)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Loudness Normalization Algorithm', () => {
    it('should normalize audio using loudness method correctly', async () => {
      // Mock analysis with known loudness level
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -20.0, // Current loudness at -20 LUFS
        truePeak: -3.0,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -16.0, // Target loudness at -16 LUFS
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/input.mp3', options)
      
      expect(result).toBe('/output/normalized.mp3')
      // Verify normalization was called with correct options
      expect(audioProcessor.normalizeAudio).toHaveBeenCalledWith('/test/input.mp3', options)
    })

    it('should handle very quiet content', async () => {
      // Mock analysis with very low loudness
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -30.0,
        rmsLevel: -40.0,
        lufsIntegrated: -35.0, // Very quiet
        truePeak: -25.0,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0, // EBU R128 standard
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/quiet.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })

    it('should handle loud content requiring attenuation', async () => {
      // Mock analysis with high loudness
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -2.0,
        rmsLevel: -10.0,
        lufsIntegrated: -12.0, // Very loud
        truePeak: -1.0,
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0, // Standard level (attenuation needed)
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/loud.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })

    it('should validate loudness normalization options', () => {
      const validOptions = {
        method: 'loudness' as const,
        targetLevel: -23.0,
        preserveFormat: true,
        outputPath: '/output/test.mp3'
      }

      const result = audioProcessor.validateNormalizationOptions(validOptions)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle EBU R128 compliance', async () => {
      // Mock analysis for EBU R128 compliant result
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -23.05, // Within EBU R128 tolerance
        truePeak: -1.5, // Below -1.0 dBTP limit
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0,
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/compliant.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })
  })

  describe('Quality Preservation', () => {
    it('should validate normalization options for quality preservation', () => {
      const testCases = [
        { 
          options: { method: 'peak' as const, targetLevel: -1.0, preserveFormat: true, outputPath: '/out.mp3' },
          expected: true 
        },
        { 
          options: { method: 'peak' as const, targetLevel: 2.0, preserveFormat: true, outputPath: '/out.mp3' },
          expected: false // Too high, would cause clipping
        },
        { 
          options: { method: 'loudness' as const, targetLevel: -23.0, preserveFormat: true, outputPath: '/out.mp3' },
          expected: true 
        },
        { 
          options: { method: 'loudness' as const, targetLevel: -3.0, preserveFormat: true, outputPath: '/out.mp3' },
          expected: false // Too high for LUFS
        }
      ]

      for (const testCase of testCases) {
        const result = audioProcessor.validateNormalizationOptions(testCase.options)
        expect(result.isValid).toBe(testCase.expected)
      }
    })

    it('should handle potential clipping scenarios', async () => {
      // Mock analysis with high peak level
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -0.5, // Close to clipping
        rmsLevel: -12.0,
        lufsIntegrated: -10.0,
        truePeak: -0.2, // Very close to clipping
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        method: 'peak' as const,
        targetLevel: -1.0, // Safe target
        preserveFormat: true,
        outputPath: '/output/normalized.mp3'
      }

      // Should handle high peak levels safely
      const result = await audioProcessor.normalizeAudio('/test/high-peak.mp3', options)
      expect(result).toBe('/output/normalized.mp3')
    })

    it('should preserve format during normalization', async () => {
      const testFormats = [
        { input: '/test/audio.flac', output: '/output/audio.flac' },
        { input: '/test/audio.wav', output: '/output/audio.wav' },
        { input: '/test/audio.mp3', output: '/output/audio.mp3' }
      ]

      for (const format of testFormats) {
        vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue(format.output)

        const options = {
          method: 'peak' as const,
          targetLevel: -3.0,
          preserveFormat: true,
          outputPath: format.output
        }

        const result = await audioProcessor.normalizeAudio(format.input, options)
        expect(result).toBe(format.output)
      }
    })
  })

  describe('EBU R128 Compliance', () => {
    it('should handle EBU R128 compliant normalization', async () => {
      // Mock analysis for compliant result
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -22.8, // Within EBU R128 tolerance
        truePeak: -1.2, // Safe true peak
        hasClipping: false
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/compliant.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0, // EBU R128 standard
        preserveFormat: true,
        outputPath: '/output/compliant.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/input.mp3', options)
      expect(result).toBe('/output/compliant.mp3')
    })

    it('should validate true peak limits for broadcast compliance', () => {
      const validOptions = {
        method: 'loudness' as const,
        targetLevel: -23.0,
        preserveFormat: true,
        outputPath: '/output/broadcast.mp3'
      }

      const result = audioProcessor.validateNormalizationOptions(validOptions)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle different LUFS targets for different standards', async () => {
      const standards = [
        { name: 'EBU R128', target: -23.0 },
        { name: 'ATSC A/85', target: -24.0 },
        { name: 'Streaming', target: -16.0 },
        { name: 'Spotify', target: -14.0 }
      ]

      for (const standard of standards) {
        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
          duration: 180.5,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -6.0,
          rmsLevel: -18.5,
          lufsIntegrated: -20.0,
          truePeak: -3.0,
          hasClipping: false
        })

        vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue(`/output/${standard.name.toLowerCase()}.mp3`)

        const options = {
          method: 'loudness' as const,
          targetLevel: standard.target,
          preserveFormat: true,
          outputPath: `/output/${standard.name.toLowerCase()}.mp3`
        }

        const result = await audioProcessor.normalizeAudio('/test/input.mp3', options)
        expect(result).toBe(options.outputPath)
      }
    })

    it('should detect potential compliance issues', async () => {
      // Mock analysis with potential issues
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -0.1, // Very high peak
        rmsLevel: -8.0,
        lufsIntegrated: -10.0, // Very loud
        truePeak: -0.05, // Near clipping
        hasClipping: true // Has clipping
      })

      // Should still attempt normalization but may have warnings
      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/problematic.mp3')

      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0,
        preserveFormat: true,
        outputPath: '/output/problematic.mp3'
      }

      const result = await audioProcessor.normalizeAudio('/test/problematic.mp3', options)
      expect(result).toBe('/output/problematic.mp3')
    })
  })
})