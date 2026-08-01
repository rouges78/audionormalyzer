import { NextRequest, NextResponse } from 'next/server'
import { createFileManager } from '@/services/file-manager'
import { UploadResult } from '@/types/audio'
import { withErrorHandling, serverErrorHandler, ErrorTypes } from '@/lib/server-error-handler'

/**
 * POST /api/upload
 * Handles file upload for audio normalization
 * Supports multiple file upload with validation and temporary storage
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await serverErrorHandler.logInfo('Upload request received', {
    method: request.method,
    url: request.url,
  });

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  // Validation
  if (!files || files.length === 0) {
    throw ErrorTypes.VALIDATION_ERROR('Nessun file fornito per l\'upload', { filesCount: 0 }, 'NO_FILES');
  }

  // Validate that all entries are actually File objects
  const invalidFiles = files.filter(file => !(file instanceof File))
  if (invalidFiles.length > 0) {
    throw ErrorTypes.VALIDATION_ERROR('Alcuni file non sono validi', {
      invalidFilesCount: invalidFiles.length,
      totalFiles: files.length
    }, 'INVALID_FILES');
  }

  // Validate file sizes and formats
  const maxFileSize = 500 * 1024 * 1024; // 500MB
  const maxAlbumSize = 2 * 1024 * 1024 * 1024; // 2GB
  const supportedFormats = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];
  
  let totalSize = 0;
  const tempPaths: string[] = [];

  try {
    for (const file of files) {
      // Check file size
      if (file.size > maxFileSize) {
        throw ErrorTypes.FILE_TOO_LARGE(file.size, maxFileSize);
      }
      
      totalSize += file.size;
      
      // Check format
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !supportedFormats.includes(extension)) {
        throw ErrorTypes.UNSUPPORTED_FORMAT(extension || 'unknown');
      }
    }

    // Check total album size
    if (totalSize > maxAlbumSize) {
      throw ErrorTypes.FILE_TOO_LARGE(totalSize, maxAlbumSize);
    }

    await serverErrorHandler.logInfo('File validation passed', {
      filesCount: files.length,
      totalSize,
      fileNames: files.map(f => f.name),
    });

    const fileManager = createFileManager()
    const uploadResults: UploadResult[] = await fileManager.uploadFiles(files)
    
    // Track temp paths for cleanup on error
    tempPaths.push(...uploadResults.map(r => r.tempPath));

    await serverErrorHandler.logInfo('Files uploaded successfully', {
      uploadedFiles: uploadResults.length,
      totalSize: uploadResults.reduce((sum, file) => sum + file.size, 0),
    });
    
    return NextResponse.json({
      success: true,
      message: `${uploadResults.length} file caricati con successo`,
      data: {
        files: uploadResults,
        totalFiles: uploadResults.length,
        totalSize: uploadResults.reduce((sum, file) => sum + file.size, 0)
      }
    })
    
  } catch (error) {
    // Cleanup temp files on error
    if (tempPaths.length > 0) {
      await serverErrorHandler.cleanupTempFiles(tempPaths);
    }
    
    // Re-throw to be handled by withErrorHandling
    throw error;
  }
})

/**
 * GET /api/upload
 * Returns upload endpoint information and supported formats
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/upload',
    method: 'POST',
    contentType: 'multipart/form-data',
    supportedFormats: ['MP3', 'WAV', 'FLAC', 'AAC', 'M4A', 'OGG'],
    maxFileSize: '500MB',
    maxAlbumSize: '2GB',
    description: 'Upload audio files for normalization processing'
  })
}