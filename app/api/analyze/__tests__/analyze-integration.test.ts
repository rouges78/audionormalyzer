import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AnalysisStorage } from '@/lib/analysis-storage'

// Mock the services
vi.mock('@/services/audio-processor', () => ({
  createAudioProcessor: () => ({
    analyzeAudio: vi.fn().mockResolvedValue({
      duration: 180.5,
      sampleRate: 44100,
      channels: 2,
      peakLevel: -3.2,
      rmsLevel: -18.5,
      lufsIntegrated: -16.2,
      truePeak: -2.8,
      hasClipping: false,
      format: 'MP3'
    })
  })
}))

vi.mock('@/services/file-manager', () => ({
  createFileManager: () => ({
    getTempFileInfo: vi.fn().mockImplementation((fileId: string) => {
      if (fileId === 'valid-file-id') {
        return Promise.resolve({
          path: '/temp/test-file.mp3',
          originalName: 'test-audio.mp3',
          size: 5242880
        })
      }
      return Promise.resolve(null)
    })
  })
}))

describe('Analyze API Integration Tests', () => {
  beforeEach(() => {
    // Clear analysis storage before each test
    AnalysisStorage.clear()
  })

  afterEach(() => {
    // Clean up after each test
    AnalysisStorage.clear()
  })

  describe('POST /api/analyze', () => {
    it('should return error when no file IDs provided', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MISSING_FILE_IDS')
      expect(data.error.message).toBe('Array di ID file richiesto')
    })

    it('should return error when fileIds is not an array', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: 'not-an-array' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MISSING_FILE_IDS')
    })

    it('should return error when fileIds array is empty', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: [] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MISSING_FILE_IDS')
    })

    it('should start analysis for valid file IDs', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ['valid-file-id'] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Analisi avviata')
      expect(data.data.analysisId).toBeDefined()
      expect(data.data.totalFiles).toBe(1)
      expect(data.data.status).toBe('processing')

      // Verify analysis was stored
      const analysisData = AnalysisStorage.get(data.data.analysisId)
      expect(analysisData).toBeDefined()
      expect(['processing', 'completed']).toContain(analysisData?.status)
      expect(analysisData?.totalFiles).toBe(1)
    })

    it('should handle multiple file IDs', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ['valid-file-id', 'valid-file-id'] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalFiles).toBe(2)
    })
  })

  describe('GET /api/analyze', () => {
    it('should return endpoint information', async () => {
      const { GET } = await import('../route')
      
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.endpoint).toBe('/api/analyze')
      expect(data.method).toBe('POST')
      expect(data.description).toBe('Analizza file audio caricati')
      expect(data.parameters.fileIds).toBe('Array di ID file da analizzare')
      expect(data.relatedEndpoints.results).toBe('/api/analysis/:id')
      expect(data.relatedEndpoints.upload).toBe('/api/upload')
    })
  })

  describe('Analysis Processing', () => {
    it('should process files and update analysis results', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ['valid-file-id'] })
      })

      const response = await POST(request)
      const data = await response.json()
      const analysisId = data.data.analysisId

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const analysisData = AnalysisStorage.get(analysisId)
      expect(analysisData).toBeDefined()
      
      // The processing should have started or completed
      expect(['processing', 'completed']).toContain(analysisData?.status)
      
      if (analysisData?.status === 'completed') {
        expect(analysisData.results).toHaveLength(1)
        expect(analysisData.results[0].success).toBe(true)
        expect(analysisData.results[0].analysis).toBeDefined()
        expect(analysisData.processingTime).toBeDefined()
        expect(analysisData.endTime).toBeDefined()
      }
    })

    it('should handle file not found during processing', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ['non-existent-file-id'] })
      })

      const response = await POST(request)
      const data = await response.json()
      const analysisId = data.data.analysisId

      // Wait for async processing to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const analysisData = AnalysisStorage.get(analysisId)
      expect(analysisData?.status).toBe('completed')
      expect(analysisData?.results).toHaveLength(1)
      expect(analysisData?.results[0].success).toBe(false)
      // The message now comes from ErrorTypes.FILE_NOT_FOUND and includes the file
      // id ('File not found: <id>'), more useful than the old 'File non trovato'.
      expect(analysisData?.results[0].error).toContain('non-existent-file-id')
    })
  })
})