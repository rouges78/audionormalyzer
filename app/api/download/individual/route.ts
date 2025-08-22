import { NextRequest, NextResponse } from 'next/server'
import { createDownloadManager } from '@/services/download-manager'

/**
 * POST /api/download/individual
 * Prepare individual file download
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePath } = body

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const downloadManager = createDownloadManager()

    // Prepare individual download
    const result = await downloadManager.prepareIndividualDownload(filePath)

    return NextResponse.json({
      success: true,
      downloadId: result.downloadId,
      fileName: result.fileName,
      size: result.size,
      mimeType: result.mimeType,
      expiresAt: result.expiresAt.toISOString(),
      downloadUrl: `/api/download/${result.downloadId}`
    })

  } catch (error) {
    console.error('Individual download preparation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to prepare individual download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}