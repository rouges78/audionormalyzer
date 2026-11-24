import { NextRequest, NextResponse } from 'next/server'
import { createFileManager } from '@/services/file-manager'
import { createAlbumProcessor } from '@/services/album-processor'
import { resolveAudioEngine } from '@/lib/engines'
import type { AudioFile, NormalizationResult, TempFileInfo } from '@/types/audio'
import { basename, extname } from 'path'
import { ProcessingStorage, ProcessingResult } from '@/lib/processing-storage'
import { withErrorHandling, serverErrorHandler, ErrorTypes } from '@/lib/server-error-handler'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/normalize
 * Starts normalization processing for uploaded audio files
 * Supports both individual file and album processing
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await serverErrorHandler.logInfo('Normalization request received', {
    method: request.method,
    url: request.url,
  });

  const body = await request.json()
  const { 
    fileIds, 
    method = 'loudness', 
    targetLevel = -16, 
    albumMode = false,
    maintainRelativeLoudness = true,
    outputFormat = 'preserve'
  } = body

  // Validation
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw ErrorTypes.VALIDATION_ERROR('Array di ID file richiesto', {
      fileIds: fileIds || null,
      isArray: Array.isArray(fileIds),
      length: fileIds?.length || 0
    }, 'MISSING_FILE_IDS');
  }

  // Validate normalization method
  if (!['peak', 'loudness'].includes(method)) {
    throw ErrorTypes.VALIDATION_ERROR('Metodo di normalizzazione non valido. Usa "peak" o "loudness"', {
      method,
      validMethods: ['peak', 'loudness']
    }, 'INVALID_METHOD');
  }

  // Validate target level based on method
  if (method === 'peak' && (targetLevel > 0 || targetLevel < -60)) {
    throw ErrorTypes.VALIDATION_ERROR('Livello target per peak deve essere tra -60dB e 0dB', {
      method,
      targetLevel,
      validRange: { min: -60, max: 0 }
    }, 'INVALID_TARGET_LEVEL');
  }

  if (method === 'loudness' && (targetLevel > -6 || targetLevel < -30)) {
    throw ErrorTypes.VALIDATION_ERROR('Livello target per loudness deve essere tra -30 LUFS e -6 LUFS', {
      method,
      targetLevel,
      validRange: { min: -30, max: -6 }
    }, 'INVALID_TARGET_LEVEL');
  }

  const processId = uuidv4()
  const fileManager = createFileManager()

  // Initialize processing result.
  // create() covers the common fields; albumMode, maintainRelativeLoudness and
  // outputFormat must be written separately, otherwise processAlbumAsync and the
  // GET /api/process/[id] route read them and find undefined.
  ProcessingStorage.create(processId, method, targetLevel, fileIds.length)
  const processingData = ProcessingStorage.update(processId, {
    albumMode,
    maintainRelativeLoudness,
    outputFormat,
  })!

  await serverErrorHandler.logInfo('Normalization initialized', {
    processId,
    fileIds,
    method,
    targetLevel,
    albumMode,
    totalFiles: fileIds.length,
  });

  // Start processing asynchronously with error handling
  const processingPromise = albumMode && fileIds.length > 1
    ? processAlbumAsync(fileIds, processId, fileManager)
    : processFilesAsync(fileIds, processId, fileManager);

  processingPromise.catch(async (error) => {
    await serverErrorHandler.logError(error, { processId }, undefined, '/api/normalize');
    
    // Update processing status to error
    const processingData = ProcessingStorage.get(processId);
    if (processingData) {
      ProcessingStorage.setError(processId, error.message);
    }

    // Cleanup processing files
    await serverErrorHandler.cleanupProcessingFiles(processId);
  });

  return NextResponse.json({
    success: true,
    message: 'Normalizzazione avviata',
    data: {
      processId,
      totalFiles: fileIds.length,
      method,
      targetLevel,
      albumMode,
      status: 'processing'
    }
  })
})

/**
 * Processes individual files asynchronously
 */
async function processFilesAsync(
  fileIds: string[], 
  processId: string, 
  fileManager: any
) {
  const processingData = ProcessingStorage.get(processId)
  if (!processingData) {
    await serverErrorHandler.logError(
      new Error('Processing data not found'),
      { processId },
      undefined,
      'processFilesAsync'
    );
    return;
  }

  await serverErrorHandler.logInfo('Starting async file processing', {
    processId,
    fileIds,
    totalFiles: fileIds.length,
    method: processingData.method,
    targetLevel: processingData.targetLevel,
  });

  const tempPaths: string[] = [];

  try {
    // Processing engine selected for the runtime (server → WASM until
    // the NativeEngine is ready in core-04).
    const engine = await resolveAudioEngine()

    for (const fileId of fileIds) {
      const fileStartTime = Date.now();

      // Declared outside the try: the catch block uses it for the file name.
      let fileInfo: TempFileInfo | null = null;

      try {
        await serverErrorHandler.logInfo(`Processing file ${fileId}`, { processId, fileId });

        // Get file info with timeout
        fileInfo = await Promise.race([
          fileManager.getTempFileInfo(fileId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(ErrorTypes.TIMEOUT_ERROR('file info retrieval', 30000)), 30000)
          )
        ]);

        if (!fileInfo) {
          throw ErrorTypes.FILE_NOT_FOUND(fileId);
        }

        // Create output path.
        // getTempFileInfo() does not return `originalName` — it never has —
        // so the fallback branch ALWAYS fired and produced
        // names without extension (e.g. "processed-<uuid>_2026-...-586Z"),
        // making the output file unrecognizable despite
        // preserveFormat: true. We recover the extension from the temp file.
        const sourceExtension = extname(fileInfo.path)
        const outputPath = await fileManager.createOutputPath(
          fileInfo.originalName || `processed-${fileId}${sourceExtension}`
        )
        tempPaths.push(outputPath);

        // Normalize audio with timeout
        const normalizeOptions = {
          method: processingData.method,
          targetLevel: processingData.targetLevel,
          preserveFormat: true, // Default to preserve format
          outputPath
        }

        const result = await Promise.race([
          engine.normalize({ kind: 'path', path: fileInfo.path }, normalizeOptions),
          new Promise<NormalizationResult>((_, reject) =>
            setTimeout(() => reject(ErrorTypes.TIMEOUT_ERROR('audio normalization', 300000)), 300000) // 5 minutes
          )
        ]);

        if (!result.success) {
          throw new Error(result.error || 'Normalizzazione fallita')
        }

        const fileProcessingTime = Date.now() - fileStartTime;

        processingData.results.push({
          fileId,
          fileName: fileInfo.originalName || `file-${fileId}`,
          success: true,
          outputPath: result.outputPath as string,
          originalLoudness: 0, // Will be filled by actual analysis
          finalLoudness: result.finalLoudness,
          gainApplied: result.gainApplied,
          processingTime: fileProcessingTime
        })

        processingData.processedFiles++
        
        await serverErrorHandler.logInfo(`File ${fileId} processed successfully`, {
          processId,
          fileId,
          fileName: fileInfo.originalName,
          outputPath: result.outputPath,
          processingTime: fileProcessingTime,
        });
        
      } catch (fileError) {
        await serverErrorHandler.logError(fileError as Error, {
          processId,
          fileId,
        }, undefined, 'file-normalization');

        processingData.results.push({
          fileId,
          fileName: fileInfo?.originalName || `file-${fileId}`,
          success: false,
          error: fileError instanceof Error ? fileError.message : 'Errore di normalizzazione'
        });
        processingData.processedFiles++;
      }

      // Update storage after each file
      ProcessingStorage.set(processId, processingData);
    }

    // Mark as completed
    processingData.status = 'completed';
    processingData.endTime = Date.now();
    processingData.processingTime = processingData.endTime - processingData.startTime;

    // Final storage update
    ProcessingStorage.set(processId, processingData);

    await serverErrorHandler.logInfo('Processing completed successfully', {
      processId,
      totalFiles: processingData.totalFiles,
      processedFiles: processingData.processedFiles,
      successfulFiles: processingData.results.filter(r => r.success).length,
      processingTime: processingData.processingTime,
    });

  } catch (error) {
    await serverErrorHandler.logError(error as Error, { processId }, undefined, 'processFilesAsync');
    
    processingData.status = 'error';
    processingData.error = error instanceof Error ? error.message : 'Errore di processing';
    processingData.endTime = Date.now();
    ProcessingStorage.set(processId, processingData);

    // Cleanup temp files on error
    if (tempPaths.length > 0) {
      await serverErrorHandler.cleanupTempFiles(tempPaths);
    }

    // Cleanup any processing files associated with this process
    await serverErrorHandler.cleanupProcessingFiles(processId);
  }
}

/**
 * Processes album files with consistent loudness
 */
async function processAlbumAsync(
  fileIds: string[], 
  processId: string, 
  fileManager: any
) {
  const processingData = ProcessingStorage.get(processId)
  if (!processingData) return

  try {
    const albumProcessor = createAlbumProcessor()

    // Get all file infos.
    // getTempFileInfo does not return the original name (temp files on disk
    // are saved with the fileId only), so we derive it from the path.
    const fileInfos: AudioFile[] = []
    for (const fileId of fileIds) {
      const fileInfo = await fileManager.getTempFileInfo(fileId)
      if (fileInfo) {
        const name = fileInfo.originalName || basename(fileInfo.path)
        fileInfos.push({
          id: fileId,
          name,
          originalPath: fileInfo.path,
          tempPath: fileInfo.path,
          size: fileInfo.size,
          format: extname(name).replace('.', '').toLowerCase(),
          status: 'ready',
        })
      }
    }

    if (fileInfos.length === 0) {
      processingData.status = 'error'
      processingData.error = 'Nessun file valido trovato'
      ProcessingStorage.set(processId, processingData)
      return
    }

    // Process album
    const albumOptions = {
      normalizationMethod: processingData.method,
      targetLevel: processingData.targetLevel,
      maintainRelativeLoudness: processingData.maintainRelativeLoudness ?? true,
      outputFormat: processingData.outputFormat ?? 'preserve'
    }

    const albumResult = await albumProcessor.processAlbum(fileInfos, albumOptions)

    // Update results — fileResults holds the outcome track by track,
    // while albumResult describes the album as a whole.
    // The album ProcessingResult does not carry the file name: we recover it
    // from the fileInfos collected above.
    const nameByFileId = new Map<string, string>(fileInfos.map(info => [info.id, info.name]))

    processingData.results = albumResult.fileResults.map(result => ({
      fileId: result.fileId,
      fileName: nameByFileId.get(result.fileId) || `file-${result.fileId}`,
      success: result.success,
      outputPath: result.outputPath,
      originalLoudness: result.originalLoudness,
      finalLoudness: result.finalLoudness,
      gainApplied: result.gainApplied,
      processingTime: result.processingTime,
      error: result.error
    }))

    processingData.processedFiles = fileInfos.length
    processingData.status = 'completed'
    processingData.endTime = Date.now()
    processingData.processingTime = processingData.endTime - processingData.startTime

    ProcessingStorage.set(processId, processingData)

  } catch (error) {
    console.error('Album processing error:', error)
    processingData.status = 'error'
    processingData.error = error instanceof Error ? error.message : 'Errore di processing album'
    processingData.endTime = Date.now()
    ProcessingStorage.set(processId, processingData)
  }
}

/**
 * GET /api/normalize
 * Returns information about the normalize endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/normalize',
    method: 'POST',
    description: 'Avvia la normalizzazione di file audio',
    parameters: {
      fileIds: 'Array di ID file da normalizzare',
      method: 'Metodo di normalizzazione: "peak" o "loudness" (default: "loudness")',
      targetLevel: 'Livello target in dB o LUFS (default: -16)',
      albumMode: 'Modalità album per processing consistente (default: false)',
      maintainRelativeLoudness: 'Mantieni loudness relativo in modalità album (default: true)',
      outputFormat: 'Formato output: "preserve" o formato specifico (default: "preserve")'
    },
    response: {
      processId: 'ID per monitorare il progresso',
      status: 'Stato del processing (processing, completed, error)'
    },
    relatedEndpoints: {
      status: '/api/process/:id',
      upload: '/api/upload',
      analyze: '/api/analyze'
    }
  })
}