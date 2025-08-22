import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '../batch/route'
import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Mock the download manager
vi.mock('@/services/download-manager', () => ({
  createDownloadManager: () => ({
    validateDownloadRequest: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      totalSize: 1024 * 1024,
      fileCount: 3
    }),
    prepareBatchDownload: vi.fn().mockResolvedValue({
      downloadId: 'test-download-id',
      zipPath: '/test/path/album.zip',
      fileName: 'test-album.zip',
      totalSize: 1024 * 1024,
      fileCount: 3,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })
  })
}))

describe('/api/download/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should prepare batch download successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/batch', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: ['/test/file1.mp3', '/test/file2.mp3', '/test/file3.mp3'],
          albumName: 'Test Album'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.downloadId).toBe('test-download-id')
      expect(data.fileName).toBe('test-album.zip')
      expect(data.totalSize).toBe(1024 * 1024)
      expect(data.fileCount).toBe(3)
      expect(data.downloadUrl).toBe('/api/download/test-download-id')
    })

    it('should return error for missing file paths', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/batch', {
        method: 'POST',
        body: JSON.stringify({
          albumName: 'Test Album'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File paths array is required')
    })

    it('should return error for empty file paths array', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/batch', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: [],
          albumName: 'Test Album'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File paths array is required')
    })

    it('should return error for missing album name', async () => {
      const request = new NextRequest('http://localhost:3000/api/download/batch', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: ['/test/file1.mp3']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Album name is required')
    })

    it('should return error for invalid file paths', async () => {
      // Re-mock the download manager for this specific test
      vi.doMock('@/services/download-manager', () => ({
        createDownloadManager: () => ({
          validateDownloadRequest: vi.fn().mockResolvedValue({
            isValid: false,
            errors: ['File not accessible: file1.mp3', 'File not accessible: file2.mp3'],
            totalSize: 0,
            fileCount: 0
          }),
          prepareBatchDownload: vi.fn()
        })
      }))

      // Clear module cache and re-import
      vi.resetModules()
      const { POST: POSTWithNewMock } = await import('../batch/route')

      const request = new NextRequest('http://localhost:3000/api/download/batch', {
        method: 'POST',
        body: JSON.stringify({
          filePaths: ['/invalid/file1.mp3', '/invalid/file2.mp3'],
          albumName: 'Test Album'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POSTWithNewMock(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Download validation failed')
      expect(data.details).toEqual(['File not accessible: file1.mp3', 'File not accessible: file2.mp3'])
    })
  })
})