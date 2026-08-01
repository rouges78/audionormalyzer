import { NextRequest, NextResponse } from 'next/server'
import { AnalysisStorage } from '@/lib/analysis-storage'

/**
 * GET /api/analysis/[id]
 * Retrieves analysis results by analysis ID
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
          error: 'ID analisi richiesto',
          code: 'MISSING_ANALYSIS_ID'
        },
        { status: 400 }
      )
    }

    const analysisData = AnalysisStorage.get(id)

    if (!analysisData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Analisi non trovata',
          code: 'ANALYSIS_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Calculate progress percentage
    const progress = analysisData.totalFiles > 0 
      ? Math.round((analysisData.processedFiles / analysisData.totalFiles) * 100)
      : 0

    const response = {
      success: true,
      data: {
        id: analysisData.id,
        status: analysisData.status,
        progress,
        totalFiles: analysisData.totalFiles,
        processedFiles: analysisData.processedFiles,
        startTime: analysisData.startTime,
        endTime: analysisData.endTime,
        processingTime: analysisData.processingTime,
        results: analysisData.results,
        error: analysisData.error
      }
    }

    // Add summary statistics if completed
    if (analysisData.status === 'completed' && analysisData.results.length > 0) {
      const successfulResults = analysisData.results.filter((r: any) => r.success)
      
      if (successfulResults.length > 0) {
        const analyses = successfulResults.map((r: any) => r.analysis)
        
        const summary = {
          totalSuccessful: successfulResults.length,
          totalFailed: analysisData.results.length - successfulResults.length,
          averageDuration: analyses.reduce((sum: number, a: any) => sum + a.duration, 0) / analyses.length,
          averagePeakLevel: analyses.reduce((sum: number, a: any) => sum + a.peakLevel, 0) / analyses.length,
          averageRmsLevel: analyses.reduce((sum: number, a: any) => sum + a.rmsLevel, 0) / analyses.length,
          averageLufs: analyses.reduce((sum: number, a: any) => sum + a.lufsIntegrated, 0) / analyses.length,
          clippingFiles: analyses.filter((a: any) => a.hasClipping).length,
          formats: [...new Set(analyses.map((a: any) => a.format))],
          sampleRates: [...new Set(analyses.map((a: any) => a.sampleRate))]
        }
        
        // Si partiva da `analysisData` grezzo, e così il ramo "con riepilogo"
        // restituiva una forma DIVERSA dall'altro: spariva `progress` (che
        // esiste solo nell'oggetto `response`) proprio per le analisi
        // completate, cioè quelle in cui il client se lo aspetta a 100.
        return NextResponse.json({
          success: true,
          data: { ...response.data, summary }
        })
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Errore nel recupero risultati analisi:', error)
    
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
 * DELETE /api/analysis/[id]
 * Deletes analysis results and cleans up resources
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
          error: 'ID analisi richiesto',
          code: 'MISSING_ANALYSIS_ID'
        },
        { status: 400 }
      )
    }

    const analysisData = AnalysisStorage.get(id)

    if (!analysisData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Analisi non trovata',
          code: 'ANALYSIS_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Remove from storage
    AnalysisStorage.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Risultati analisi eliminati',
      data: {
        id,
        deleted: true
      }
    })

  } catch (error) {
    console.error('Errore nell\'eliminazione risultati analisi:', error)
    
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