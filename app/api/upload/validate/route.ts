import { NextRequest, NextResponse } from 'next/server'
import { createFileManager } from '@/services/file-manager'

/**
 * POST /api/upload/validate
 * Validates audio files before upload without storing them
 * Useful for client-side validation feedback
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Nessun file fornito per la validazione',
          code: 'NO_FILES'
        },
        { status: 400 }
      )
    }

    const fileManager = createFileManager()
    const validationResults = []

    for (const file of files) {
      try {
        const validation = await fileManager.validateAudioFile(file)
        validationResults.push({
          fileName: file.name,
          size: file.size,
          isValid: validation.isValid,
          format: validation.format,
          error: validation.error
        })
      } catch (error) {
        validationResults.push({
          fileName: file.name,
          size: file.size,
          isValid: false,
          error: error instanceof Error ? error.message : 'Errore di validazione'
        })
      }
    }

    const validFiles = validationResults.filter(result => result.isValid)
    const invalidFiles = validationResults.filter(result => !result.isValid)

    return NextResponse.json({
      success: true,
      data: {
        totalFiles: validationResults.length,
        validFiles: validFiles.length,
        invalidFiles: invalidFiles.length,
        results: validationResults
      }
    })

  } catch (error) {
    console.error('Validation endpoint error:', error)
    
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