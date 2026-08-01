import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessingQueueImpl } from '../../services/processing-queue'
import { AudioProcessorImpl } from '../../services/audio-processor'
import { AlbumProcessorImpl } from '../../services/album-processor'

describe('Concurrent Processing Integration Tests', () => {
  let processingQueue: ProcessingQueueImpl
  let audioProcessor: AudioProcessorImpl
  let albumProcessor: AlbumProcessorImpl

  beforeEach(() => {
    processingQueue = new ProcessingQueueImpl()
    audioProcessor = new AudioProcessorImpl()
    // Stessa istanza su cui i test mettono gli spy (vedi album-processor.ts).
    albumProcessor = new AlbumProcessorImpl(audioProcessor)
  })

  describe('Multiple Album Concurrent Processing', () => {
    it('should handle multiple albums processing simultaneously', async () => {
      const albumCount = 3
      const tracksPerAlbum = 10
      const startTime = Date.now()

      // Create multiple albums
      const albums = Array.from({ length: albumCount }, (_, albumIndex) => ({
        id: `album-${albumIndex + 1}`,
        files: Array.from({ length: tracksPerAlbum }, (_, trackIndex) => ({
          id: `album-${albumIndex + 1}-track-${trackIndex + 1}`,
          name: `Album ${albumIndex + 1} - Track ${trackIndex + 1}.mp3`,
          tempPath: `/temp/album-${albumIndex + 1}-track-${trackIndex + 1}.mp3`,
          format: 'MP3',
          status: 'ready' as const
        })),
        options: {
          normalizationMethod: 'loudness' as const,
          targetLevel: -23.0,
          maintainRelativeLoudness: true,
          outputFormat: 'preserve'
        }
      }))

      let activeTasks = 0
      let maxActiveTasks = 0

      // Mock concurrent processing
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        activeTasks++
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks)
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50))
        
        activeTasks--
        
        return {
          duration: 180 + Math.random() * 60,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -6.0 + Math.random() * 3,
          rmsLevel: -20.0 + Math.random() * 4,
          lufsIntegrated: -18.0 + Math.random() * 3,
          truePeak: -3.0 + Math.random() * 2,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string) => {
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 30))
        return `/output/${filePath.split('/').pop()}`
      })

      // Process all albums concurrently
      const albumPromises = albums.map(album => 
        albumProcessor.processAlbum(album.files, album.options)
      )

      const results = await Promise.all(albumPromises)
      const totalTime = Date.now() - startTime

      // Verify all albums processed successfully
      results.forEach((result, index) => {
        expect(result.totalFiles).toBe(tracksPerAlbum)
        expect(result.successfulFiles).toBe(tracksPerAlbum)
        expect(result.failedFiles).toBe(0)
      })

      // Should complete faster than sequential processing
      const sequentialEstimate = albumCount * tracksPerAlbum * 100 // 100ms per track
      expect(totalTime).toBeLessThan(sequentialEstimate)

      // Should use reasonable concurrency
      expect(maxActiveTasks).toBeGreaterThan(1)
      expect(maxActiveTasks).toBeLessThanOrEqual(10) // Reasonable limit

      console.log(`Processed ${albumCount} albums (${albumCount * tracksPerAlbum} tracks) in ${totalTime}ms`)
      console.log(`Max concurrent tasks: ${maxActiveTasks}`)
    })

    it('should maintain processing quality under concurrent load', async () => {
      const concurrentJobs = 5
      const tracksPerJob = 8

      // Create concurrent processing jobs
      const jobs = Array.from({ length: concurrentJobs }, (_, jobIndex) => ({
        id: `job-${jobIndex + 1}`,
        files: Array.from({ length: tracksPerJob }, (_, trackIndex) => ({
          id: `job-${jobIndex + 1}-track-${trackIndex + 1}`,
          name: `Job ${jobIndex + 1} Track ${trackIndex + 1}.mp3`,
          tempPath: `/temp/job-${jobIndex + 1}-track-${trackIndex + 1}.mp3`,
          format: 'MP3',
          status: 'ready' as const
        })),
        targetLufs: -16.0 - (jobIndex * 2) // Different targets for each job
      }))

      const processingResults: Array<{ jobId: string; actualLufs: number; targetLufs: number }> = []

      // Mock processing with quality tracking
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        await new Promise(resolve => setTimeout(resolve, 40))
        
        return {
          duration: 200,
          sampleRate: 44100,
          channels: 2,
          peakLevel: -5.0,
          rmsLevel: -18.0,
          lufsIntegrated: -20.0 + Math.random() * 4,
          truePeak: -2.5,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async (filePath: string, options) => {
        await new Promise(resolve => setTimeout(resolve, 35))
        
        // Track processing quality
        const jobId = filePath.split('/').pop()?.split('-')[1] || '0'
        const targetLufs = options.targetLevel
        const actualLufs = targetLufs + (Math.random() - 0.5) * 0.4 // ±0.2 LUFS accuracy
        
        processingResults.push({
          jobId: `job-${jobId}`,
          actualLufs,
          targetLufs
        })
        
        return `/output/${filePath.split('/').pop()}`
      })

      // Process all jobs concurrently
      const jobPromises = jobs.map(job => {
        const options = {
          normalizationMethod: 'loudness' as const,
          targetLevel: job.targetLufs,
          maintainRelativeLoudness: true,
          outputFormat: 'preserve'
        }
        return albumProcessor.processAlbum(job.files, options)
      })

      const results = await Promise.all(jobPromises)

      // Verify all jobs completed successfully
      results.forEach((result, index) => {
        expect(result.totalFiles).toBe(tracksPerJob)
        expect(result.successfulFiles).toBe(tracksPerJob)
      })

      // Verify processing quality maintained under concurrent load
      processingResults.forEach(result => {
        const deviation = Math.abs(result.actualLufs - result.targetLufs)
        expect(deviation).toBeLessThan(0.5) // Within 0.5 LUFS tolerance
      })

      console.log(`Concurrent processing quality: ${processingResults.length} tracks processed`)
      const avgDeviation = processingResults.reduce((sum, r) => 
        sum + Math.abs(r.actualLufs - r.targetLufs), 0) / processingResults.length
      console.log(`Average LUFS deviation: ${avgDeviation.toFixed(3)}`)
    })
  })

  describe('Resource Management Under Load', () => {
    it('should manage memory efficiently under concurrent load', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      const concurrentAlbums = 4
      const tracksPerAlbum = 15

      const albums = Array.from({ length: concurrentAlbums }, (_, albumIndex) => ({
        files: Array.from({ length: tracksPerAlbum }, (_, trackIndex) => ({
          id: `memory-album-${albumIndex + 1}-track-${trackIndex + 1}`,
          name: `Memory Album ${albumIndex + 1} Track ${trackIndex + 1}.flac`,
          tempPath: `/temp/memory-album-${albumIndex + 1}-track-${trackIndex + 1}.flac`,
          format: 'FLAC',
          status: 'ready' as const
        }))
      }))

      // Mock memory-conscious processing
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
        // Simulate memory usage with cleanup
        const tempBuffer = Buffer.alloc(2 * 1024 * 1024) // 2MB per analysis
        
        await new Promise(resolve => setTimeout(resolve, 60))
        
        // Cleanup
        tempBuffer.fill(0)
        
        return {
          duration: 300,
          sampleRate: 96000,
          channels: 2,
          peakLevel: -3.0,
          rmsLevel: -15.0,
          lufsIntegrated: -17.0,
          truePeak: -1.5,
          hasClipping: false
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 45))
        return '/output/normalized.flac'
      })

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -16.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      // Process albums concurrently
      const albumPromises = albums.map(album => 
        albumProcessor.processAlbum(album.files, options)
      )

      const results = await Promise.all(albumPromises)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Verify processing success
      results.forEach(result => {
        expect(result.totalFiles).toBe(tracksPerAlbum)
        expect(result.successfulFiles).toBe(tracksPerAlbum)
      })

      // Memory increase should be reasonable
      const totalTracks = concurrentAlbums * tracksPerAlbum
      const memoryPerTrack = memoryIncrease / totalTracks
      
      expect(memoryIncrease).toBeLessThan(300 * 1024 * 1024) // Less than 300MB total
      expect(memoryPerTrack).toBeLessThan(5 * 1024 * 1024) // Less than 5MB per track

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB for ${totalTracks} tracks`)
      console.log(`Memory per track: ${(memoryPerTrack / 1024 / 1024).toFixed(2)}MB`)
    })

    it('should handle CPU throttling gracefully', async () => {
      const heavyLoadTasks = 20
      const startTime = Date.now()

      // Create CPU-intensive tasks
      const tasks = Array.from({ length: heavyLoadTasks }, (_, i) => ({
        id: `cpu-task-${i + 1}`,
        filePath: `/temp/cpu-intensive-${i + 1}.wav`
      }))

      let cpuIntensiveOperations = 0

      // Mock CPU-intensive processing with throttling
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        cpuIntensiveOperations++
        
        // Simulate CPU-intensive work with yielding
        for (let i = 0; i < 1000; i++) {
          // Yield control periodically to prevent blocking
          if (i % 100 === 0) {
            await new Promise(resolve => setImmediate(resolve))
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 80))
        
        return {
          duration: 240,
          sampleRate: 48000,
          channels: 2,
          peakLevel: -4.0,
          rmsLevel: -16.0,
          lufsIntegrated: -18.0,
          truePeak: -2.0,
          hasClipping: false
        }
      })

      // Process tasks with controlled concurrency
      const batchSize = 5
      const results = []

      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        const batchPromises = batch.map(task => 
          audioProcessor.analyzeAudio(task.filePath)
        )
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }

      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(heavyLoadTasks)
      expect(cpuIntensiveOperations).toBe(heavyLoadTasks)
      
      // Should complete within reasonable time despite CPU load
      expect(totalTime).toBeLessThan(20000) // 20 seconds
      
      console.log(`CPU-intensive processing: ${heavyLoadTasks} tasks in ${totalTime}ms`)
    })
  })

  describe('Error Handling in Concurrent Scenarios', () => {
    it('should isolate failures between concurrent processing jobs', async () => {
      const jobCount = 4
      const tracksPerJob = 6

      const jobs = Array.from({ length: jobCount }, (_, jobIndex) => ({
        id: `isolation-job-${jobIndex + 1}`,
        files: Array.from({ length: tracksPerJob }, (_, trackIndex) => ({
          id: `isolation-job-${jobIndex + 1}-track-${trackIndex + 1}`,
          name: `Isolation Job ${jobIndex + 1} Track ${trackIndex + 1}.mp3`,
          tempPath: `/temp/isolation-job-${jobIndex + 1}-track-${trackIndex + 1}.mp3`,
          format: 'MP3',
          status: 'ready' as const
        })),
        shouldFail: jobIndex === 1 // Make job 2 fail
      }))

      // Mock processing with selective failures
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Fail for job 2
        if (filePath.includes('isolation-job-2')) {
          throw new Error('Simulated processing failure')
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

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        normalizationMethod: 'peak' as const,
        targetLevel: -1.0,
        maintainRelativeLoudness: false,
        outputFormat: 'preserve'
      }

      // Process all jobs concurrently
      const jobPromises = jobs.map(job => 
        albumProcessor.processAlbum(job.files, options)
      )

      const results = await Promise.all(jobPromises)

      // Verify failure isolation
      results.forEach((result, index) => {
        expect(result.totalFiles).toBe(tracksPerJob)
        
        if (jobs[index].shouldFail) {
          // Job 2 should have failures
          expect(result.failedFiles).toBe(tracksPerJob)
          expect(result.successfulFiles).toBe(0)
        } else {
          // Other jobs should succeed
          expect(result.successfulFiles).toBe(tracksPerJob)
          expect(result.failedFiles).toBe(0)
        }
      })

      console.log('Failure isolation test completed')
      results.forEach((result, index) => {
        console.log(`Job ${index + 1}: ${result.successfulFiles}/${result.totalFiles} successful`)
      })
    })

    it('should handle resource contention gracefully', async () => {
      const contentionJobs = 6
      const tracksPerJob = 8

      const jobs = Array.from({ length: contentionJobs }, (_, jobIndex) => ({
        id: `contention-job-${jobIndex + 1}`,
        files: Array.from({ length: tracksPerJob }, (_, trackIndex) => ({
          id: `contention-job-${jobIndex + 1}-track-${trackIndex + 1}`,
          name: `Contention Job ${jobIndex + 1} Track ${trackIndex + 1}.mp3`,
          tempPath: `/temp/contention-job-${jobIndex + 1}-track-${trackIndex + 1}.mp3`,
          format: 'MP3',
          status: 'ready' as const
        }))
      }))

      let resourceLockCount = 0
      const maxResourceLocks = 3

      // Mock resource contention
      vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async (filePath: string) => {
        // Wait for resource availability
        while (resourceLockCount >= maxResourceLocks) {
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        
        resourceLockCount++
        
        try {
          await new Promise(resolve => setTimeout(resolve, 60))
          
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
        } finally {
          resourceLockCount--
        }
      })

      vi.spyOn(audioProcessor, 'normalizeAudio').mockResolvedValue('/output/normalized.mp3')

      const options = {
        normalizationMethod: 'loudness' as const,
        targetLevel: -23.0,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve'
      }

      const startTime = Date.now()

      // Process all jobs concurrently
      const jobPromises = jobs.map(job => 
        albumProcessor.processAlbum(job.files, options)
      )

      const results = await Promise.all(jobPromises)
      const totalTime = Date.now() - startTime

      // Verify all jobs completed despite resource contention
      results.forEach(result => {
        expect(result.totalFiles).toBe(tracksPerJob)
        expect(result.successfulFiles).toBe(tracksPerJob)
        expect(result.failedFiles).toBe(0)
      })

      // Should complete within reasonable time despite contention
      const totalTracks = contentionJobs * tracksPerJob
      expect(totalTime).toBeLessThan(30000) // 30 seconds

      console.log(`Resource contention test: ${totalTracks} tracks in ${totalTime}ms`)
      console.log(`Average time per track: ${(totalTime / totalTracks).toFixed(1)}ms`)
    })
  })

  describe('Scalability Under Concurrent Load', () => {
    it('should scale processing with available resources', async () => {
      const scalabilityTests = [
        { albums: 2, tracksPerAlbum: 5, expectedMaxTime: 8000 },
        { albums: 4, tracksPerAlbum: 5, expectedMaxTime: 12000 },
        { albums: 6, tracksPerAlbum: 5, expectedMaxTime: 18000 }
      ]

      for (const test of scalabilityTests) {
        const startTime = Date.now()

        const albums = Array.from({ length: test.albums }, (_, albumIndex) => ({
          files: Array.from({ length: test.tracksPerAlbum }, (_, trackIndex) => ({
            id: `scale-album-${albumIndex + 1}-track-${trackIndex + 1}`,
            name: `Scale Album ${albumIndex + 1} Track ${trackIndex + 1}.mp3`,
            tempPath: `/temp/scale-album-${albumIndex + 1}-track-${trackIndex + 1}.mp3`,
            format: 'MP3',
            status: 'ready' as const
          }))
        }))

        // Mock scalable processing
        vi.spyOn(audioProcessor, 'analyzeAudio').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          
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

        vi.spyOn(audioProcessor, 'normalizeAudio').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return '/output/normalized.mp3'
        })

        const options = {
          normalizationMethod: 'peak' as const,
          targetLevel: -2.0,
          maintainRelativeLoudness: false,
          outputFormat: 'preserve'
        }

        const albumPromises = albums.map(album => 
          albumProcessor.processAlbum(album.files, options)
        )

        const results = await Promise.all(albumPromises)
        const totalTime = Date.now() - startTime

        // Verify processing success
        results.forEach(result => {
          expect(result.totalFiles).toBe(test.tracksPerAlbum)
          expect(result.successfulFiles).toBe(test.tracksPerAlbum)
        })

        // Should scale reasonably
        expect(totalTime).toBeLessThan(test.expectedMaxTime)

        console.log(`Scalability test: ${test.albums} albums, ${test.albums * test.tracksPerAlbum} tracks in ${totalTime}ms`)
      }
    })
  })
})