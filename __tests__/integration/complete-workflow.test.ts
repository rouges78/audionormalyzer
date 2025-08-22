import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

describe('Complete Workflow Integration Tests', () => {
  const tempDir = path.join(process.cwd(), 'temp', 'audio')
  const outputDir = path.join(process.cwd(), 'output', 'audio')
  
  beforeEach(async () => {
    // Setup test directories
    await fs.mkdir(tempDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup test files
    try {
      const tempFiles = await fs.readdir(tempDir)
      for (const file of tempFiles) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(tempDir, file))
        }
      }
      
      const outputFiles = await fs.readdir(outputDir)
      for (const file of outputFiles) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(outputDir, file))
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Upload → Analyze → Normalize → Download Workflow', () => {
    it('should complete full workflow for single file', async () => {
      // Step 1: Upload file
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const audioContent = new ArrayBuffer(2048)
      const mockFile = new File([audioContent], 'test-single.mp3', { type: 'audio/mpeg' })
      
      const uploadFormData = new FormData()
      uploadFormData.append('files', mockFile)
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.success).toBe(true)
      expect(uploadData.data.files).toHaveLength(1)
      
      const fileId = uploadData.data.files[0].id
      const tempPath = uploadData.data.files[0].tempPath

      // Step 2: Analyze file
      const { POST: analyzePOST } = await import('../../app/api/analyze/route')
      
      const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: [fileId] })
      })

      const analyzeResponse = await analyzePOST(analyzeRequest)
      const analyzeData = await analyzeResponse.json()

      expect(analyzeResponse.status).toBe(200)
      expect(analyzeData.success).toBe(true)
      
      const analysisId = analyzeData.data.analysisId

      // Wait for analysis to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 3: Get analysis results
      const { GET: analysisGET } = await import('../../app/api/analysis/[id]/route')
      
      const analysisResponse = await analysisGET(
        {} as NextRequest,
        { params: Promise.resolve({ id: analysisId }) }
      )
      const analysisResults = await analysisResponse.json()

      expect(analysisResponse.status).toBe(200)
      expect(analysisResults.success).toBe(true)
      expect(analysisResults.data.status).toBe('completed')

      // Step 4: Normalize file
      const { POST: normalizePOST } = await import('../../app/api/normalize/route')
      
      const normalizeRequest = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({
          fileIds: [fileId],
          method: 'peak',
          targetLevel: -1.0,
          outputFormat: 'preserve'
        })
      })

      const normalizeResponse = await normalizePOST(normalizeRequest)
      const normalizeData = await normalizeResponse.json()

      expect(normalizeResponse.status).toBe(200)
      expect(normalizeData.success).toBe(true)
      
      const processId = normalizeData.data.processId

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 5: Check processing status
      const { GET: processGET } = await import('../../app/api/process/[id]/route')
      
      const processResponse = await processGET(
        {} as NextRequest,
        { params: Promise.resolve({ id: processId }) }
      )
      const processData = await processResponse.json()

      expect(processResponse.status).toBe(200)
      expect(processData.success).toBe(true)
      expect(processData.data.status).toBe('completed')

      // Step 6: Download processed file
      const { POST: downloadPOST } = await import('../../app/api/download/route')
      
      const downloadRequest = new NextRequest('http://localhost:3000/api/download', {
        method: 'POST',
        body: JSON.stringify({
          processId: processId,
          downloadType: 'individual'
        })
      })

      const downloadResponse = await downloadPOST(downloadRequest)
      const downloadData = await downloadResponse.json()

      expect(downloadResponse.status).toBe(200)
      expect(downloadData.success).toBe(true)
      expect(downloadData.data.downloadId).toBeDefined()

      // Cleanup uploaded file
      await fs.unlink(tempPath)
    })

    it('should complete full workflow for album (multiple files)', async () => {
      // Step 1: Upload multiple files
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const files = [
        new File([new ArrayBuffer(1024)], 'test-track1.mp3', { type: 'audio/mpeg' }),
        new File([new ArrayBuffer(1536)], 'test-track2.wav', { type: 'audio/wav' }),
        new File([new ArrayBuffer(2048)], 'test-track3.flac', { type: 'audio/flac' })
      ]
      
      const uploadFormData = new FormData()
      files.forEach(file => uploadFormData.append('files', file))
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.data.files).toHaveLength(3)
      
      const fileIds = uploadData.data.files.map((f: any) => f.id)
      const tempPaths = uploadData.data.files.map((f: any) => f.tempPath)

      // Step 2: Analyze all files
      const { POST: analyzePOST } = await import('../../app/api/analyze/route')
      
      const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds })
      })

      const analyzeResponse = await analyzePOST(analyzeRequest)
      const analyzeData = await analyzeResponse.json()

      expect(analyzeResponse.status).toBe(200)
      expect(analyzeData.data.totalFiles).toBe(3)

      // Wait for analysis
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 3: Normalize with loudness method for album consistency
      const { POST: normalizePOST } = await import('../../app/api/normalize/route')
      
      const normalizeRequest = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({
          fileIds,
          method: 'loudness',
          targetLevel: -23.0,
          outputFormat: 'preserve',
          albumMode: true
        })
      })

      const normalizeResponse = await normalizePOST(normalizeRequest)
      const normalizeData = await normalizeResponse.json()

      expect(normalizeResponse.status).toBe(200)
      expect(normalizeData.data.totalFiles).toBe(3)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 4: Download as album (batch)
      const { POST: downloadPOST } = await import('../../app/api/download/route')
      
      const downloadRequest = new NextRequest('http://localhost:3000/api/download', {
        method: 'POST',
        body: JSON.stringify({
          processId: normalizeData.data.processId,
          downloadType: 'batch',
          format: 'zip'
        })
      })

      const downloadResponse = await downloadPOST(downloadRequest)
      const downloadData = await downloadResponse.json()

      expect(downloadResponse.status).toBe(200)
      expect(downloadData.success).toBe(true)
      expect(downloadData.data.downloadType).toBe('batch')

      // Cleanup uploaded files
      for (const tempPath of tempPaths) {
        await fs.unlink(tempPath)
      }
    })
  })

  describe('Error Recovery in Workflow', () => {
    it('should handle partial failures in album processing', async () => {
      // Upload mixed valid/invalid files
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const validFile = new File([new ArrayBuffer(1024)], 'test-valid.mp3', { type: 'audio/mpeg' })
      const invalidFile = new File([new ArrayBuffer(10)], 'test-invalid.xyz', { type: 'application/octet-stream' })
      
      const uploadFormData = new FormData()
      uploadFormData.append('files', validFile)
      uploadFormData.append('files', invalidFile)
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      // Should handle mixed results
      expect(uploadResponse.status).toBe(400) // Partial failure
      expect(uploadData.success).toBe(false)
      expect(uploadData.code).toBe('INVALID_FILES')
    })

    it('should handle analysis failures gracefully', async () => {
      // Upload valid file first
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const mockFile = new File([new ArrayBuffer(1024)], 'test-analysis-fail.mp3', { type: 'audio/mpeg' })
      const uploadFormData = new FormData()
      uploadFormData.append('files', mockFile)
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()
      const fileId = uploadData.data.files[0].id

      // Try to analyze non-existent file
      const { POST: analyzePOST } = await import('../../app/api/analyze/route')
      
      const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ['non-existent-id'] })
      })

      const analyzeResponse = await analyzePOST(analyzeRequest)
      const analyzeData = await analyzeResponse.json()

      expect(analyzeResponse.status).toBe(200) // Request accepted
      expect(analyzeData.success).toBe(true)

      // Wait and check results - should show failure
      await new Promise(resolve => setTimeout(resolve, 200))

      const { GET: analysisGET } = await import('../../app/api/analysis/[id]/route')
      
      const analysisResponse = await analysisGET(
        {} as NextRequest,
        { params: Promise.resolve({ id: analyzeData.data.analysisId }) }
      )
      const analysisResults = await analysisResponse.json()

      expect(analysisResults.data.status).toBe('completed')
      expect(analysisResults.data.results[0].success).toBe(false)

      // Cleanup
      await fs.unlink(uploadData.data.files[0].tempPath)
    })
  })

  describe('Format Compatibility Workflow', () => {
    it('should handle different audio formats in same workflow', async () => {
      const formats = [
        { name: 'test.mp3', type: 'audio/mpeg', content: new ArrayBuffer(1024) },
        { name: 'test.wav', type: 'audio/wav', content: new ArrayBuffer(2048) },
        { name: 'test.flac', type: 'audio/flac', content: new ArrayBuffer(3072) },
        { name: 'test.aac', type: 'audio/aac', content: new ArrayBuffer(1536) },
        { name: 'test.m4a', type: 'audio/mp4', content: new ArrayBuffer(2560) },
        { name: 'test.ogg', type: 'audio/ogg', content: new ArrayBuffer(1792) }
      ]

      // Upload all formats
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const uploadFormData = new FormData()
      formats.forEach(format => {
        const file = new File([format.content], format.name, { type: format.type })
        uploadFormData.append('files', file)
      })
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.data.files).toHaveLength(formats.length)

      // Verify each format was recognized correctly
      const expectedFormats = ['MP3', 'WAV', 'FLAC', 'AAC', 'M4A/AAC', 'OGG Vorbis']
      uploadData.data.files.forEach((file: any, index: number) => {
        expect(file.format).toBe(expectedFormats[index])
      })

      // Analyze all formats
      const fileIds = uploadData.data.files.map((f: any) => f.id)
      const { POST: analyzePOST } = await import('../../app/api/analyze/route')
      
      const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds })
      })

      const analyzeResponse = await analyzePOST(analyzeRequest)
      expect(analyzeResponse.status).toBe(200)

      // Cleanup
      for (const file of uploadData.data.files) {
        await fs.unlink(file.tempPath)
      }
    })

    it('should preserve format during normalization', async () => {
      const testFormats = [
        { name: 'preserve-test.flac', type: 'audio/flac' },
        { name: 'preserve-test.wav', type: 'audio/wav' }
      ]

      for (const format of testFormats) {
        // Upload file
        const { POST: uploadPOST } = await import('../../app/api/upload/route')
        
        const mockFile = new File([new ArrayBuffer(1024)], format.name, { type: format.type })
        const uploadFormData = new FormData()
        uploadFormData.append('files', mockFile)
        
        const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: uploadFormData
        })

        const uploadResponse = await uploadPOST(uploadRequest)
        const uploadData = await uploadResponse.json()
        const fileId = uploadData.data.files[0].id

        // Normalize with format preservation
        const { POST: normalizePOST } = await import('../../app/api/normalize/route')
        
        const normalizeRequest = new NextRequest('http://localhost:3000/api/normalize', {
          method: 'POST',
          body: JSON.stringify({
            fileIds: [fileId],
            method: 'peak',
            targetLevel: -3.0,
            outputFormat: 'preserve'
          })
        })

        const normalizeResponse = await normalizePOST(normalizeRequest)
        expect(normalizeResponse.status).toBe(200)

        // Cleanup
        await fs.unlink(uploadData.data.files[0].tempPath)
      }
    })
  })

  describe('Performance Integration Tests', () => {
    it('should handle large album processing within time limits', async () => {
      const startTime = Date.now()
      const albumSize = 20 // 20 tracks

      // Create mock album
      const files = Array.from({ length: albumSize }, (_, i) => 
        new File([new ArrayBuffer(1024)], `album-track-${i + 1}.mp3`, { type: 'audio/mpeg' })
      )

      // Upload album
      const { POST: uploadPOST } = await import('../../app/api/upload/route')
      
      const uploadFormData = new FormData()
      files.forEach(file => uploadFormData.append('files', file))
      
      const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await uploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.data.files).toHaveLength(albumSize)

      const fileIds = uploadData.data.files.map((f: any) => f.id)

      // Analyze album
      const { POST: analyzePOST } = await import('../../app/api/analyze/route')
      
      const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ fileIds })
      })

      const analyzeResponse = await analyzePOST(analyzeRequest)
      expect(analyzeResponse.status).toBe(200)

      // Wait for analysis
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Normalize album
      const { POST: normalizePOST } = await import('../../app/api/normalize/route')
      
      const normalizeRequest = new NextRequest('http://localhost:3000/api/normalize', {
        method: 'POST',
        body: JSON.stringify({
          fileIds,
          method: 'loudness',
          targetLevel: -23.0,
          outputFormat: 'preserve',
          albumMode: true
        })
      })

      const normalizeResponse = await normalizePOST(normalizeRequest)
      expect(normalizeResponse.status).toBe(200)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      const totalTime = Date.now() - startTime

      // Should complete within reasonable time (10 seconds for 20 tracks)
      expect(totalTime).toBeLessThan(10000)

      // Cleanup
      for (const file of uploadData.data.files) {
        await fs.unlink(file.tempPath)
      }
    })

    it('should handle concurrent workflow requests', async () => {
      const concurrentRequests = 3
      const promises: Promise<any>[] = []

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = (async () => {
          // Upload
          const { POST: uploadPOST } = await import('../../app/api/upload/route')
          
          const mockFile = new File([new ArrayBuffer(1024)], `concurrent-${i}.mp3`, { type: 'audio/mpeg' })
          const uploadFormData = new FormData()
          uploadFormData.append('files', mockFile)
          
          const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
            method: 'POST',
            body: uploadFormData
          })

          const uploadResponse = await uploadPOST(uploadRequest)
          const uploadData = await uploadResponse.json()
          const fileId = uploadData.data.files[0].id

          // Analyze
          const { POST: analyzePOST } = await import('../../app/api/analyze/route')
          
          const analyzeRequest = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ fileIds: [fileId] })
          })

          const analyzeResponse = await analyzePOST(analyzeRequest)
          
          // Cleanup
          await fs.unlink(uploadData.data.files[0].tempPath)
          
          return { upload: uploadResponse.status, analyze: analyzeResponse.status }
        })()

        promises.push(promise)
      }

      const results = await Promise.all(promises)

      // All requests should succeed
      results.forEach(result => {
        expect(result.upload).toBe(200)
        expect(result.analyze).toBe(200)
      })
    })
  })
})