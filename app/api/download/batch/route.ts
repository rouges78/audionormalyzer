import { NextRequest, NextResponse } from 'next/server'
import { createDownloadManager } from '@/services/download-manager'

/**
 * POST /api/download/batch
 * Prepare batch download with ZIP archive creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePaths, albumName } = body

    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { error: 'File paths array is required' },
        { status: 400 }
      )
    }

    if (!albumName || typeof albumName !== 'string') {
      return NextResponse.json(
        { error: 'Album name is required' },
        { status: 400 }
      )
    }

    const downloadManager = createDownloadManager()

    // Validate download request first
    const validation = await downloadManager.validateDownloadRequest(filePaths)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Download validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Prepare batch download
    const result = await downloadManager.prepareBatchDownload(
      filePaths,
      albumName
    )

    return NextResponse.json({
      success: true,
      downloadId: result.downloadId,
      fileName: result.fileName,
      totalSize: result.totalSize,
      fileCount: result.fileCount,
      expiresAt: result.expiresAt.toISOString(),
      downloadUrl: `/api/download/${result.downloadId}`
    })

  } catch (error) {
    console.error('Batch download preparation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to prepare batch download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}