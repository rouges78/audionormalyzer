import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AlbumProcessorImpl } from '../../services/album-processor'
import { AudioProcessorImpl } from '../../services/audio-processor'
import { ProcessingQueueImpl } from '../../services/processing-queue'

describe('Large Album Performance Integration Tests', () => {
  let albumProcessor: AlbumProcessorImpl
  let audioProcessor: AudioProcessorImpl
  let processingQueue: ProcessingQueueImpl

  beforeEach(() => {
    albumProcessor = new AlbumProcessorImpl()
    audioProcessor = new AudioProcessorImpl()
    processingQueue = new ProcessingQueueImpl()
  })

  describe('Large Album Processing Performance', () => {
    it('should process 50-track album within acceptable time', async () => {
      const albumSize = 50
      const startTime = Date.now()

      // Create mock album with 50 tracks
      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `track-${i + 1}`,
        name: `Track ${String(i + 1).padStart(2, '0')}.mp3`,
        tempPath: `/temp/track-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -23.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      // Mock efficient processing
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        // Simulate realistic processing time (50ms per track)
        await new Promise(resolve => setTimeout(resolve, 50))
        
        return {
          duration: 180 + Math.random() * 120, // 3-5 minutes per track
          sampleRate: 44100,
          channels: 2,
          peakLevel: -6.0 + Math.random() * 3,
          rmsLevel: -20.0 + Math.random() * 5,
          lufsIntegrated: -18.0 + Math.random() * 4,
          truePeak: -3.0 + Math.random() * 2,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string, options) => {
        // Simulate normalization time (30ms per track)
        await new Promise(resolve => setTimeout(resolve, 30))
        return `/output/${filePath.split('/').pop()}`
      })

      const result = await albumProcessor.processAlbum(albumFiles, options)

      const totalTime = Date.now() - startTime

      expect(result.totalFiles).toBe(albumSize)
      expect(result.successfulFiles).toBe(albumSize)
      expect(result.failedFiles).toBe(0)
      
      // Should complete within 30 seconds for 50 tracks
      expect(totalTime).toBeLessThan(30000)
      
      // Performance metrics
      const avgTimePerTrack = totalTime / albumSize
      expect(avgTimePerTrack).toBeLessThan(600) // Less than 600ms per track
    })

    it('should handle 100-track compilation efficiently', async () => {
      const compilationSize = 100
      const startTime = Date.now()

      // Create mock compilation with mixed formats
      const compilationFiles = Array.from({ length: compilationSize }, (_, i) => {
        const formats = ['mp3', 'flac', 'wav', 'aac']
        const format = formats[i % formats.length]
        
        return {
          id: `comp-track-${i + 1}`,
          name: `Compilation Track ${String(i + 1).padStart(3, '0')}.${format}`,
          tempPath: `/temp/comp-track-${i + 1}.${format}`,
          format: format.toUpperCase(),
          status: 'ready' as const
        }
      })

      const options = {
        normalizationMethod: 'peak' as const,
        targetLevel: -1.0,
        maintainRelativeLoudness: false,
        outputFormat: 'preserve'
      }

      // Mock concurrent processing with batching
      let concurrentTasks = 0
      const maxConcurrent = 5

      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        // Limit concurrent processing
        while (concurrentTasks >= maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        concurrentTasks++
        
        try {
          // Simulate format-specific processing time
          const isLossless = filePath.includes('.flac') || filePath.includes('.wav')
          const processingTime = isLossless ? 80 : 40
          await new Promise(resolve => setTimeout(resolve, processingTime))
          
          return {
            duration: 200 + Math.random() * 100,
            sampleRate: isLossless ? 96000 : 44100,
            channels: 2,
            peakLevel: -8.0 + Math.random() * 4,
            rmsLevel: -22.0 + Math.random() * 6,
            lufsIntegrated: -20.0 + Math.random() * 6,
            truePeak: -4.0 + Math.random() * 3,
            hasClipping: false
          }
        } finally {
          concurrentTasks--
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string) => {
        // Simulate normalization
        await new Promise(resolve => setTimeout(resolve, 25))
        return `/output/${filePath.split('/').pop()}`
      })

      const result = await albumProcessor.processAlbum(compilationFiles, options)

      const totalTime = Date.now() - startTime

      expect(result.totalFiles).toBe(compilationSize)
      expect(result.successfulFiles).toBe(compilationSize)
      
      // Should complete within 60 seconds for 100 tracks with concurrency
      expect(totalTime).toBeLessThan(60000)
      
      console.log(`Processed ${compilationSize} tracks in ${totalTime}ms (${(totalTime/compilationSize).toFixed(1)}ms per track)`)
    })

    it('should maintain memory efficiency with large albums', async () => {
      const albumSize = 75
      const initialMemory = process.memoryUsage().heapUsed

      // Create large album
      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `memory-test-${i + 1}`,
        name: `Memory Test ${String(i + 1).padStart(2, '0')}.flac`,
        tempPath: `/temp/memory-test-${i + 1}.flac`,
        format: 'FLAC',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -16.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      // Mock memory-efficient processing
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
        // Simulate memory usage and cleanup
        const tempBuffer = Buffer.alloc(1024 * 1024) // 1MB temporary buffer
        
        await new Promise(resolve => setTimeout(resolve, 30))
        
        // Cleanup temporary buffer
        tempBuffer.fill(0)
        
        return {
          duration: 240,
          sampleRate: 96000,
          channels: 2,
          peakLevel: -4.0,
          rmsLevel: -16.0,
          lufsIntegrated: -18.0,
          truePeak: -2.0,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.flac')

      const result = await albumProcessor.processAlbum(albumFiles, options)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      expect(result.totalFiles).toBe(albumSize)
      expect(result.successfulFiles).toBe(albumSize)
      
      // Memory increase should be reasonable (less than 200MB for 75 tracks)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024)
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB for ${albumSize} tracks`)
    })
  })

  describe('Concurrent Processing Limits', () => {
    it('should respect concurrent processing limits', async () => {
      const albumSize = 30
      let maxConcurrentTasks = 0
      let currentConcurrentTasks = 0

      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `concurrent-${i + 1}`,
        name: `Concurrent ${i + 1}.mp3`,
        tempPath: `/temp/concurrent-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'peak' as const,
        targetLevel: -2.0,
        maintainRelativeLoudness: false,
        outputFormat: 'preserve'
      }

      // Track concurrent task count
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
        currentConcurrentTasks++
        maxConcurrentTasks = Math.max(maxConcurrentTasks, currentConcurrentTasks)
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        currentConcurrentTasks--
        
        return {
          duration: 180,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -5.0,
          rmsLevel: -18.0,
          lufsIntegrated: -16.0,
          truePeak: -3.0,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      await albumProcessor.processAlbum(albumFiles, options)

      // Should not exceed reasonable concurrent limit (e.g., 5 tasks)
      expect(maxConcurrentTasks).toBeLessThanOrEqual(5)
      expect(maxConcurrentTasks).toBeGreaterThan(1) // Should use some concurrency
      
      console.log(`Max concurrent tasks: ${maxConcurrentTasks}`)
    })

    it('should handle processing queue overflow gracefully', async () => {
      const overflowSize = 200 // Very large album
      
      const albumFiles = Array.from({ length: overflowSize }, (_, i) => ({
        id: `overflow-${i + 1}`,
        name: `Overflow ${i + 1}.mp3`,
        tempPath: `/temp/overflow-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -23.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      // Mock processing with queue management
      let queueSize = 0
      const maxQueueSize = 10

      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
        // Simulate queue management
        while (queueSize >= maxQueueSize) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        queueSize++
        
        try {
          await new Promise(resolve => setTimeout(resolve, 20))
          
          return {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            peakLevel: -6.0,
            rmsLevel: -19.0,
            lufsIntegrated: -17.0,
            truePeak: -3.5,
            hasClipping: false
          }
        } finally {
          queueSize--
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const startTime = Date.now()
      const result = await albumProcessor.processAlbum(albumFiles, options)
      const totalTime = Date.now() - startTime

      expect(result.totalFiles).toBe(overflowSize)
      expect(result.successfulFiles).toBe(overflowSize)
      
      // Should complete even very large albums (within 2 minutes)
      expect(totalTime).toBeLessThan(120000)
      
      console.log(`Processed ${overflowSize} tracks in ${(totalTime/1000).toFixed(1)} seconds`)
    })
  })

  describe('Error Handling in Large Albums', () => {
    it('should handle partial failures in large albums', async () => {
      const albumSize = 40
      const failureRate = 0.1 // 10% failure rate

      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `partial-fail-${i + 1}`,
        name: `Partial Fail ${i + 1}.mp3`,
        tempPath: `/temp/partial-fail-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'peak' as const,
        targetLevel: -1.0,
        maintainRelativeLoudness: false,
        outputFormat: 'preserve'
      }

      // Mock processing with random failures
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        await new Promise(resolve => setTimeout(resolve, 30))
        
        // Simulate random failures
        if (Math.random() < failureRate) {
          throw new Error(`Processing failed for ${filePath}`)
        }
        
        return {
          duration: 180,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -5.0,
          rmsLevel: -18.0,
          lufsIntegrated: -16.0,
          truePeak: -3.0,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string) => {
        // Some normalization failures too
        if (Math.random() < failureRate / 2) {
          throw new Error(`Normalization failed for ${filePath}`)
        }
        
        return `/output/${filePath.split('/').pop()}`
      })

      const result = await albumProcessor.processAlbum(albumFiles, options)

      expect(result.totalFiles).toBe(albumSize)
      expect(result.successfulFiles + result.failedFiles).toBe(albumSize)
      expect(result.failedFiles).toBeGreaterThan(0) // Should have some failures
      expect(result.successfulFiles).toBeGreaterThan(albumSize * 0.8) // But most should succeed
      expect(result.errors.length).toBe(result.failedFiles)
      
      console.log(`Success rate: ${(result.successfulFiles / albumSize * 100).toFixed(1)}%`)
    })

    it('should recover from temporary processing errors', async () => {
      const albumSize = 25
      let temporaryFailureCount = 0
      const maxTemporaryFailures = 5

      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `recovery-${i + 1}`,
        name: `Recovery ${i + 1}.mp3`,
        tempPath: `/temp/recovery-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -23.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      // Mock processing with temporary failures and recovery
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        await new Promise(resolve => setTimeout(resolve, 40))
        
        // Simulate temporary failures that can be retried
        if (temporaryFailureCount < maxTemporaryFailures && Math.random() < 0.2) {
          temporaryFailureCount++
          throw new Error('Temporary processing error')
        }
        
        return {
          duration: 200,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -4.0,
          rmsLevel: -17.0,
          lufsIntegrated: -19.0,
          truePeak: -2.5,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const result = await albumProcessor.processAlbum(albumFiles, options)

      expect(result.totalFiles).toBe(albumSize)
      // Should recover from temporary failures
      expect(result.successfulFiles).toBeGreaterThan(albumSize * 0.9)
      
      console.log(`Temporary failures encountered: ${temporaryFailureCount}`)
      console.log(`Final success rate: ${(result.successfulFiles / albumSize * 100).toFixed(1)}%`)
    })
  })

  describe('Progress Tracking for Large Albums', () => {
    it('should provide accurate progress updates for large albums', async () => {
      const albumSize = 60
      const progressUpdates: number[] = []

      const albumFiles = Array.from({ length: albumSize }, (_, i) => ({
        id: `progress-${i + 1}`,
        name: `Progress ${i + 1}.mp3`,
        tempPath: `/temp/progress-${i + 1}.mp3`,
        format: 'MP3',
        status: 'ready' as const
      }))

      const options = {
        normalizationMethod: 'peak' as const,
        targetLevel: -2.0,
        maintainRelativeLoudness: false,
        outputFormat: 'preserve'
      }

      let completedFiles = 0

      // Mock processing with progress tracking
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 25))
        
        completedFiles++
        const progress = (completedFiles / albumSize) * 100
        progressUpdates.push(progress)
        
        return {
          duration: 180,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -5.0,
          rmsLevel: -18.0,
          lufsIntegrated: -16.0,
          truePeak: -3.0,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const result = await albumProcessor.processAlbum(albumFiles, options)

      expect(result.totalFiles).toBe(albumSize)
      expect(result.successfulFiles).toBe(albumSize)
      
      // Should have progress updates
      expect(progressUpdates.length).toBe(albumSize)
      expect(progressUpdates[0]).toBeCloseTo(100 / albumSize, 1)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
      
      // Progress should be monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1])
      }
    })
  })
})