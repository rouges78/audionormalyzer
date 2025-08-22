import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('Upload API Simple Tests', () => {
  it('should test basic POST endpoint functionality', async () => {
    // Test that we can import and call the endpoint
    const { POST } = await import('../route')
    
    // Create a simple request with no files
    const formData = new FormData()
    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const data = await response.json()

    // Should return error for no files
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('NO_FILES')
  })

  it('should test GET endpoint functionality', async () => {
    const { GET } = await import('../route')
    
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.endpoint).toBe('/api/upload')
    expect(data.supportedFormats).toContain('MP3')
  })

  it('should test file ID endpoint with missing ID', async () => {
    const { GET } = await import('../[fileId]/route')
    
    const response = await GET(
      {} as NextRequest,
      { params: Promise.resolve({ fileId: '' }) }
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('MISSING_FILE_ID')
  })
})