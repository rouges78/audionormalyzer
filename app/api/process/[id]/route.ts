import { NextRequest, NextResponse } from 'next/server'
import { ProcessingStorage } from '@/lib/processing-storage'
import type { ProcessingData, ProcessingSummary } from '@/lib/processing-storage'

/**
 * GET /api/process/[id]
 * Retrieves processing status and results by process ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID processo richiesto',
          code: 'MISSING_PROCESS_ID'
        },
        { status: 400 }
      )
    }

    const processingData = ProcessingStorage.get(id)

    if (!processingData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Processo non trovato',
          code: 'PROCESS_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Calculate progress percentage
    const progress = processingData.totalFiles > 0 
      ? Math.round((processingData.processedFiles / processingData.totalFiles) * 100)
      : 0

    const response: {
      success: true
      data: {
        id: string
        status: ProcessingData['status']
        progress: number
        method: ProcessingData['method']
        targetLevel: number
        albumMode?: boolean
        totalFiles: number
        processedFiles: number
        startTime: number
        endTime?: number
        processingTime?: number
        results: ProcessingData['results']
        error?: string
        summary?: ProcessingSummary
      }
    } = {
      success: true,
      data: {
        id: processingData.id,
        status: processingData.status,
        progress,
        method: processingData.method,
        targetLevel: processingData.targetLevel,
        albumMode: processingData.albumMode,
        totalFiles: processingData.totalFiles,
        processedFiles: processingData.processedFiles,
        startTime: processingData.startTime,
        endTime: processingData.endTime,
        processingTime: processingData.processingTime,
        results: processingData.results,
        error: processingData.error
      }
    }

    // Add summary statistics if completed
    if (processingData.status === 'completed' && processingData.results.length > 0) {
      const successfulResults = processingData.results.filter(r => r.success)
      
      if (successfulResults.length > 0) {
        response.data.summary = {
          totalSuccessful: successfulResults.length,
          totalFailed: processingData.results.length - successfulResults.length,
          averageGainApplied: successfulResults.reduce((sum, r) => sum + (r.gainApplied || 0), 0) / successfulResults.length,
          averageProcessingTime: successfulResults.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successfulResults.length,
          totalOutputSize: 0, // Would need file size calculation
          outputFiles: successfulResults.map(r => r.outputPath).filter(Boolean) as string[]
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error retrieving process status:', error)
    
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
 * DELETE /api/process/[id]
 * Cancels a running process or deletes completed process results
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID processo richiesto',
          code: 'MISSING_PROCESS_ID'
        },
        { status: 400 }
      )
    }

    const processingData = ProcessingStorage.get(id)

    if (!processingData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Processo non trovato',
          code: 'PROCESS_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // If process is still running, mark it as cancelled
    if (processingData.status === 'processing') {
      processingData.status = 'error'
      processingData.error = 'Processo cancellato dall\'utente'
      processingData.endTime = Date.now()
      ProcessingStorage.set(id, processingData)

      return NextResponse.json({
        success: true,
        message: 'Processo cancellato',
        data: {
          id,
          status: 'cancelled'
        }
      })
    }

    // Remove completed/error process from storage
    ProcessingStorage.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Risultati processo eliminati',
      data: {
        id,
        deleted: true
      }
    })

  } catch (error) {
    console.error('Error deleting process:', error)
    
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