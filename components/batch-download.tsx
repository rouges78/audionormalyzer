'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Package, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useDownload, BatchDownloadResult } from '@/hooks/use-download'

interface BatchDownloadProps {
  filePaths: string[]
  albumName: string
  onDownloadComplete?: () => void
  onError?: (error: string) => void
}

export function BatchDownload({ 
  filePaths, 
  albumName, 
  onDownloadComplete,
  onError 
}: BatchDownloadProps) {
  const {
    isPreparingBatch,
    batchProgress,
    error,
    prepareBatchDownload,
    trackProgress,
    downloadFile,
    cleanupDownload,
    clearError
  } = useDownload()

  const [downloadResult, setDownloadResult] = useState<BatchDownloadResult | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null)

  // Start batch download preparation
  const handlePrepareBatch = async () => {
    clearError()
    const result = await prepareBatchDownload(filePaths, albumName)
    
    if (result) {
      setDownloadResult(result)
      startProgressTracking(result.downloadId)
    } else if (error) {
      onError?.(error)
    }
  }

  // Start progress tracking
  const startProgressTracking = (downloadId: string) => {
    const interval = setInterval(async () => {
      const progress = await trackProgress(downloadId)
      
      if (progress?.status === 'ready') {
        clearInterval(interval)
        setProgressInterval(null)
      } else if (progress?.status === 'error') {
        clearInterval(interval)
        setProgressInterval(null)
        onError?.(progress.error || 'Download preparation failed')
      }
    }, 1000)
    
    setProgressInterval(interval)
  }

  // Handle file download
  const handleDownload = async () => {
    if (!downloadResult) return

    setIsDownloading(true)
    try {
      await downloadFile(downloadResult.downloadId, downloadResult.fileName)
      onDownloadComplete?.()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  // Handle cleanup
  const handleCleanup = async () => {
    if (!downloadResult) return

    try {
      await cleanupDownload(downloadResult.downloadId)
      setDownloadResult(null)
      
      if (progressInterval) {
        clearInterval(progressInterval)
        setProgressInterval(null)
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cleanup failed')
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
    }
  }, [progressInterval])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  // Format expiration time
  const formatExpirationTime = (expiresAt: string): string => {
    const expiration = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiration.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m`
    } else {
      return 'Expired'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Download Album
        </CardTitle>
        <CardDescription>
          Prepare and download {filePaths.length} files as a ZIP archive
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!downloadResult && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p><strong>Album:</strong> {albumName}</p>
              <p><strong>Files:</strong> {filePaths.length}</p>
            </div>
            
            <Button 
              onClick={handlePrepareBatch}
              disabled={isPreparingBatch}
              className="w-full"
            >
              {isPreparingBatch ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Preparing Archive...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Prepare Batch Download
                </>
              )}
            </Button>
          </div>
        )}

        {downloadResult && (
          <div className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Archive:</span>
                <span className="font-medium">{downloadResult.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span>{formatFileSize(downloadResult.totalSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Files:</span>
                <span>{downloadResult.fileCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires in:</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpirationTime(downloadResult.expiresAt)}
                </span>
              </div>
            </div>

            {batchProgress && batchProgress.status !== 'ready' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {batchProgress.status === 'preparing' && 'Preparing files...'}
                    {batchProgress.status === 'creating_archive' && 'Creating archive...'}
                  </span>
                  <span>{batchProgress.progress}%</span>
                </div>
                
                <Progress value={batchProgress.progress} className="w-full" />
                
                {batchProgress.currentFile && (
                  <p className="text-xs text-muted-foreground">
                    Processing: {batchProgress.currentFile}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {batchProgress.processedFiles} of {batchProgress.totalFiles} files processed
                </p>
              </div>
            )}

            {batchProgress?.status === 'ready' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Archive ready for download
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                disabled={batchProgress?.status !== 'ready' || isDownloading}
                className="flex-1"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Archive
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCleanup}
                disabled={isPreparingBatch || isDownloading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}