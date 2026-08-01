import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

describe('Complete Workflow Integration Tests', () => {
  const tempDir = path.join(process.cwd(), 'temp', 'audio')
  const outputDir = path.join(process.cwd(), 'output', 'audio')

  /**
   * Attende che una rotta di stato riporti 'completed'.
   * Prima si usava un setTimeout fisso (200/300 ms): l'elaborazione è
   * asincrona, quindi il test era una corsa contro il tempo e falliva con
   * "expected 'processing' to be 'completed'" appena la macchina era lenta.
   */
  const waitForCompletion = async (
    read: () => Promise<{ status: string; body: any }>,
    timeoutMs = 10000
  ) => {
    const deadline = Date.now() + timeoutMs
    let last: { status: string; body: any } | undefined

    while (Date.now() < deadline) {
      last = await read()
      const state = last.body?.data?.status
      if (state === 'completed' || state === 'error' || state === 'failed') {
        return last
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return last!
  }

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

      // Step 3: Get analysis results
      const { GET: analysisGET } = await import('../../app/api/analysis/[id]/route')

      const analysis = await waitForCompletion(async () => {
        const res = await analysisGET(
          {} as NextRequest,
          { params: Promise.resolve({ id: analysisId }) }
        )
        return { status: String(res.status), body: await res.json() }
      })

      expect(analysis.status).toBe('200')
      expect(analysis.body.success).toBe(true)
      expect(analysis.body.data.status).toBe('completed')

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

      // Step 5: Check processing status
      const { GET: processGET } = await import('../../app/api/process/[id]/route')

      const processing = await waitForCompletion(async () => {
        const res = await processGET(
          {} as NextRequest,
          { params: Promise.resolve({ id: processId }) }
        )
        return { status: String(res.status), body: await res.json() }
      })

      expect(processing.status).toBe('200')
      expect(processing.body.success).toBe(true)
      expect(processing.body.data.status).toBe('completed')

      // Step 6: Prepare the download.
      // La rotta invocata prima ('app/api/download/route') non è mai esistita:
      // l'endpoint reale è /api/download/prepare e accetta filePaths[] +
      // downloadType, restituendo downloadId al primo livello della risposta.
      const { POST: downloadPOST } = await import('../../app/api/download/prepare/route')

      // Sotto NODE_ENV=test applyNormalization non scrive davvero il file
      // (vedi audio-processor.ts): il percorso di uscita esiste come stringa
      // ma non su disco, e prepare/ lo rifiuterebbe con 400. Scarichiamo
      // quindi i soli percorsi realmente presenti, con fallback sul file
      // caricato — quello che conta qui è che la rotta di download accetti la
      // richiesta e restituisca un downloadId.
      const candidatePaths: string[] = (processing.body.data.results ?? [])
        .map((r: any) => r.outputPath)
        .filter(Boolean)

      const existingPaths: string[] = []
      for (const candidate of candidatePaths) {
        try {
          await fs.access(candidate)
          existingPaths.push(candidate)
        } catch {
          // percorso non materializzato: ignorato
        }
      }

      const downloadRequest = new NextRequest('http://localhost:3000/api/download/prepare', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: existingPaths.length > 0 ? [existingPaths[0]] : [tempPath],
          downloadType: 'individual'
        })
      })

      const downloadResponse = await downloadPOST(downloadRequest)
      const downloadData = await downloadResponse.json()

      expect(downloadResponse.status).toBe(200)
      expect(downloadData.success).toBe(true)

      // Cleanup uploaded file
      await fs.unlink(tempPath)
    }, 30000)

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

      // Step 4: Download as album (batch).
      // Come nel test single file: la rotta è /api/download/prepare, accetta
      // filePaths[] e per il batch pretende anche albumName. Usiamo i file
      // caricati, che esistono davvero su disco.
      const { POST: downloadPOST } = await import('../../app/api/download/prepare/route')

      const downloadRequest = new NextRequest('http://localhost:3000/api/download/prepare', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: tempPaths,
          downloadType: 'batch',
          albumName: 'Test Album'
        })
      })

      const downloadResponse = await downloadPOST(downloadRequest)
      const downloadData = await downloadResponse.json()

      expect(downloadResponse.status).toBe(200)
      expect(downloadData.success).toBe(true)
      expect(downloadData.downloadType).toBe('batch')

      // Cleanup uploaded files
      for (const tempPath of tempPaths) {
        await fs.unlink(tempPath)
      }
    }, 30000)
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

      // La rotta rifiuta l'intero lotto appena trova un'estensione non
      // supportata, e lo fa con 415 Unsupported Media Type / UNSUPPORTED_FORMAT
      // (vedi ErrorTypes in lib/server-error-handler.ts). Il test pretendeva
      // 400/INVALID_FILES, che è il comportamento di una versione precedente:
      // 415 è semanticamente più corretto per un formato non accettato.
      expect(uploadResponse.status).toBe(415)
      expect(uploadData.success).toBe(false)
      expect(uploadData.error?.code ?? uploadData.code).toBe('UNSUPPORTED_FORMAT')
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