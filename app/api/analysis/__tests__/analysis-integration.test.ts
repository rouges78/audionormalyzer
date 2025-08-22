import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AnalysisStorage, AnalysisResult } from '@/lib/analysis-storage'

describe('Analysis Results API Integration Tests', () => {
  beforeEach(() => {
    // Clear analysis storage before each test
    AnalysisStorage.clear()
  })

  afterEach(() => {
    // Clean up after each test
    AnalysisStorage.clear()
  })

  describe('GET /api/analysis/[id]', () => {
    it('should return error when analysis ID is missing', async () => {
      const { GET } = await import('../[id]/route')
      
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_ANALYSIS_ID')
      expect(data.error).toBe('ID analisi richiesto')
    })

    it('should return 404 when analysis not found', async () => {
      const { GET } = await import('../[id]/route')
      
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('ANALYSIS_NOT_FOUND')
      expect(data.error).toBe('Analisi non trovata')
    })

    it('should return analysis data when found', async () => {
      const { GET } = await import('../[id]/route')
      
      // Create test analysis data
      const testAnalysis: AnalysisResult = {
        id: 'test-analysis-id',
        status: 'processing',
        totalFiles: 2,
        processedFiles: 1,
        results: [
          {
            fileId: 'file-1',
            fileName: 'test1.mp3',
            success: true,
            analysis: {
              duration: 180.5,
              sampleRate: 44100,
              channels: 2,
              peakLevel: -3.2,
              rmsLevel: -18.5,
              lufsIntegrated: -16.2,
              truePeak: -2.8,
              hasClipping: false,
              format: 'MP3'
            }
          }
        ],
        startTime: new Date(),
        error: null
      }
      
      AnalysisStorage.set('test-analysis-id', testAnalysis)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'test-analysis-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('test-analysis-id')
      expect(data.data.status).toBe('processing')
      expect(data.data.progress).toBe(50) // 1/2 * 100
      expect(data.data.totalFiles).toBe(2)
      expect(data.data.processedFiles).toBe(1)
      expect(data.data.results).toHaveLength(1)
      expect(data.data.results[0].success).toBe(true)
      expect(data.data.results[0].analysis.duration).toBe(180.5)
    })

    it('should include summary statistics for completed analysis', async () => {
      const { GET } = await import('../[id]/route')
      
      // Create completed analysis data with multiple results
      const testAnalysis: AnalysisResult = {
        id: 'completed-analysis-id',
        status: 'completed',
        totalFiles: 3,
        processedFiles: 3,
        results: [
          {
            fileId: 'file-1',
            fileName: 'test1.mp3',
            success: true,
            analysis: {
              duration: 180.5,
              sampleRate: 44100,
              channels: 2,
              peakLevel: -3.2,
              rmsLevel: -18.5,
              lufsIntegrated: -16.2,
              truePeak: -2.8,
              hasClipping: false,
              format: 'MP3'
            }
          },
          {
            fileId: 'file-2',
            fileName: 'test2.wav',
            success: true,
            analysis: {
              duration: 240.0,
              sampleRate: 48000,
              channels: 2,
              peakLevel: -1.5,
              rmsLevel: -15.2,
              lufsIntegrated: -14.8,
              truePeak: -1.2,
              hasClipping: true,
              format: 'WAV'
            }
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
      
      AnalysisStorage.set('completed-analysis-id', testAnalysis)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'completed-analysis-id' }) }
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
      expect(data.data.summary.averageDuration).toBe(210.25) // (180.5 + 240) / 2
      expect(data.data.summary.clippingFiles).toBe(1)
      expect(data.data.summary.formats).toEqual(['MP3', 'WAV'])
      expect(data.data.summary.sampleRates).toEqual([44100, 48000])
    })

    it('should handle analysis with error status', async () => {
      const { GET } = await import('../[id]/route')
      
      const testAnalysis: AnalysisResult = {
        id: 'error-analysis-id',
        status: 'error',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        error: 'Processing failed'
      }
      
      AnalysisStorage.set('error-analysis-id', testAnalysis)

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'error-analysis-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('error')
      expect(data.data.error).toBe('Processing failed')
      expect(data.data.progress).toBe(0)
    })
  })

  describe('DELETE /api/analysis/[id]', () => {
    it('should return error when analysis ID is missing', async () => {
      const { DELETE } = await import('../[id]/route')
      
      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_ANALYSIS_ID')
    })

    it('should return 404 when analysis not found', async () => {
      const { DELETE } = await import('../[id]/route')
      
      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('ANALYSIS_NOT_FOUND')
    })

    it('should successfully delete existing analysis', async () => {
      const { DELETE } = await import('../[id]/route')
      
      // Create test analysis data
      const testAnalysis: AnalysisResult = {
        id: 'delete-test-id',
        status: 'completed',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: new Date(),
        error: null
      }
      
      AnalysisStorage.set('delete-test-id', testAnalysis)
      
      // Verify it exists
      expect(AnalysisStorage.has('delete-test-id')).toBe(true)

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: 'delete-test-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Risultati analisi eliminati')
      expect(data.data.id).toBe('delete-test-id')
      expect(data.data.deleted).toBe(true)
      
      // Verify it was deleted
      expect(AnalysisStorage.has('delete-test-id')).toBe(false)
    })
  })

  describe('Analysis Storage Integration', () => {
    it('should handle storage operations correctly', () => {
      const testAnalysis: AnalysisResult = {
        id: 'storage-test-id',
        status: 'processing',
        totalFiles: 1,
        processedFiles: 0,
        results: [],
        startTime: new Date(),
        error: null
      }

      // Test set and get
      AnalysisStorage.set('storage-test-id', testAnalysis)
      const retrieved = AnalysisStorage.get('storage-test-id')
      expect(retrieved).toEqual(testAnalysis)

      // Test has
      expect(AnalysisStorage.has('storage-test-id')).toBe(true)
      expect(AnalysisStorage.has('non-existent')).toBe(false)

      // Test size
      expect(AnalysisStorage.size()).toBe(1)

      // Test delete
      expect(AnalysisStorage.delete('storage-test-id')).toBe(true)
      expect(AnalysisStorage.has('storage-test-id')).toBe(false)
      expect(AnalysisStorage.size()).toBe(0)
    })

    it('should cleanup old analysis results', () => {
      const oldAnalysis: AnalysisResult = {
        id: 'old-analysis',
        status: 'completed',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        error: null
      }

      const recentAnalysis: AnalysisResult = {
        id: 'recent-analysis',
        status: 'completed',
        totalFiles: 1,
        processedFiles: 1,
        results: [],
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        error: null
      }

      AnalysisStorage.set('old-analysis', oldAnalysis)
      AnalysisStorage.set('recent-analysis', recentAnalysis)

      expect(AnalysisStorage.size()).toBe(2)

      const cleaned = AnalysisStorage.cleanup()
      expect(cleaned).toBe(1)
      expect(AnalysisStorage.size()).toBe(1)
      expect(AnalysisStorage.has('old-analysis')).toBe(false)
      expect(AnalysisStorage.has('recent-analysis')).toBe(true)
    })
  })
})