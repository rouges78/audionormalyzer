import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../progress/[downloadId]/route'
import { NextRequest } from 'next/server'

// Mock the download manager
vi.mock('@/services/download-manager', () => ({
  createDownloadManager: () => ({
    trackDownloadProgress: vi.fn()
  })
}))

describe('/api/download/progress/[downloadId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return download progress successfully', async () => {
      // Re-mock the download manager for this specific test
      vi.doMock('@/services/download-manager', () => ({
        createDownloadManager: () => ({
          trackDownloadProgress: vi.fn().mockResolvedValue({
            downloadId: 'test-download-id',
            status: 'creating_archive',
            progress: 75,
            currentFile: 'file3.mp3',
            totalFiles: 3,
            processedFiles: 2
          })
        })
      }))

      // Clear module cache and re-import
      vi.resetModules()
      const { GET: GETWithNewMock } = await import('../progress/[downloadId]/route')

      const request = new NextRequest('http://localhost:3000/api/download/progress/test-download-id')
      const response = await GETWithNewMock(request, { params: { downloadId: 'test-download-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.progress.downloadId).toBe('test-download-id')
      expect(data.progress.status).toBe('creating_archive')
      expect(data.progress.progress).toBe(75)
      expect(data.progress.currentFile).toBe('file3.mp3')
      expect(data.progress.totalFiles).toBe(3)
      expect(data.progress.processedFiles).toBe(2)
    })

    it('should return error for missing download ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/progress/')
      const response = await GET(request, { params: { downloadId: '' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Download ID is required')
    })

    it('should return 404 for non-existent download', async () => {
      const { createDownloadManager } = await import('@/services/download-manager')
      const mockManager = createDownloadManager()
      
      vi.mocked(mockManager.trackDownloadProgress).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/download/progress/nonexistent-id')
      const response = await GET(request, { params: { downloadId: 'nonexistent-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Download progress not found')
    })

    it('should handle tracking errors', async () => {
      // Re-mock the download manager for this specific test
      vi.doMock('@/services/download-manager', () => ({
        createDownloadManager: () => ({
          trackDownloadProgress: vi.fn().mockRejectedValue(
            new Error('Tracking failed')
          )
        })
      }))

      // Clear module cache and re-import
      vi.resetModules()
      const { GET: GETWithNewMock } = await import('../progress/[downloadId]/route')

      const request = new NextRequest('http://localhost:3000/api/download/progress/error-id')
      const response = await GETWithNewMock(request, { params: { downloadId: 'error-id' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track download progress')
      expect(data.details).toBe('Tracking failed')
    })

    it('should return progress with error status', async () => {
      // Re-mock the download manager for this specific test
      vi.doMock('@/services/download-manager', () => ({
        createDownloadManager: () => ({
          trackDownloadProgress: vi.fn().mockResolvedValue({
            downloadId: 'error-download-id',
            status: 'error',
            progress: 50,
            totalFiles: 3,
            processedFiles: 1,
            error: 'Archive creation failed'
          })
        })
      }))

      // Clear module cache and re-import
      vi.resetModules()
      const { GET: GETWithNewMock } = await import('../progress/[downloadId]/route')

      const request = new NextRequest('http://localhost:3000/api/download/progress/error-download-id')
      const response = await GETWithNewMock(request, { params: { downloadId: 'error-download-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.progress.status).toBe('error')
      expect(data.progress.error).toBe('Archive creation failed')
    })
  })
})