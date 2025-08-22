import { NextRequest, NextResponse } from 'next/server'
import { createDownloadManager } from '@/services/download-manager'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

/**
 * GET /api/download/[downloadId]
 * Download prepared file or archive
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

    // Get download info
    const info = await downloadManager.getDownloadInfo(downloadId)
    if (!info) {
      return NextResponse.json(
        { error: 'Download not found' },
        { status: 404 }
      )
    }

    // Check if download has expired
    if (info.status === 'expired') {
      return NextResponse.json(
        { error: 'Download has expired' },
        { status: 410 }
      )
    }

    // Determine file path based on download type
    let filePath: string
    let mimeType: string = 'application/octet-stream'
    
    if (info.type === 'batch') {
      // For batch downloads, the file is in the download directory
      const downloadDir = path.join(process.cwd(), 'output', 'downloads', downloadId)
      filePath = path.join(downloadDir, info.fileName)
      mimeType = 'application/zip'
    } else {
      // For individual downloads, get the original file path from the download manager
      const individualInfo = await downloadManager.getIndividualDownloadInfo(downloadId)
      if (!individualInfo) {
        return NextResponse.json(
          { error: 'Individual download info not found' },
          { status: 404 }
        )
      }
      filePath = individualInfo.filePath
      mimeType = individualInfo.mimeType
    }

    // Verify file exists
    try {
      await stat(filePath)
    } catch {
      return NextResponse.json(
        { error: 'Download file not found' },
        { status: 404 }
      )
    }

    // Create file stream
    const fileStream = createReadStream(filePath)

    // Create response with proper headers
    const response = new NextResponse(fileStream as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${info.fileName}"`,
        'Content-Length': info.size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

    return response

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/download/[downloadId]
 * Clean up download files
 */
export async function DELETE(
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

    // Clean up download
    await downloadManager.cleanupDownload(downloadId)

    return NextResponse.json({
      success: true,
      message: 'Download cleaned up successfully'
    })

  } catch (error) {
    console.error('Download cleanup error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to clean up download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}