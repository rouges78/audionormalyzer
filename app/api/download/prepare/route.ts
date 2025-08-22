import { NextRequest, NextResponse } from 'next/server'
import { createDownloadManager } from '@/services/download-manager'
import { createFileOutputManager } from '@/services/file-output-manager'

/**
 * POST /api/download/prepare
 * Prepare files for download (individual or batch)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePaths, downloadType, albumName } = body

    // Validate request
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { error: 'File paths are required' },
        { status: 400 }
      )
    }

    if (!downloadType || !['individual', 'batch'].includes(downloadType)) {
      return NextResponse.json(
        { error: 'Valid download type is required (individual or batch)' },
        { status: 400 }
      )
    }

    if (downloadType === 'batch' && (!albumName || albumName.trim() === '')) {
      return NextResponse.json(
        { error: 'Album name is required for batch downloads' },
        { status: 400 }
      )
    }

    const downloadManager = createDownloadManager()

    // Validate download request
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

    let result

    if (downloadType === 'individual') {
      if (filePaths.length !== 1) {
        return NextResponse.json(
          { error: 'Individual download requires exactly one file' },
          { status: 400 }
        )
      }

      result = await downloadManager.prepareIndividualDownload(filePaths[0])
    } else {
      result = await downloadManager.prepareBatchDownload(filePaths, albumName)
    }

    return NextResponse.json({
      success: true,
      downloadType,
      ...result
    })

  } catch (error) {
    console.error('Download preparation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to prepare download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/download/prepare?downloadId=xxx
 * Get download preparation status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const downloadId = searchParams.get('downloadId')

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
        { error: 'Download not found' },
        { status: 404 }
      )
    }

    // Get download info
    const info = await downloadManager.getDownloadInfo(downloadId)

    return NextResponse.json({
      success: true,
      downloadId,
      progress,
      info
    })

  } catch (error) {
    console.error('Download status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get download status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}