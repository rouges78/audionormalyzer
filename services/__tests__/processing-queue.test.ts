import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ProcessingQueue, ProcessingJob, ProgressUpdate } from '../processing-queue'
import { AudioFile, AlbumOptions } from '@/types/audio'

// Mock del AlbumProcessor
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
    it('dovrebbe aggiungere un job alla coda', async () => {
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

      // Mock processAlbum per evitare processing automatico
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/)
      
      // Attende un momento per permettere l'inizializzazione
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const job = queue.getJob(jobId)
      expect(job).toBeDefined()
      expect(job!.albumName).toBe('Test Album')
      expect(job!.files).toHaveLength(1)
      expect(['pending', 'processing']).toContain(job!.status)
      expect(job!.progress).toBeGreaterThanOrEqual(0)
      expect(job!.retryCount).toBe(0)
    })

    it('dovrebbe emettere evento jobAdded', async () => {
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

      // Mock processAlbum per evitare processing automatico
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
    it('dovrebbe rimuovere un job pending', async () => {
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

      // Mock processAlbum per evitare processing automatico
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Attende un momento per permettere l'inizializzazione
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const job = queue.getJob(jobId)
      if (job && job.status === 'pending') {
        const removed = queue.removeJob(jobId)
        expect(removed).toBe(true)
        expect(queue.getJob(jobId)).toBeUndefined()
      } else {
        // Se il job è già in processing, testa la cancellazione
        const removed = queue.removeJob(jobId)
        expect(removed).toBe(true)
        const updatedJob = queue.getJob(jobId)
        expect(updatedJob?.status).toBe('cancelled')
      }
    })

    it('dovrebbe marcare come cancelled un job in processing', async () => {
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

      // Mock processAlbum per simulare processing lungo
      mockAlbumProcessor.processAlbum.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Attende che il job inizi
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const job = queue.getJob(jobId)
      if (job && job.status === 'processing') {
        const cancelled = queue.removeJob(jobId)
        expect(cancelled).toBe(true)
        expect(job.status).toBe('cancelled')
      }
    })

    it('dovrebbe restituire false per job inesistente', () => {
      const removed = queue.removeJob('nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('getQueueStats', () => {
    it('dovrebbe restituire statistiche corrette della coda', () => {
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

      // Aggiunge alcuni job
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
    it('dovrebbe pulire job completati vecchi', async () => {
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

      // Mock processAlbum per completamento immediato
      mockAlbumProcessor.processAlbum.mockResolvedValue({
        fileId: 'album-123',
        success: true,
        originalLoudness: -16.0,
        finalLoudness: -14.0,
        gainApplied: 2.0,
        processingTime: 1000
      })

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Attende completamento
      await new Promise(resolve => {
        queue.on('jobCompleted', () => resolve(undefined))
      })

      // Simula job vecchio modificando endTime
      const job = queue.getJob(jobId)
      if (job) {
        job.endTime = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 ore fa
      }

      const cleaned = queue.cleanupOldJobs(24 * 60 * 60 * 1000) // 24 ore
      
      expect(cleaned).toBe(1)
      expect(queue.getJob(jobId)).toBeUndefined()
    })
  })

  describe('processing con progress tracking', () => {
    it('dovrebbe emettere eventi di progresso durante processing', async () => {
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
      
      // Attende completamento
      await new Promise(resolve => {
        queue.on('jobCompleted', () => resolve(undefined))
      })

      expect(progressUpdates.length).toBeGreaterThan(0)
      
      // Verifica che il progresso sia aumentato
      const finalUpdate = progressUpdates[progressUpdates.length - 1]
      expect(finalUpdate.progress).toBe(100)
      expect(finalUpdate.status).toBe('completed')
    })

    it('dovrebbe stimare il tempo rimanente', async () => {
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

      // Mock processAlbum con delay per permettere la stima del tempo
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
      
      // Attende che il job inizi e abbia una stima
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const job = queue.getJob(jobId)
      // Il job dovrebbe avere una stima iniziale basata sulla dimensione del file
      expect(job?.estimatedTimeRemaining).toBeGreaterThanOrEqual(0)
      
      // Se il job è in processing, dovrebbe avere una stima > 0
      if (job?.status === 'processing') {
        expect(job.estimatedTimeRemaining).toBeGreaterThan(0)
      }
    })
  })

  describe('retry logic', () => {
    it('dovrebbe ritentare job falliti con errori ritentabili', async () => {
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

      // Mock errore ritentabile al primo tentativo, successo al secondo
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
      
      // Attende eventi di retry e completamento
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

    it('dovrebbe fallire definitivamente dopo max retry', async () => {
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

      // Configura retry con max 2 tentativi
      queue.setRetryConfig({ maxRetries: 2, retryDelay: 10 })

      // Mock errore sempre ritentabile
      mockAlbumProcessor.processAlbum.mockRejectedValue(new Error('ENOENT: file not found'))

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Attende fallimento definitivo
      await new Promise(resolve => {
        queue.on('jobFailed', () => resolve(undefined))
      })

      const job = queue.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.retryCount).toBe(2)
    })

    it('dovrebbe fallire immediatamente per errori non ritentabili', async () => {
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

      // Mock errore non ritentabile
      mockAlbumProcessor.processAlbum.mockRejectedValue(new Error('Invalid audio format'))

      const jobId = queue.addJob('Test Album', mockFiles, options)
      
      // Attende fallimento
      await new Promise(resolve => {
        queue.on('jobFailed', () => resolve(undefined))
      })

      const job = queue.getJob(jobId)
      expect(job?.status).toBe('failed')
      expect(job?.retryCount).toBe(0) // Nessun retry per errore non ritentabile
    })
  })

  describe('concurrent processing', () => {
    it('dovrebbe limitare job concorrenti al massimo configurato', async () => {
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

      // Aggiunge 4 job (max concurrent = 2)
      const jobIds = [
        queue.addJob('Album 1', mockFiles, options),
        queue.addJob('Album 2', mockFiles, options),
        queue.addJob('Album 3', mockFiles, options),
        queue.addJob('Album 4', mockFiles, options)
      ]

      // Attende un po' per permettere l'avvio
      await new Promise(resolve => setTimeout(resolve, 50))

      const stats = queue.getQueueStats()
      expect(stats.processing).toBeLessThanOrEqual(2) // Max 2 concorrenti
      expect(stats.pending + stats.processing).toBe(4) // Tutti i job sono pending o processing
    })
  })
})