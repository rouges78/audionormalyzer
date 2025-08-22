import { NextRequest, NextResponse } from 'next/server'
import { createDownloadManager } from '@/services/download-manager'

/**
 * GET /api/download/progress/[downloadId]
 * Track download preparation progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ downloadId: string }> }
) {
  try {
    const { downloadId } = await params

    if (!downloadId) {
      return NextResponse.json(
        { error: 'Download ID is required' },
        { status: 400 }
      )
    }

    const downloadManager = createDownloadManager()

    // Get download progress
    const progress = await downloadManager.trackDownloadProgress(downloadId)
    
    if (!progress) {
      return NextResponse.json(
        { error: 'Download progress not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      progress: {
        downloadId: progress.downloadId,
        status: progress.status,
        progress: progress.progress,
        currentFile: progress.currentFile,
        totalFiles: progress.totalFiles,
        processedFiles: progress.processedFiles,
        error: progress.error
      }
    })

  } catch (error) {
    console.error('Download progress tracking error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to track download progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}