import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

describe('Upload API Integration Tests', () => {
  const tempDir = path.join(process.cwd(), 'temp', 'audio')
  
  beforeEach(async () => {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up any test files
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(tempDir, file))
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('POST /api/upload', () => {
    it('should return error when no files provided', async () => {
      const { POST } = await import('../route')
      
      const formData = new FormData()
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      // POST /api/upload goes through withErrorHandling, which wraps the error
      // in { success, error: { message, code, requestId, ... } }. The
      // [fileId] and validate/ routes do not use it and stay at { error: '...' }.
      expect(data.error.code).toBe('NO_FILES')
      expect(data.error.message).toBe('Nessun file fornito per l\'upload')
    })

    it('should handle invalid file objects', async () => {
      const { POST } = await import('../route')
      
      const formData = new FormData()
      // Add a non-File object
      formData.append('files', 'not-a-file' as any)
      
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_FILES')
    })

    it('should successfully upload valid audio files', async () => {
      const { POST } = await import('../route')
      
      // Create mock audio files with proper content
      const audioContent1 = new ArrayBuffer(1024)
      const audioContent2 = new ArrayBuffer(2048)
      
      const mockFile1 = new File([audioContent1], 'test-audio1.mp3', { type: 'audio/mpeg' })
      const mockFile2 = new File([audioContent2], 'test-audio2.wav', { type: 'audio/wav' })

      const formData = new FormData()
      formData.append('files', mockFile1)
      formData.append('files', mockFile2)

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.files).toHaveLength(2)
      expect(data.data.totalFiles).toBe(2)
      expect(data.data.totalSize).toBe(3072) // 1024 + 2048
      
      // Verify files were actually created
      for (const fileResult of data.data.files) {
        expect(fileResult.id).toBeDefined()
        expect(fileResult.tempPath).toBeDefined()
        expect(fileResult.format).toBeDefined()
        
        // Check that file exists
        const stats = await fs.stat(fileResult.tempPath)
        expect(stats.isFile()).toBe(true)
        
        // Clean up
        await fs.unlink(fileResult.tempPath)
      }
    })
  })

  describe('GET /api/upload', () => {
    it('should return endpoint information', async () => {
      const { GET } = await import('../route')
      
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.endpoint).toBe('/api/upload')
      expect(data.method).toBe('POST')
      expect(data.supportedFormats).toContain('MP3')
      expect(data.supportedFormats).toContain('WAV')
      expect(data.supportedFormats).toContain('FLAC')
      expect(data.maxFileSize).toBe('500MB')
      expect(data.maxAlbumSize).toBe('2GB')
    })
  })

  describe('POST /api/upload/validate', () => {
    it('should validate files successfully', async () => {
      const { POST: validatePOST } = await import('../validate/route')
      
      const validFile = new File([new ArrayBuffer(1024)], 'test.mp3', { type: 'audio/mpeg' })
      const invalidFile = new File([new ArrayBuffer(1024)], 'test.xyz', { type: 'application/octet-stream' })

      const formData = new FormData()
      formData.append('files', validFile)
      formData.append('files', invalidFile)

      const request = new NextRequest('http://localhost:3000/api/upload/validate', {
        method: 'POST',
        body: formData
      })

      const response = await validatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalFiles).toBe(2)
      expect(data.data.validFiles).toBe(1)
      expect(data.data.invalidFiles).toBe(1)
      expect(data.data.results).toHaveLength(2)
      
      const validResult = data.data.results.find((r: any) => r.fileName === 'test.mp3')
      const invalidResult = data.data.results.find((r: any) => r.fileName === 'test.xyz')
      
      expect(validResult.isValid).toBe(true)
      expect(validResult.format).toBe('MP3')
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.error).toContain('non supportato')
    })

    it('should return error when no files provided for validation', async () => {
      const { POST: validatePOST } = await import('../validate/route')
      
      const formData = new FormData()
      const request = new NextRequest('http://localhost:3000/api/upload/validate', {
        method: 'POST',
        body: formData
      })

      const response = await validatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('NO_FILES')
    })
  })

  describe('File ID endpoints', () => {
    it('should return error when file ID is missing', async () => {
      const { GET: fileGET } = await import('../[fileId]/route')
      
      const response = await fileGET(
        {} as NextRequest,
        { params: Promise.resolve({ fileId: '' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('MISSING_FILE_ID')
    })

    it('should return 404 when file not found', async () => {
      const { GET: fileGET } = await import('../[fileId]/route')
      
      const response = await fileGET(
        {} as NextRequest,
        { params: Promise.resolve({ fileId: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('FILE_NOT_FOUND')
    })

    it('should return 404 when trying to delete non-existent file', async () => {
      const { DELETE: fileDELETE } = await import('../[fileId]/route')
      
      const response = await fileDELETE(
        {} as NextRequest,
        { params: Promise.resolve({ fileId: 'non-existent-id' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.code).toBe('FILE_NOT_FOUND')
    })
  })
})