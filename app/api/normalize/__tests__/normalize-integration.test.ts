import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ProcessingStorage } from '@/lib/processing-storage'

// Mock the services
vi.mock('@/services/audio-processor', () => ({
  createAudioProcessor: () => ({
    normalizeAudio: vi.fn().mockResolvedValue('/output/normalized-file.mp3')
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
    }),
    createOutputPath: vi.fn().mockResolvedValue('/output/test-output.mp3')
  })
}))

vi.mock('@/services/album-processor', () => ({
  createAlbumProcessor: () => ({
    processAlbum: vi.fn().mockResolvedValue([
      {
        fileId: 'file-1',
        fileName: 'track1.mp3',
        success: true,
        outputPath: '/output/track1-normalized.mp3',
        originalLoudness: -18.5,
        finalLoudness: -16.0,
        gainApplied: 2.5,
        processingTime: 1500
      },
      {
        fileId: 'file-2',
        fileName: 'track2.mp3',
        success: true,
        outputPath: '/output/track2-normalized.mp3',
        originalLoudness: -14.2,
        finalLoudness: -16.0,
        gainApplied: -1.8,
        processingTime: 1200
      }
    ])
  })
}))

describe('Normalize API Integration Tests', () => {
  beforeEach(() => {
    // Clear processing storage before each test
    ProcessingStorage.clear()
  })

  afterEach(() => {
    // Clean up after each test
    ProcessingStorage.clear()
  })

  describe('POST /api/normalize', () => {
    it('should return error when no file IDs provided', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_FILE_IDS')
      expect(data.error).toBe('Array di ID file richiesto')
    })

    it('should return error when fileIds is not an array', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ fileIds: 'not-an-array' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_FILE_IDS')
    })

    it('should return error for invalid normalization method', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id'],
          method: 'invalid-method'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('INVALID_METHOD')
      expect(data.error).toContain('Metodo di normalizzazione non valido')
    })

    it('should return error for invalid peak target level', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id'],
          method: 'peak',
          targetLevel: 5 // Invalid: above 0dB
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('INVALID_TARGET_LEVEL')
      expect(data.error).toContain('Livello target per peak deve essere tra -60dB e 0dB')
    })

    it('should return error for invalid loudness target level', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id'],
          method: 'loudness',
          targetLevel: -5 // Invalid: above -6 LUFS
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('INVALID_TARGET_LEVEL')
      expect(data.error).toContain('Livello target per loudness deve essere tra -30 LUFS e -6 LUFS')
    })

    it('should start normalization for valid parameters', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id'],
          method: 'loudness',
          targetLevel: -16
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Normalizzazione avviata')
      expect(data.data.processId).toBeDefined()
      expect(data.data.totalFiles).toBe(1)
      expect(data.data.method).toBe('loudness')
      expect(data.data.targetLevel).toBe(-16)
      expect(data.data.status).toBe('processing')

      // Verify processing was stored
      const processingData = ProcessingStorage.get(data.data.processId)
      expect(processingData).toBeDefined()
      expect(['processing', 'completed']).toContain(processingData?.status)
      expect(processingData?.method).toBe('loudness')
      expect(processingData?.targetLevel).toBe(-16)
    })

    it('should start album processing when albumMode is true', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['file-1', 'file-2'],
          method: 'loudness',
          targetLevel: -16,
          albumMode: true,
          maintainRelativeLoudness: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalFiles).toBe(2)
      expect(data.data.albumMode).toBe(true)

      // Verify processing was stored with album settings
      const processingData = ProcessingStorage.get(data.data.processId)
      expect(processingData?.albumMode).toBe(true)
      expect(processingData?.maintainRelativeLoudness).toBe(true)
    })

    it('should use default values for optional parameters', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.method).toBe('loudness') // default
      expect(data.data.targetLevel).toBe(-16) // default
      expect(data.data.albumMode).toBe(false) // default

      const processingData = ProcessingStorage.get(data.data.processId)
      expect(processingData?.maintainRelativeLoudness).toBe(true) // default
      expect(processingData?.outputFormat).toBe('preserve') // default
    })
  })

  describe('GET /api/normalize', () => {
    it('should return endpoint information', async () => {
      const { GET } = await import('../route')
      
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.endpoint).toBe('/api/normalize')
      expect(data.method).toBe('POST')
      expect(data.description).toBe('Avvia la normalizzazione di file audio')
      expect(data.parameters.fileIds).toBeDefined()
      expect(data.parameters.method).toContain('peak')
      expect(data.parameters.method).toContain('loudness')
      expect(data.relatedEndpoints.status).toBe('/api/process/:id')
    })
  })

  describe('Processing Integration', () => {
    it('should process individual files and update results', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['valid-file-id'],
          method: 'peak',
          targetLevel: -3
        })
      })

      const response = await POST(request)
      const data = await response.json()
      const processId = data.data.processId

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const processingData = ProcessingStorage.get(processId)
      expect(processingData).toBeDefined()
      
      // Processing should have started or completed
      expect(['processing', 'completed']).toContain(processingData?.status)
      
      if (processingData?.status === 'completed') {
        expect(processingData.results).toHaveLength(1)
        expect(processingData.results[0].success).toBe(true)
        expect(processingData.processingTime).toBeDefined()
      }
    })

    it('should handle file not found during processing', async () => {
      const { POST } = await import('../route')
      
      const request = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({ 
          fileIds: ['non-existent-file-id']
        })
      })

      const response = await POST(request)
      const data = await response.json()
      const processId = data.data.processId

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const processingData = ProcessingStorage.get(processId)
      expect(processingData?.status).toBe('completed')
      expect(processingData?.results).toHaveLength(1)
      expect(processingData?.results[0].success).toBe(false)
      expect(processingData?.results[0].error).toBe('File non trovato')
    })
  })
})