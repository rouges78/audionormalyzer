import { NextRequest, NextResponse } from 'next/server'
import { createFileOutputManager } from '@/services/file-output-manager'
import { AudioFile, ProcessingResult } from '@/types/audio'

/**
 * POST /api/output/save
 * Save processed files to output directory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      processedFilePath, 
      originalFile, 
      outputDirectory, 
      preserveOriginalName = true 
    } = body

    // Validate required fields
    if (!processedFilePath) {
      return NextResponse.json(
        { error: 'Processed file path is required' },
        { status: 400 }
      )
    }

    if (!originalFile || !originalFile.id || !originalFile.name) {
      return NextResponse.json(
        { error: 'Original file information is required' },
        { status: 400 }
      )
    }

    if (!outputDirectory) {
      return NextResponse.json(
        { error: 'Output directory is required' },
        { status: 400 }
      )
    }

    const fileOutputManager = createFileOutputManager()

    // Validate output directory
    const validation = await fileOutputManager.validateOutputDirectory(outputDirectory)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid output directory',
          details: validation.error
        },
        { status: 400 }
      )
    }

    // Save processed file
    const savedPath = await fileOutputManager.saveProcessedFile(
      processedFilePath,
      originalFile as AudioFile,
      outputDirectory,
      preserveOriginalName
    )

    // Get file info
    const fileInfo = await fileOutputManager.getProcessedFileInfo(savedPath)

    return NextResponse.json({
      success: true,
      savedPath,
      fileInfo
    })

  } catch (error) {
    console.error('File save error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save processed file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/output/save/album
 * Save album processing results with organization
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      results, 
      originalFiles, 
      albumName, 
      outputDirectory 
    } = body

    // Validate required fields
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Processing results are required' },
        { status: 400 }
      )
    }

    if (!originalFiles || !Array.isArray(originalFiles) || originalFiles.length === 0) {
      return NextResponse.json(
        { error: 'Original files information is required' },
        { status: 400 }
      )
    }

    if (!albumName || albumName.trim() === '') {
      return NextResponse.json(
        { error: 'Album name is required' },
        { status: 400 }
      )
    }

    if (!outputDirectory) {
      return NextResponse.json(
        { error: 'Output directory is required' },
        { status: 400 }
      )
    }

    const fileOutputManager = createFileOutputManager()

    // Validate output directory
    const validation = await fileOutputManager.validateOutputDirectory(outputDirectory)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid output directory',
          details: validation.error
        },
        { status: 400 }
      )
    }

    // Organize album output
    const albumResult = await fileOutputManager.organizeAlbumOutput(
      results as ProcessingResult[],
      originalFiles as AudioFile[],
      albumName,
      outputDirectory
    )

    return NextResponse.json({
      success: true,
      albumResult
    })

  } catch (error) {
    console.error('Album save error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save album output',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}