'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, File, Clock, AlertCircle } from 'lucide-react'
import { useDownload, IndividualDownloadResult } from '@/hooks/use-download'

interface IndividualDownloadProps {
  filePath: string
  fileName?: string
  onDownloadComplete?: () => void
  onError?: (error: string) => void
}

export function IndividualDownload({ 
  filePath, 
  fileName,
  onDownloadComplete,
  onError 
}: IndividualDownloadProps) {
  const {
    isPreparingIndividual,
    error,
    prepareIndividualDownload,
    downloadFile,
    clearError
  } = useDownload()

  const [downloadResult, setDownloadResult] = useState<IndividualDownloadResult | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const displayName = fileName || filePath.split('/').pop() || 'Unknown file'

  // Prepare individual download
  const handlePrepareDownload = async () => {
    clearError()
    const result = await prepareIndividualDownload(filePath)
    
    if (result) {
      setDownloadResult(result)
      // Automatically start download for individual files
      handleDownload(result)
    } else if (error) {
      onError?.(error)
    }
  }

  // Handle file download
  const handleDownload = async (result?: IndividualDownloadResult) => {
    const downloadInfo = result || downloadResult
    if (!downloadInfo) return

    setIsDownloading(true)
    try {
      await downloadFile(downloadInfo.downloadId, downloadInfo.fileName)
      onDownloadComplete?.()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
      setDownloadResult(null) // Reset after download
    }
  }

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
          <File className="h-5 w-5" />
          Download File
        </CardTitle>
        <CardDescription>
          Download individual processed file
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>File:</strong> {displayName}</p>
        </div>

        {downloadResult && (
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span>{formatFileSize(downloadResult.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{downloadResult.mimeType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires in:</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatExpirationTime(downloadResult.expiresAt)}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handlePrepareDownload}
          disabled={isPreparingIndividual || isDownloading}
          className="w-full"
        >
          {isPreparingIndividual || isDownloading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              {isPreparingIndividual ? 'Preparing...' : 'Downloading...'}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download File
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}