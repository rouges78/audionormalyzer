import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

describe('Upload API Workflow Tests', () => {
  const tempDir = path.join(process.cwd(), 'temp', 'audio')
  
  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up any remaining test files
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        if (file.includes('test-workflow')) {
          await fs.unlink(path.join(tempDir, file))
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should complete full upload → get info → delete workflow', async () => {
    // Step 1: Upload a file
    const { POST } = await import('../route')
    
    const audioContent = new ArrayBuffer(2048)
    const mockFile = new File([audioContent], 'test-workflow.mp3', { type: 'audio/mpeg' })

    const formData = new FormData()
    formData.append('files', mockFile)

    const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    })

    const uploadResponse = await POST(uploadRequest)
    const uploadData = await uploadResponse.json()

    expect(uploadResponse.status).toBe(200)
    expect(uploadData.success).toBe(true)
    expect(uploadData.data.files).toHaveLength(1)

    const uploadedFile = uploadData.data.files[0]
    const fileId = uploadedFile.id

    // Step 2: Get file information
    const { GET: fileGET } = await import('../[fileId]/route')
    
    const getResponse = await fileGET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId }) }
    )
    const getData = await getResponse.json()

    expect(getResponse.status).toBe(200)
    expect(getData.success).toBe(true)
    expect(getData.data.id).toBe(fileId)
    expect(getData.data.size).toBe(2048)
    expect(getData.data.exists).toBe(true)

    // Verify file actually exists on disk
    const fileExists = await fs.access(getData.data.path).then(() => true).catch(() => false)
    expect(fileExists).toBe(true)

    // Step 3: Delete the file
    const { DELETE: fileDELETE } = await import('../[fileId]/route')
    
    const deleteResponse = await fileDELETE(
      {} as NextRequest,
      { params: Promise.resolve({ fileId }) }
    )
    const deleteData = await deleteResponse.json()

    expect(deleteResponse.status).toBe(200)
    expect(deleteData.success).toBe(true)
    expect(deleteData.data.id).toBe(fileId)
    expect(deleteData.data.deleted).toBe(true)

    // Step 4: Verify file is deleted
    const fileExistsAfterDelete = await fs.access(getData.data.path).then(() => true).catch(() => false)
    expect(fileExistsAfterDelete).toBe(false)

    // Step 5: Try to get info for deleted file
    const getAfterDeleteResponse = await fileGET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId }) }
    )
    const getAfterDeleteData = await getAfterDeleteResponse.json()

    expect(getAfterDeleteResponse.status).toBe(404)
    expect(getAfterDeleteData.success).toBe(false)
    expect(getAfterDeleteData.code).toBe('FILE_NOT_FOUND')
  })

  it('should handle multiple file upload and selective deletion', async () => {
    // Upload multiple files
    const { POST } = await import('../route')
    
    const file1 = new File([new ArrayBuffer(1024)], 'test-workflow-1.mp3', { type: 'audio/mpeg' })
    const file2 = new File([new ArrayBuffer(2048)], 'test-workflow-2.wav', { type: 'audio/wav' })
    const file3 = new File([new ArrayBuffer(3072)], 'test-workflow-3.flac', { type: 'audio/flac' })

    const formData = new FormData()
    formData.append('files', file1)
    formData.append('files', file2)
    formData.append('files', file3)

    const uploadRequest = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    })

    const uploadResponse = await POST(uploadRequest)
    const uploadData = await uploadResponse.json()

    expect(uploadResponse.status).toBe(200)
    expect(uploadData.data.files).toHaveLength(3)
    expect(uploadData.data.totalSize).toBe(6144) // 1024 + 2048 + 3072

    const fileIds = uploadData.data.files.map((f: any) => f.id)

    // Delete only the second file
    const { DELETE: fileDELETE } = await import('../[fileId]/route')
    const { GET: fileGET } = await import('../[fileId]/route')
    
    const deleteResponse = await fileDELETE(
      {} as NextRequest,
      { params: Promise.resolve({ fileId: fileIds[1] }) }
    )

    expect(deleteResponse.status).toBe(200)

    // Verify first and third files still exist
    const getFile1Response = await fileGET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId: fileIds[0] }) }
    )
    const getFile3Response = await fileGET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId: fileIds[2] }) }
    )

    expect(getFile1Response.status).toBe(200)
    expect(getFile3Response.status).toBe(200)

    // Verify second file is deleted
    const getFile2Response = await fileGET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId: fileIds[1] }) }
    )

    expect(getFile2Response.status).toBe(404)

    // Clean up remaining files
    await fileDELETE({} as NextRequest, { params: Promise.resolve({ fileId: fileIds[0] }) })
    await fileDELETE({} as NextRequest, { params: Promise.resolve({ fileId: fileIds[2] }) })
  })
})