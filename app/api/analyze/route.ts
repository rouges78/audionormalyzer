import { NextRequest, NextResponse } from 'next/server'
import { createAudioProcessor } from '@/services/audio-processor'
import { createFileManager } from '@/services/file-manager'
import { AnalysisStorage, AnalysisData, AnalysisResult } from '@/lib/analysis-storage'
import { withErrorHandling, serverErrorHandler, ErrorTypes } from '@/lib/server-error-handler'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/analyze
 * Analyzes uploaded audio files and returns analysis results
 * Expects file IDs from previous upload
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await serverErrorHandler.logInfo('Analysis request received', {
    method: request.method,
    url: request.url,
  });

  const body = await request.json()
  const { fileIds } = body

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw ErrorTypes.VALIDATION_ERROR('Array di ID file richiesto', { 
      fileIds: fileIds || null,
      isArray: Array.isArray(fileIds),
      length: fileIds?.length || 0
    });
  }

  const fileManager = createFileManager()
  const audioProcessor = createAudioProcessor()
  const analysisId = uuidv4()

  // Initialize analysis result
  const analysisData = AnalysisStorage.create(analysisId, fileIds.length)

  await serverErrorHandler.logInfo('Analysis initialized', {
    analysisId,
    fileIds,
    totalFiles: fileIds.length,
  });

  // Process files asynchronously with error handling
  processFilesAsync(fileIds, analysisId, fileManager, audioProcessor)
    .catch(async (error) => {
      await serverErrorHandler.logError(error, { analysisId }, undefined, '/api/analyze');
      
      // Update analysis status to error
      const analysisData = AnalysisStorage.get(analysisId);
      if (analysisData) {
        AnalysisStorage.setError(analysisId, error.message);
      }
    });

  return NextResponse.json({
    success: true,
    message: 'Analisi avviata',
    data: {
      analysisId,
      totalFiles: fileIds.length,
      status: 'processing'
    }
  })
})

/**
 * Processes files asynchronously and updates analysis results
 */
async function processFilesAsync(
  fileIds: string[], 
  analysisId: string, 
  fileManager: any, 
  audioProcessor: any
) {
  const analysisData = AnalysisStorage.get(analysisId)
  if (!analysisData) {
    await serverErrorHandler.logError(
      new Error('Analysis data not found'),
      { analysisId },
      undefined,
      'processFilesAsync'
    );
    return;
  }

  await serverErrorHandler.logInfo('Starting async file processing', {
    analysisId,
    fileIds,
    totalFiles: fileIds.length,
  });

  try {
    for (const fileId of fileIds) {
      try {
        await serverErrorHandler.logInfo(`Processing file ${fileId}`, { analysisId, fileId });

        // Get file info with timeout
        let fileInfo;
        try {
          fileInfo = await Promise.race([
            fileManager.getTempFileInfo(fileId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('File info timeout')), 30000)
            )
          ]);
        } catch (error) {
          await serverErrorHandler.logError(error as Error, { analysisId, fileId }, undefined, 'getTempFileInfo');
          throw error;
        }

        if (!fileInfo) {
          throw ErrorTypes.FILE_NOT_FOUND(fileId);
        }

        // Analyze audio file with timeout
        let analysis;
        try {
          analysis = await Promise.race([
            audioProcessor.analyzeAudio(fileInfo.path),
            new Promise((_, reject) => 
              setTimeout(() => reject(ErrorTypes.TIMEOUT_ERROR('audio analysis', 60000)), 60000)
            )
          ]);
        } catch (error) {
          await serverErrorHandler.logError(error as Error, { analysisId, fileId, filePath: fileInfo.path }, undefined, 'analyzeAudio');
          throw error;
        }
        
        AnalysisStorage.addResult(analysisId, {
          fileId,
          fileName: fileInfo.originalName || `file-${fileId}`,
          success: true,
          analysis: {
            duration: analysis.duration,
            sampleRate: analysis.sampleRate,
            channels: analysis.channels,
            peakLevel: analysis.peakLevel,
            rmsLevel: analysis.rmsLevel,
            lufsIntegrated: analysis.lufsIntegrated,
            truePeak: analysis.truePeak,
            hasClipping: analysis.hasClipping,
            format: analysis.format
          }
        });
        
        await serverErrorHandler.logInfo(`File ${fileId} processed successfully`, {
          analysisId,
          fileId,
          fileName: fileInfo.originalName,
          duration: analysis.duration,
          lufs: analysis.lufsIntegrated,
        });
        
      } catch (fileError) {
        await serverErrorHandler.logError(fileError as Error, {
          analysisId,
          fileId,
        }, undefined, 'file-processing');

        AnalysisStorage.addResult(analysisId, {
          fileId,
          fileName: `file-${fileId}`, // Placeholder, dovrebbe essere il nome reale
          success: false,
          error: fileError instanceof Error ? fileError.message : 'Errore di analisi'
        });
      }

      // Storage is updated automatically by addResult
    }

    // Mark as completed - this is handled automatically by AnalysisStorage
    
    // Storage is updated automatically

    await serverErrorHandler.logInfo('Analysis completed successfully', {
      analysisId,
      totalFiles: analysisData.totalFiles,
      processedFiles: analysisData.processedFiles,
      successfulFiles: analysisData.results.filter(r => r.success).length,
      processingTime: analysisData.processingTime,
    });

  } catch (error) {
    await serverErrorHandler.logError(error as Error, { analysisId }, undefined, 'processFilesAsync');
    
    analysisData.status = 'error';
    AnalysisStorage.setError(analysisId, error instanceof Error ? error.message : 'Errore di processing');

    // Cleanup any temp files associated with this analysis
    await serverErrorHandler.cleanupProcessingFiles(analysisId);
  }
}

/**
 * GET /api/analyze
 * Returns information about the analyze endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/analyze',
    method: 'POST',
    description: 'Analizza file audio caricati',
    parameters: {
      fileIds: 'Array di ID file da analizzare'
    },
    response: {
      analysisId: 'ID per recuperare i risultati',
      status: 'Stato dell\'analisi (processing, completed, error)'
    },
    relatedEndpoints: {
      results: '/api/analysis/:id',
      upload: '/api/upload'
    }
  })
}