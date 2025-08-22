import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../individual/route'
import { NextRequest } from 'next/server'

// Mock the download manager
vi.mock('@/services/download-manager', () => ({
  createDownloadManager: () => ({
    prepareIndividualDownload: vi.fn().mockResolvedValue({
      downloadId: 'test-individual-id',
      filePath: '/test/file.mp3',
      fileName: 'file.mp3',
      size: 1024 * 512,
      mimeType: 'audio/mpeg',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })
  })
}))

describe('/api/download/individual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should prepare individual download successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/individual', {
        method: 'POST',
        body: JSON.stringify({
          filePath: '/test/file.mp3'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.downloadId).toBe('test-individual-id')
      expect(data.fileName).toBe('file.mp3')
      expect(data.size).toBe(1024 * 512)
      expect(data.mimeType).toBe('audio/mpeg')
      expect(data.downloadUrl).toBe('/api/download/test-individual-id')
    })

    it('should return error for missing file path', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/individual', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File path is required')
    })

    it('should return error for invalid file path type', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/individual', {
        method: 'POST',
        body: JSON.stringify({
          filePath: 123
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File path is required')
    })

    it('should handle download manager errors', async () => {
      // Re-mock the download manager for this specific test
      vi.doMock('@/services/download-manager', () => ({
        createDownloadManager: () => ({
          prepareIndividualDownload: vi.fn().mockRejectedValue(
            new Error('File not found')
          )
        })
      }))

      // Clear module cache and re-import
      vi.resetModules()
      const { POST: POSTWithNewMock } = await import('../individual/route')

      const request = new NextRequest('http://localhost:3000/api/download/individual', {
        method: 'POST',
        body: JSON.stringify({
          filePath: '/nonexistent/file.mp3'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POSTWithNewMock(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to prepare individual download')
      expect(data.details).toBe('File not found')
    })
  })
})