# Upload API Endpoints

This directory contains the file upload API endpoints for the audio normalization system.

## Endpoints

### POST /api/upload
Main file upload endpoint that handles multiple audio file uploads.

**Features:**
- Accepts multiple audio files via multipart/form-data
- Validates file formats (MP3, WAV, FLAC, AAC, M4A, OGG)
- Stores files temporarily for processing
- Returns upload results with file IDs and metadata

**Request:**
```
POST /api/upload
Content-Type: multipart/form-data

files: File[] (audio files to upload)
```

**Response:**
```json
{
  "success": true,
  "message": "2 file caricati con successo",
  "data": {
    "files": [
      {
        "id": "uuid-string",
        "originalName": "song.mp3",
        "tempPath": "/temp/audio/uuid.mp3",
        "size": 1024000,
        "format": "MP3"
      }
    ],
    "totalFiles": 2,
    "totalSize": 2048000
  }
}
```

### GET /api/upload
Returns information about the upload endpoint.

**Response:**
```json
{
  "endpoint": "/api/upload",
  "method": "POST",
  "contentType": "multipart/form-data",
  "supportedFormats": ["MP3", "WAV", "FLAC", "AAC", "M4A", "OGG"],
  "maxFileSize": "500MB",
  "maxAlbumSize": "2GB",
  "description": "Upload audio files for normalization processing"
}
```

### POST /api/upload/validate
Validates audio files without storing them.

**Features:**
- Pre-upload validation
- Returns detailed validation results for each file
- Useful for client-side feedback

**Request:**
```
POST /api/upload/validate
Content-Type: multipart/form-data

files: File[] (audio files to validate)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 2,
    "validFiles": 1,
    "invalidFiles": 1,
    "results": [
      {
        "fileName": "song.mp3",
        "size": 1024000,
        "isValid": true,
        "format": "MP3"
      },
      {
        "fileName": "invalid.xyz",
        "size": 512000,
        "isValid": false,
        "error": "Formato non supportato"
      }
    ]
  }
}
```

### GET /api/upload/[fileId]
Gets information about an uploaded file by its ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "path": "/temp/audio/file-uuid.mp3",
    "size": 1024000,
    "created": "2024-01-01T00:00:00.000Z",
    "exists": true
  }
}
```

### DELETE /api/upload/[fileId]
Deletes an uploaded temporary file by its ID.

**Response:**
```json
{
  "success": true,
  "message": "File eliminato con successo",
  "data": {
    "id": "file-uuid",
    "deleted": true
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes
- `NO_FILES`: No files provided in request
- `INVALID_FILES`: Invalid file objects in request
- `UPLOAD_FAILED`: File upload processing failed
- `INTERNAL_ERROR`: Server internal error
- `MISSING_FILE_ID`: File ID parameter missing
- `FILE_NOT_FOUND`: Requested file not found

## File Validation

The system validates:
- File format (extension and MIME type)
- File size (max 500MB per file, 2GB per album)
- File integrity
- Supported audio formats

## Temporary Storage

- Files are stored in `/temp/audio/` directory
- Each file gets a unique UUID-based filename
- Files are automatically cleaned up after processing
- Old temporary files are cleaned up periodically

## Testing

Comprehensive test suite includes:
- Unit tests for individual endpoints
- Integration tests with real file operations
- Workflow tests for complete upload-to-delete cycles
- Error handling tests

Run tests with:
```bash
npm run test -- app/api/upload/__tests__ --run
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

**Requirement 1.1**: ✅ Sistema riconosce e lista file audio supportati
**Requirement 1.4**: ✅ Sistema mostra informazioni base come durata e formato

The upload endpoints provide the foundation for the audio normalization workflow by handling file uploads, validation, and temporary storage as specified in the design document.