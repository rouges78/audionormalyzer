import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ProcessingStorage, ProcessingResult } from '@/lib/processing-storage'

describe('Process API Integration Tests', () => {
  beforeEach(() => {
    // Clear processing storage before each test
    ProcessingStorage.clear()
  })

  afterEach(() => {
    // Clean up after each test
    ProcessingStorage.clear()
  })

  describe('GET /api/process/[id]', () => {
    it('should return error when process ID is missing', async () => {
      const { GET } = await import('../[id]/route')
      
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_PROCESS_ID')
      expect(data.error).toBe('ID processo richiesto')
    })

    it('should return 404 when process not found', async () => {
      const { GET } = await import('../[id]/route')
      
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('PROCESS_NOT_FOUND')
      expect(data.error).toBe('Processo non trovato')
    })

    it('should return processing data when found', async () => {
      const { GET } = await import('../[id]/route')
      
      // Create test processing data
      const testProcessing: ProcessingResult = {
        id: 'test-process-id',
        status: 'processing',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 2,
        processedFiles: 1,
        results: [
          {
            fileId: 'file-1',
            fileName: 'test1.mp3',
            success: true,
            outputPath: '/output/test1-normalized.mp3',
            originalLoudness: -18.5,
            finalLoudness: -16.0,
            gainApplied: 2.5,
            processingTime: 1500
          }
        ],
        startTime: new Date(),
        error: null
      }
      
      ProcessingStorage.set('test-process-id', testProcessing)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'test-process-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('test-process-id')
      expect(data.data.status).toBe('processing')
      expect(data.data.progress).toBe(50) // 1/2 * 100
      expect(data.data.method).toBe('loudness')
      expect(data.data.targetLevel).toBe(-16)
      expect(data.data.totalFiles).toBe(2)
      expect(data.data.processedFiles).toBe(1)
      expect(data.data.results).toHaveLength(1)
      expect(data.data.results[0].success).toBe(true)
    })

    it('should include summary statistics for completed processing', async () => {
      const { GET } = await import('../[id]/route')
      
      // Create completed processing data
      const testProcessing: ProcessingResult = {
        id: 'completed-process-id',
        status: 'completed',
        method: 'peak',
        targetLevel: -3,
        albumMode: true,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 3,
        processedFiles: 3,
        results: [
          {
            fileId: 'file-1',
            fileName: 'test1.mp3',
            success: true,
            outputPath: '/output/test1-normalized.mp3',
            originalLoudness: -18.5,
            finalLoudness: -16.0,
            gainApplied: 2.5,
            processingTime: 1500
          },
          {
            fileId: 'file-2',
            fileName: 'test2.wav',
            success: true,
            outputPath: '/output/test2-normalized.wav',
            originalLoudness: -14.2,
            finalLoudness: -16.0,
            gainApplied: -1.8,
            processingTime: 1200
          },
          {
            fileId: 'file-3',
            fileName: 'test3.flac',
            success: false,
            error: 'File corrotto'
          }
        ],
        startTime: new Date(Date.now() - 5000),
        endTime: new Date(),
        processingTime: 5000,
        error: null
      }
      
      ProcessingStorage.set('completed-process-id', testProcessing)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'completed-process-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('completed')
      expect(data.data.progress).toBe(100)
      expect(data.data.processingTime).toBe(5000)
      
      // Check summary statistics
      expect(data.data.summary).toBeDefined()
      expect(data.data.summary.totalSuccessful).toBe(2)
      expect(data.data.summary.totalFailed).toBe(1)
      expect(data.data.summary.averageGainApplied).toBe(0.35) // (2.5 + (-1.8)) / 2
      expect(data.data.summary.averageProcessingTime).toBe(1350) // (1500 + 1200) / 2
      expect(data.data.summary.outputFiles).toHaveLength(2)
    })

    it('should handle processing with error status', async () => {
      const { GET } = await import('../[id]/route')
      
      const testProcessing: ProcessingResult = {
        id: 'error-process-id',
        status: 'error',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        error: 'Processing failed'
      }
      
      ProcessingStorage.set('error-process-id', testProcessing)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'error-process-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('error')
      expect(data.data.error).toBe('Processing failed')
      expect(data.data.progress).toBe(0)
    })
  })

  describe('DELETE /api/process/[id]', () => {
    it('should return error when process ID is missing', async () => {
      const { DELETE } = await import('../[id]/route')
      
      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_PROCESS_ID')
    })

    it('should return 404 when process not found', async () => {
      const { DELETE } = await import('../[id]/route')
      
      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('PROCESS_NOT_FOUND')
    })

    it('should cancel running process', async () => {
      const { DELETE } = await import('../[id]/route')
      
      // Create running process
      const testProcessing: ProcessingResult = {
        id: 'running-process-id',
        status: 'processing',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 2,
        processedFiles: 1,
        results: [],
        startTime: new Date(),
        error: null
      }
      
      ProcessingStorage.set('running-process-id', testProcessing)

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'running-process-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Processo cancellato')
      expect(data.data.status).toBe('cancelled')

      // Verify process was marked as cancelled
      const updatedProcess = ProcessingStorage.get('running-process-id')
      expect(updatedProcess?.status).toBe('error')
      expect(updatedProcess?.error).toBe('Processo cancellato dall\'utente')
    })

    it('should delete completed process', async () => {
      const { DELETE } = await import('../[id]/route')
      
      // Create completed process
      const testProcessing: ProcessingResult = {
        id: 'completed-process-id',
        status: 'completed',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: new Date(),
        endTime: new Date(),
        error: null
      }
      
      ProcessingStorage.set('completed-process-id', testProcessing)
      
      // Verify it exists
      expect(ProcessingStorage.has('completed-process-id')).toBe(true)

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'completed-process-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Risultati processo eliminati')
      expect(data.data.deleted).toBe(true)
      
      // Verify it was deleted
      expect(ProcessingStorage.has('completed-process-id')).toBe(false)
    })
  })

  describe('Processing Storage Integration', () => {
    it('should handle storage operations correctly', () => {
      const testProcessing: ProcessingResult = {
        id: 'storage-test-id',
        status: 'processing',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(),
        error: null
      }

      // Test set and get
      ProcessingStorage.set('storage-test-id', testProcessing)
      const retrieved = ProcessingStorage.get('storage-test-id')
      expect(retrieved).toEqual(testProcessing)

      // Test has
      expect(ProcessingStorage.has('storage-test-id')).toBe(true)
      expect(ProcessingStorage.has('non-existent')).toBe(false)

      // Test size
      expect(ProcessingStorage.size()).toBe(1)

      // Test delete
      expect(ProcessingStorage.delete('storage-test-id')).toBe(true)
      expect(ProcessingStorage.has('storage-test-id')).toBe(false)
      expect(ProcessingStorage.size()).toBe(0)
    })

    it('should cleanup old processing results', () => {
      const oldProcessing: ProcessingResult = {
        id: 'old-processing',
        status: 'completed',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        // La finestra di ritenzione di ProcessingStorage.cleanup() è di 24 ore,
        // non di poche ore: con 3 ore questo record non veniva rimosso e il
        // test si aspettava comunque 1 cancellazione. Usiamo 25 ore.
        startTime: Date.now() - 25 * 60 * 60 * 1000,
        error: null
      }

      const recentProcessing: ProcessingResult = {
        id: 'recent-processing',
        status: 'completed',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        error: null
      }

      ProcessingStorage.set('old-processing', oldProcessing)
      ProcessingStorage.set('recent-processing', recentProcessing)

      expect(ProcessingStorage.size()).toBe(2)

      const cleaned = ProcessingStorage.cleanup()
      expect(cleaned).toBe(1)
      expect(ProcessingStorage.size()).toBe(1)
      expect(ProcessingStorage.has('old-processing')).toBe(false)
      expect(ProcessingStorage.has('recent-processing')).toBe(true)
    })

    it('should provide processing statistics', () => {
      const processingData: ProcessingResult = {
        id: 'processing-1',
        status: 'processing',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(),
        error: null
      }

      const completedData: ProcessingResult = {
        id: 'completed-1',
        status: 'completed',
        method: 'peak',
        targetLevel: -3,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: new Date(),
        endTime: new Date(),
        error: null
      }

      const errorData: ProcessingResult = {
        id: 'error-1',
        status: 'error',
        method: 'loudness',
        targetLevel: -16,
        albumMode: false,
        maintainRelativeLoudness: true,
        outputFormat: 'preserve',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(),
        error: 'Test error'
      }

      ProcessingStorage.set('processing-1', processingData)
      ProcessingStorage.set('completed-1', completedData)
      ProcessingStorage.set('error-1', errorData)

      const stats = ProcessingStorage.getStats()
      expect(stats.total).toBe(3)
      expect(stats.processing).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.error).toBe(1)
      expect(stats.oldestProcessing).toBeDefined()
    })
  })
})