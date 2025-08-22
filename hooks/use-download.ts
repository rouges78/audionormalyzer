import { useState, useCallback } from 'react'

export interface DownloadProgress {
  downloadId: string
  status: 'preparing' | 'creating_archive' | 'ready' | 'expired' | 'error'
  progress: number
  currentFile?: string
  totalFiles: number
  processedFiles: number
  error?: string
}

export interface BatchDownloadResult {
  downloadId: string
  fileName: string
  totalSize: number
  fileCount: number
  expiresAt: string
  downloadUrl: string
}

export interface IndividualDownloadResult {
  downloadId: string
  fileName: string
  size: number
  mimeType: string
  expiresAt: string
  downloadUrl: string
}

export interface UseDownloadReturn {
  // State
  isPreparingBatch: boolean
  isPreparingIndividual: boolean
  batchProgress: DownloadProgress | null
  error: string | null
  
  // Actions
  prepareBatchDownload: (filePaths: string[], albumName: string) => Promise<BatchDownloadResult | null>
  prepareIndividualDownload: (filePath: string) => Promise<IndividualDownloadResult | null>
  trackProgress: (downloadId: string) => Promise<DownloadProgress | null>
  downloadFile: (downloadId: string, fileName: string) => Promise<void>
  cleanupDownload: (downloadId: string) => Promise<void>
  clearError: () => void
}

export function useDownload(): UseDownloadReturn {
  const [isPreparingBatch, setIsPreparingBatch] = useState(false)
  const [isPreparingIndividual, setIsPreparingIndividual] = useState(false)
  const [batchProgress, setBatchProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const prepareBatchDownload = useCallback(async (
    filePaths: string[], 
    albumName: string
  ): Promise<BatchDownloadResult | null> => {
    try {
      setIsPreparingBatch(true)
      setError(null)
      setBatchProgress(null)

      const response = await fetch('/api/download/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePaths,
          albumName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare batch download')
      }

      if (!data.success) {
        throw new Error(data.error || 'Batch download preparation failed')
      }

      return {
        downloadId: data.downloadId,
        fileName: data.fileName,
        totalSize: data.totalSize,
        fileCount: data.fileCount,
        expiresAt: data.expiresAt,
        downloadUrl: data.downloadUrl
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsPreparingBatch(false)
    }
  }, [])

  const prepareIndividualDownload = useCallback(async (
    filePath: string
  ): Promise<IndividualDownloadResult | null> => {
    try {
      setIsPreparingIndividual(true)
      setError(null)

      const response = await fetch('/api/download/individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare individual download')
      }

      if (!data.success) {
        throw new Error(data.error || 'Individual download preparation failed')
      }

      return {
        downloadId: data.downloadId,
        fileName: data.fileName,
        size: data.size,
        mimeType: data.mimeType,
        expiresAt: data.expiresAt,
        downloadUrl: data.downloadUrl
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsPreparingIndividual(false)
    }
  }, [])

  const trackProgress = useCallback(async (
    downloadId: string
  ): Promise<DownloadProgress | null> => {
    try {
      const response = await fetch(`/api/download/progress/${downloadId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(data.error || 'Failed to track progress')
      }

      if (!data.success) {
        throw new Error(data.error || 'Progress tracking failed')
      }

      const progress = data.progress
      setBatchProgress(progress)
      return progress
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    }
  }, [])

  const downloadFile = useCallback(async (
    downloadId: string, 
    fileName: string
  ): Promise<void> => {
    try {
      setError(null)

      const response = await fetch(`/api/download/${downloadId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to download file')
      }

      // Create blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
    }
  }, [])

  const cleanupDownload = useCallback(async (downloadId: string): Promise<void> => {
    try {
      setError(null)

      const response = await fetch(`/api/download/${downloadId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup download')
      }

      if (!data.success) {
        throw new Error(data.error || 'Download cleanup failed')
      }

      // Clear progress if it matches the cleaned up download
      if (batchProgress?.downloadId === downloadId) {
        setBatchProgress(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
    }
  }, [batchProgress])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isPreparingBatch,
    isPreparingIndividual,
    batchProgress,
    error,
    prepareBatchDownload,
    prepareIndividualDownload,
    trackProgress,
    downloadFile,
    cleanupDownload,
    clearError
  }
}