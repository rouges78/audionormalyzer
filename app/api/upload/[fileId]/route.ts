import { NextRequest, NextResponse } from 'next/server'
import { createFileManager } from '@/services/file-manager'

/**
 * GET /api/upload/[fileId]
 * Gets information about an uploaded file by its ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID file richiesto',
          code: 'MISSING_FILE_ID'
        },
        { status: 400 }
      )
    }

    const fileManager = createFileManager()
    const fileInfo = await fileManager.getTempFileInfo(fileId)

    if (!fileInfo) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File non trovato',
          code: 'FILE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: fileId,
        path: fileInfo.path,
        size: fileInfo.size,
        created: fileInfo.created,
        exists: true
      }
    })

  } catch (error) {
    console.error('Errore nel recupero informazioni file:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Errore interno del server',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/upload/[fileId]
 * Deletes an uploaded temporary file by its ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID file richiesto',
          code: 'MISSING_FILE_ID'
        },
        { status: 400 }
      )
    }

    const fileManager = createFileManager()
    const fileInfo = await fileManager.getTempFileInfo(fileId)

    if (!fileInfo) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File non trovato',
          code: 'FILE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Delete the file
    await fileManager.cleanupFiles([fileInfo.path])

    return NextResponse.json({
      success: true,
      message: 'File eliminato con successo',
      data: {
        id: fileId,
        deleted: true
      }
    })

  } catch (error) {
    console.error('Errore nell\'eliminazione file:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Errore interno del server',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}