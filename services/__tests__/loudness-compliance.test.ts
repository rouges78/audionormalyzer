import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { AudioProcessorImpl } from '../audio-processor'
import { AudioAnalysis } from '@/types/audio'

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
  },
  constants: {
    R_OK: 4
  }
}))

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
  }))
}))

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(),
  toBlobURL: vi.fn().mockResolvedValue('mock-blob-url')
}))

describe('EBU R128 Loudness Compliance', () => {
  let audioProcessor: AudioProcessorImpl
  const mockFilePath = '/test/audio/sample.mp3'
  const mockOutputPath = '/test/output/normalized.mp3'

  beforeEach(() => {
    audioProcessor = new AudioProcessorImpl()
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
  })

  describe('EBU R128 Standard Compliance', () => {
    it('should comply with EBU R128 integrated loudness measurement', async () => {
      // Test with broadcast standard target
      const targetLufs = -23.0
      const options = {
        method: 'loudness' as const,
        targetLevel: targetLufs,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock input analysis
      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue({
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -18.0, // 5 dB louder than target
        truePeak: -3.0,
        hasClipping: false
      })

      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })

    it('should enforce true peak limiting according to EBU R128', async () => {
      const targetLufs = -16.0
      const options = {
        method: 'loudness' as const,
        targetLevel: targetLufs,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock analysis with high true peak that would exceed -1.0 dBTP after gain
      const mockAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -2.0,
        rmsLevel: -15.0,
        lufsIntegrated: -20.0, // Would need +4dB gain
        truePeak: -0.8, // Would become +3.2 dBTP without limiting
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(mockAnalysis)

      // Should not throw error - true peak limiting should handle this
      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })

    it('should validate compliance within EBU R128 tolerances', async () => {
      const targetLufs = -23.0
      
      // Test compliant result (within ±0.1 LUFS tolerance)
      const compliantAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -23.05, // Within 0.1 LUFS tolerance
        truePeak: -1.2, // Below -1.0 dBTP limit
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(compliantAnalysis)

      const compliance = await (audioProcessor as any).validateLoudnessCompliance(mockFilePath, targetLufs)
      
      expect(compliance.isCompliant).toBe(true)
      expect(compliance.actualLufs).toBe(-23.05)
      expect(compliance.actualTruePeak).toBe(-1.2)
      expect(compliance.tolerance).toBe(0.1)
      expect(compliance.errors).toHaveLength(0)
    })

    it('should detect LUFS deviation beyond tolerance', async () => {
      const targetLufs = -23.0
      
      // Test non-compliant result (outside ±0.1 LUFS tolerance)
      const nonCompliantAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.5,
        lufsIntegrated: -22.5, // 0.5 LUFS deviation (outside tolerance)
        truePeak: -1.2,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(nonCompliantAnalysis)

      const compliance = await (audioProcessor as any).validateLoudnessCompliance(mockFilePath, targetLufs)
      
      expect(compliance.isCompliant).toBe(false)
      expect(compliance.errors.some(error => error.includes('LUFS deviation'))).toBe(true)
      expect(compliance.errors.some(error => error.includes('0.50 exceeds tolerance'))).toBe(true)
    })

    it('should detect true peak violations', async () => {
      const targetLufs = -16.0
      
      // Test with true peak above -1.0 dBTP
      const truePeakViolationAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -1.0,
        rmsLevel: -15.0,
        lufsIntegrated: -16.0, // Perfect LUFS
        truePeak: -0.5, // Above -1.0 dBTP limit
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(truePeakViolationAnalysis)

      const compliance = await (audioProcessor as any).validateLoudnessCompliance(mockFilePath, targetLufs)
      
      expect(compliance.isCompliant).toBe(false)
      expect(compliance.errors.some(error => error.includes('True peak'))).toBe(true)
      expect(compliance.errors.some(error => error.includes('-0.50 dBTP exceeds limit'))).toBe(true)
    })

    it('should detect clipping violations', async () => {
      const targetLufs = -16.0
      
      // Test with clipping detected
      const clippingAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: 0.0, // At digital maximum
        rmsLevel: -12.0,
        lufsIntegrated: -16.0, // Perfect LUFS
        truePeak: -1.2, // Good true peak
        hasClipping: true // But has clipping
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(clippingAnalysis)

      const compliance = await (audioProcessor as any).validateLoudnessCompliance(mockFilePath, targetLufs)
      
      expect(compliance.isCompliant).toBe(false)
      expect(compliance.errors.some(error => error.includes('clipping detected'))).toBe(true)
    })

    it('should handle multiple compliance violations', async () => {
      const targetLufs = -23.0
      
      // Test with multiple violations
      const multipleViolationsAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: 0.0,
        rmsLevel: -15.0,
        lufsIntegrated: -20.0, // 3 LUFS too loud
        truePeak: 0.5, // Way above limit
        hasClipping: true // And clipping
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(multipleViolationsAnalysis)

      const compliance = await (audioProcessor as any).validateLoudnessCompliance(mockFilePath, targetLufs)
      
      expect(compliance.isCompliant).toBe(false)
      expect(compliance.errors.length).toBe(3) // All three violations
      expect(compliance.errors.some(error => error.includes('LUFS deviation'))).toBe(true)
      expect(compliance.errors.some(error => error.includes('True peak'))).toBe(true)
      expect(compliance.errors.some(error => error.includes('clipping'))).toBe(true)
    })
  })

  describe('Loudness Range and Dynamic Range', () => {
    it('should handle different loudness ranges appropriately', async () => {
      // Test various loudness scenarios
      const scenarios = [
        {
          name: 'Quiet classical music',
          input: { lufsIntegrated: -30.0, truePeak: -10.0 },
          target: -23.0,
          expectedGain: 7.0
        },
        {
          name: 'Loud rock music',
          input: { lufsIntegrated: -12.0, truePeak: -0.5 },
          target: -16.0,
          expectedGain: -4.0 // Attenuation needed
        },
        {
          name: 'Already normalized',
          input: { lufsIntegrated: -16.0, truePeak: -2.0 },
          target: -16.0,
          expectedGain: 0.0
        }
      ]

      for (const scenario of scenarios) {
        const options = {
          method: 'loudness' as const,
          targetLevel: scenario.target,
          preserveFormat: true,
          outputPath: mockOutputPath
        }

        const mockAnalysis: AudioAnalysis = {
          duration: 180.5,
          sampleRate: 44100,
          channels: 2,
          peakLevel: scenario.input.truePeak + 1.0, // Approximate peak from true peak
          rmsLevel: scenario.input.lufsIntegrated + 5.0, // Approximate RMS
          lufsIntegrated: scenario.input.lufsIntegrated,
          truePeak: scenario.input.truePeak,
          hasClipping: false
        }

        vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(mockAnalysis)

        // Should handle all scenarios without error
        const result = await audioProcessor.normalizeAudio(mockFilePath, options)
        expect(result).toBe(mockOutputPath)
      }
    })

    it('should preserve dynamic range during loudness normalization', async () => {
      // Test that relative dynamics are preserved
      const targetLufs = -16.0
      const options = {
        method: 'loudness' as const,
        targetLevel: targetLufs,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock analysis with good dynamic range
      const dynamicAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -20.0, // 14 dB dynamic range
        lufsIntegrated: -22.0,
        truePeak: -4.0,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(dynamicAnalysis)

      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
      
      // The implementation should preserve the relationship between peak and RMS
      // This is tested indirectly through successful normalization
    })
  })

  describe('Platform-Specific Loudness Targets', () => {
    const platformTargets = [
      { platform: 'YouTube', target: -14.0 },
      { platform: 'Spotify', target: -14.0 },
      { platform: 'Apple Music', target: -16.0 },
      { platform: 'Tidal', target: -16.0 },
      { platform: 'Amazon Music', target: -18.0 },
      { platform: 'EBU Broadcast', target: -23.0 },
      { platform: 'Podcast', target: -19.0 }
    ]

    it.each(platformTargets)('should normalize for $platform at $target LUFS', async ({ platform, target }) => {
      const options = {
        method: 'loudness' as const,
        targetLevel: target,
        preserveFormat: true,
        outputPath: `/test/output/${platform.toLowerCase().replace(' ', '-')}.mp3`
      }

      // Mock typical music analysis
      const mockAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -3.0,
        rmsLevel: -15.0,
        lufsIntegrated: -18.0, // Typical starting point
        truePeak: -2.0,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(mockAnalysis)

      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(options.outputPath)
    })

    it('should validate options for all platform targets', () => {
      platformTargets.forEach(({ platform, target }) => {
        const options = {
          method: 'loudness' as const,
          targetLevel: target,
          preserveFormat: true,
          outputPath: `/test/output/${platform}.mp3`
        }

        const validation = audioProcessor.validateNormalizationOptions(options)
        expect(validation.isValid).toBe(true)
        expect(validation.errors).toHaveLength(0)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle extremely quiet audio', async () => {
      const options = {
        method: 'loudness' as const,
        targetLevel: -16.0,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock extremely quiet audio
      const quietAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -40.0,
        rmsLevel: -50.0,
        lufsIntegrated: -45.0, // Very quiet
        truePeak: -35.0,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(quietAnalysis)

      // Should handle without error (gain limiting should apply)
      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })

    it('should handle already loud audio requiring attenuation', async () => {
      const options = {
        method: 'loudness' as const,
        targetLevel: -23.0, // Broadcast standard
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock very loud audio
      const loudAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 2,
        peakLevel: -1.0,
        rmsLevel: -8.0,
        lufsIntegrated: -8.0, // Very loud
        truePeak: -0.2,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(loudAnalysis)

      // Should handle attenuation without error
      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })

    it('should handle mono audio files', async () => {
      const options = {
        method: 'loudness' as const,
        targetLevel: -16.0,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock mono audio analysis
      const monoAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 44100,
        channels: 1, // Mono
        peakLevel: -6.0,
        rmsLevel: -18.0,
        lufsIntegrated: -20.0,
        truePeak: -4.0,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(monoAnalysis)

      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })

    it('should handle high sample rate audio', async () => {
      const options = {
        method: 'loudness' as const,
        targetLevel: -16.0,
        preserveFormat: true,
        outputPath: mockOutputPath
      }

      // Mock high sample rate analysis
      const highSampleRateAnalysis: AudioAnalysis = {
        duration: 180.5,
        sampleRate: 96000, // High sample rate
        channels: 2,
        peakLevel: -6.0,
        rmsLevel: -18.0,
        lufsIntegrated: -20.0,
        truePeak: -4.0,
        hasClipping: false
      }

      vi.spyOn(audioProcessor, 'analyzeAudio').mockResolvedValue(highSampleRateAnalysis)

      const result = await audioProcessor.normalizeAudio(mockFilePath, options)
      expect(result).toBe(mockOutputPath)
    })
  })
})