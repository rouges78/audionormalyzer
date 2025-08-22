import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { createDownloadManager } from '@/services/download-manager'

describe('Batch Download Integration', () => {
  const testOutputDir = path.join(process.cwd(), 'temp', 'test-downloads')
  const testFiles = [
    path.join(testOutputDir, 'song1.mp3'),
    path.join(testOutputDir, 'song2.mp3'),
    path.join(testOutputDir, 'song3.mp3')
  ]

  beforeEach(async () => {
    // Create test directory and files
    await fs.mkdir(testOutputDir, { recursive: true })
    
    for (const filePath of testFiles) {
      await fs.writeFile(filePath, `Mock audio content for ${path.basename(filePath)}`)
    }
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rmdir(testOutputDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should complete full batch download workflow', async () => {
    const downloadManager = createDownloadManager()
    const albumName = 'Test Album'

    // Step 1: Validate download request
    const validation = await downloadManager.validateDownloadRequest(testFiles)
    expect(validation.isValid).toBe(true)
    expect(validation.fileCount).toBe(3)
    expect(validation.totalSize).toBeGreaterThan(0)

    // Step 2: Prepare batch download
    const batchResult = await downloadManager.prepareBatchDownload(testFiles, albumName)
    expect(batchResult.downloadId).toBeDefined()
    expect(batchResult.fileName).toBe('Test_Album.zip')
    expect(batchResult.fileCount).toBe(3)
    expect(batchResult.totalSize).toBeGreaterThan(0)

    // Step 3: Track progress until ready
    let progress = await downloadManager.trackDownloadProgress(batchResult.downloadId)
    expect(progress).toBeDefined()
    expect(progress?.downloadId).toBe(batchResult.downloadId)

    // In test environment, the download should be ready immediately
    expect(progress?.status).toBe('ready')
    expect(progress?.progress).toBe(100)

    // Step 4: Get download info
    const downloadInfo = await downloadManager.getDownloadInfo(batchResult.downloadId)
    expect(downloadInfo).toBeDefined()
    expect(downloadInfo?.type).toBe('batch')
    expect(downloadInfo?.fileName).toBe('Test_Album.zip')
    expect(downloadInfo?.status).toBe('ready')

    // Step 5: Verify ZIP file exists
    const zipExists = await fs.access(batchResult.zipPath).then(() => true).catch(() => false)
    expect(zipExists).toBe(true)

    // Step 6: Clean up
    await downloadManager.cleanupDownload(batchResult.downloadId)
    
    // Verify cleanup
    const progressAfterCleanup = await downloadManager.trackDownloadProgress(batchResult.downloadId)
    expect(progressAfterCleanup).toBeNull()
    
    const infoAfterCleanup = await downloadManager.getDownloadInfo(batchResult.downloadId)
    expect(infoAfterCleanup).toBeNull()
  })

  it('should handle individual download workflow', async () => {
    const downloadManager = createDownloadManager()
    const testFile = testFiles[0]

    // Step 1: Prepare individual download
    const individualResult = await downloadManager.prepareIndividualDownload(testFile)
    expect(individualResult.downloadId).toBeDefined()
    expect(individualResult.fileName).toBe('song1.mp3')
    expect(individualResult.mimeType).toBe('audio/mpeg')
    expect(individualResult.size).toBeGreaterThan(0)

    // Step 2: Get download info
    const downloadInfo = await downloadManager.getDownloadInfo(individualResult.downloadId)
    expect(downloadInfo).toBeDefined()
    expect(downloadInfo?.type).toBe('individual')
    expect(downloadInfo?.fileName).toBe('song1.mp3')
    expect(downloadInfo?.status).toBe('ready')

    // Step 3: Get individual download info
    const individualInfo = await downloadManager.getIndividualDownloadInfo(individualResult.downloadId)
    expect(individualInfo).toBeDefined()
    expect(individualInfo?.filePath).toBe(testFile)
    expect(individualInfo?.fileName).toBe('song1.mp3')

    // Step 4: Clean up
    await downloadManager.cleanupDownload(individualResult.downloadId)
    
    // Verify cleanup
    const infoAfterCleanup = await downloadManager.getDownloadInfo(individualResult.downloadId)
    expect(infoAfterCleanup).toBeNull()
    
    const individualInfoAfterCleanup = await downloadManager.getIndividualDownloadInfo(individualResult.downloadId)
    expect(individualInfoAfterCleanup).toBeNull()
  })

  it('should handle validation errors gracefully', async () => {
    const downloadManager = createDownloadManager()
    const nonExistentFiles = ['/nonexistent/file1.mp3', '/nonexistent/file2.mp3']

    // Validation should fail for non-existent files
    const validation = await downloadManager.validateDownloadRequest(nonExistentFiles)
    expect(validation.isValid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
    expect(validation.fileCount).toBe(0)

    // Batch download should fail
    await expect(
      downloadManager.prepareBatchDownload(nonExistentFiles, 'Test Album')
    ).rejects.toThrow('Download validation failed')
  })

  it('should handle file size limits', async () => {
    const downloadManager = createDownloadManager()
    
    // Create a large file list to exceed the limit
    const largeFileList = Array.from({ length: 150 }, (_, i) => `/test/file${i}.mp3`)

    const validation = await downloadManager.validateDownloadRequest(largeFileList)
    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('Too many files (150). Maximum allowed: 100')
  })

  it('should sanitize album names properly', async () => {
    const downloadManager = createDownloadManager()
    const unsafeAlbumName = 'Album<>Name|With?Special*Characters'

    const batchResult = await downloadManager.prepareBatchDownload(testFiles, unsafeAlbumName)
    expect(batchResult.fileName).toBe('Album_Name_With_Special_Characters.zip')
  })
})