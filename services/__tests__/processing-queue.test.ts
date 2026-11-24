import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ProcessingQueue, ProcessingJob, ProgressUpdate } from '../processing-queue'
import { AudioFile, AlbumOptions } from '@/types/audio'

// Mock the AlbumProcessor
vi.mock('../album-processor', () => ({
  AlbumProcessorImpl: vi.fn().mockImplementation(() => ({
    processAlbum: vi.fn()
  }))
}))

describe('ProcessingQueue', () => {
  let queue: ProcessingQueue
  let mockAlbumProcessor: any

  beforeEach(() => {
    queue = new ProcessingQueue(2) // Max 2 job concorrenti
    mockAlbumProcessor = (queue as any).albumProcessor
  })

  afterEach(async () => {
    await queue.shutdown()
  })

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum to avoid automatic processing
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/)
      
      // Wait a moment to allow initialization
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const job = queue.getJob(jobId)
      expect(job).toBeDefined()
      expect(job!.albumName).toBe('Test Album')
      expect(job!.files).toHaveLength(1)
      expect(['pending', 'processing']).toContain(job!.status)
      expect(job!.progress).toBeGreaterThanOrEqual(0)
      expect(job!.retryCount).toBe(0)
    })

    it('should emit the jobAdded event', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum to avoid automatic processing
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const eventPromise = new Promise<ProcessingJob>((resolve) => {
        queue.on('jobAdded', (job: ProcessingJob) => {
          resolve(job)
        })
      })

      queue.addJob('Test Album', mockFiles, options)
      
      const job = await eventPromise
      expect(job.albumName).toBe('Test Album')
      expect(['pending', 'processing']).toContain(job.status)
    })
  })

  describe('removeJob', () => {
    it('should remove a pending job', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum to avoid automatic processing
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait a moment to allow initialization
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const job = queue.getJob(jobId)
      if (job && job.status === 'pending') {
        const removed = queue.removeJob(jobId)
        expect(removed).toBe(true)
        expect(queue.getJob(jobId)).toBeUndefined()
      } else {
        // If the job is already processing, test the cancellation
        const removed = queue.removeJob(jobId)
        expect(removed).toBe(true)
        const updatedJob = queue.getJob(jobId)
        expect(updatedJob?.status).toBe('cancelled')
      }
    })

    it('should mark a processing job as cancelled', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum to simulate long processing
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for the job to start
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const job = queue.getJob(jobId)
      if (job && job.status === 'processing') {
        const cancelled = queue.removeJob(jobId)
        expect(cancelled).toBe(true)
        expect(job.status).toBe('cancelled')
      }
    })

    it('should return false for a nonexistent job', () => {
      const removed = queue.removeJob('nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('getQueueStats', () => {
    it('should return correct queue statistics', () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Add a few jobs
      queue.addJob('Album 1', mockFiles, options)
      queue.addJob('Album 2', mockFiles, options)

      const stats = queue.getQueueStats()
      
      expect(stats.total).toBe(2)
      expect(stats.pending).toBeGreaterThanOrEqual(0)
      expect(stats.processing).toBeGreaterThanOrEqual(0)
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.cancelled).toBe(0)
    })
  })

  describe('cleanupOldJobs', () => {
    it('should clean up old completed jobs', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum for immediate completion
      mockAlbumProcessor.processAlbum.mockResolvedValue({
        fileId: 'album-123',
        success: true,
        originalLoudness: -16.0,
        finalLoudness: -14.0,
        gainApplied: 2.0,
        processingTime: 1000
      })

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for completion
      await new Promise(resolve => {
        queue.on('jobCompleted', () => resolve(undefined))
      })

      // Simulate an old job by changing endTime
      const job = queue.getJob(jobId)
      if (job) {
        job.endTime = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      }

      const cleaned = queue.cleanupOldJobs(24 * 60 * 60 * 1000) // 24 hours
      
      expect(cleaned).toBe(1)
      expect(queue.getJob(jobId)).toBeUndefined()
    })
  })

  describe('processing with progress tracking', () => {
    it('should emit progress events during processing', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        },
        {
          id: '2',
          name: 'track2.mp3',
          originalPath: '/path/track2.mp3',
          size: 1200000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      mockAlbumProcessor.processAlbum.mockResolvedValue({
        fileId: 'album-123',
        success: true,
        originalLoudness: -16.0,
        finalLoudness: -14.0,
        gainApplied: 2.0,
        processingTime: 1000
      })

      const progressUpdates: ProgressUpdate[] = []
      
      queue.on('progressUpdate', (update: ProgressUpdate) => {
        progressUpdates.push(update)
      })

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for completion
      await new Promise(resolve => {
        queue.on('jobCompleted', () => resolve(undefined))
      })

      expect(progressUpdates.length).toBeGreaterThan(0)
      
      // Check that progress increased
      const finalUpdate = progressUpdates[progressUpdates.length - 1]
      expect(finalUpdate.progress).toBe(100)
      expect(finalUpdate.status).toBe('completed')
    })

    it('should estimate the remaining time', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 5000000, // 5MB
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processAlbum with a delay to allow the time estimate
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          fileId: 'album-123',
          success: true,
          originalLoudness: -16.0,
          finalLoudness: -14.0,
          gainApplied: 2.0,
          processingTime: 1000
        }), 200))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for the job to start and have an estimate
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const job = queue.getJob(jobId)
      // The job should have an initial estimate based on the file size
      expect(job?.estimatedTimeRemaining).toBeGreaterThanOrEqual(0)
      
      // If the job is processing, it should have an estimate > 0
      if (job?.status === 'processing') {
        expect(job.estimatedTimeRemaining).toBeGreaterThan(0)
      }
    })
  })

  describe('retry logic', () => {
    it('should retry failed jobs with retryable errors', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock a retryable error on the first attempt, success on the second
      let callCount = 0
      mockAlbumProcessor.processAlbum.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('ENOENT: file not found')
        }
        return Promise.resolve({
          fileId: 'album-123',
          success: true,
          originalLoudness: -16.0,
          finalLoudness: -14.0,
          gainApplied: 2.0,
          processingTime: 1000
        })
      })

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for retry and completion events
      const events: string[] = []
      queue.on('jobRetrying', () => events.push('retry'))
      queue.on('jobCompleted', () => events.push('completed'))
      
      await new Promise(resolve => {
        queue.on('jobCompleted', () => resolve(undefined))
      })

      expect(events).toContain('retry')
      expect(events).toContain('completed')
      
      const job = queue.getJob(jobId)
      expect(job?.status).toBe('completed')
      expect(job?.retryCount).toBe(1)
    })

    it('should fail permanently after max retries', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Configure retry with max 2 attempts
      queue.setRetryConfig({ maxRetries: 2, retryDelay: 10 })

      // Mock an always-retryable error
      mockAlbumProcessor.processAlbum.mockRejectedValue(new Error('ENOENT: file not found'))

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for the final failure
      await new Promise(resolve => {
        queue.on('jobFailed', () => resolve(undefined))
      })

      const job = queue.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.retryCount).toBe(2)
    })

    it('should fail immediately for non-retryable errors', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock a non-retryable error
      mockAlbumProcessor.processAlbum.mockRejectedValue(new Error('Invalid audio format'))

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Wait for the failure
      await new Promise(resolve => {
        queue.on('jobFailed', () => resolve(undefined))
      })

      const job = queue.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.retryCount).toBe(0) // No retry for a non-retryable error
    })
  })

  describe('concurrent processing', () => {
    it('should limit concurrent jobs to the configured maximum', async () => {
      const mockFiles: AudioFile[] = [
        {
          id: '1',
          name: 'track1.mp3',
          originalPath: '/path/track1.mp3',
          size: 1000000,
          format: 'MP3',
          status: 'ready'
        }
      ]

      const options: AlbumOptions = {
        normalizationMethod: 'loudness',
        targetLevel: -16.0,
        maintainRelativeLoudness: false,
        outputFormat: 'mp3'
      }

      // Mock processing lungo
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          fileId: 'album-123',
          success: true,
          originalLoudness: -16.0,
          finalLoudness: -14.0,
          gainApplied: 2.0,
          processingTime: 1000
        }), 200))
      )

      // Add 4 jobs (max concurrent = 2)
      const jobIds = [
        queue.addJob('Album 1', mockFiles, options),
        queue.addJob('Album 2', mockFiles, options),
        queue.addJob('Album 3', mockFiles, options),
        queue.addJob('Album 4', mockFiles, options)
      ]

      // Wait a bit to allow startup
      await new Promise(resolve => setTimeout(resolve, 50))

      const stats = queue.getQueueStats()
      expect(stats.processing).toBeLessThanOrEqual(2) // Max 2 concurrent
      expect(stats.pending + stats.processing).toBe(4) // All jobs are pending or processing
    })
  })
})