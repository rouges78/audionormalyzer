import { useState, useCallback } from 'react'
import { useErrorHandling } from '@/hooks/use-error-handling'
import { useValidation, validationRules } from '@/hooks/use-validation'
import { AudioFile, UploadResult } from '@/types/audio'

interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'uploading' | 'analyzing' | 'completed' | 'error'
  error?: string
}

interface UseAudioUploadReturn {
  audioFiles: AudioFile[]
  uploadProgress: UploadProgress[]
  isUploading: boolean
  isAnalyzing: boolean
  uploadFiles: (files: File[]) => Promise<void>
  removeFile: (fileId: string) => void
  clearAll: () => void
  error: string | null
}

export function useAudioUpload(): UseAudioUploadReturn {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { handleError, retryOperation } = useErrorHandling()
  
  // Validation rules for file uploads
  // Il tipo dei campi va dedotto dai valori iniziali: passando `{}` la chiave
  // 'files' non esisteva e validateField la rifiutava come `never`.
  const { validateField } = useValidation<{ files: File[] }>({ files: [] }, {
    files: [
      validationRules.required('Please select at least one file'),
      validationRules.fileSize(100 * 1024 * 1024, 'File size must be less than 100MB'), // 100MB limit
      validationRules.audioFormat(['mp3', 'wav', 'flac', 'aac', 'm4a'], 'Only audio files are supported')
    ]
  })

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    // Validate files before upload
    for (const file of files) {
      const validation = validateField('files', file, [
        validationRules.fileSize(100 * 1024 * 1024, 'File size must be less than 100MB'),
        validationRules.audioFormat(['mp3', 'wav', 'flac', 'aac', 'm4a'], 'Only audio files are supported')
      ])
      
      if (!validation.isValid) {
        const errorMessage = `${file.name}: ${validation.errors[0]}`
        handleError(errorMessage, { context: 'File validation' })
        setError(errorMessage)
        return
      }
    }

    setError(null)
    setIsUploading(true)

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = files.map((file, index) => ({
      fileId: `temp-${Date.now()}-${index}`,
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }))
    setUploadProgress(initialProgress)

    try {
      await retryOperation(async () => {
        // Create FormData for upload
        const formData = new FormData()
        files.forEach(file => {
          formData.append('files', file)
        })

        // Upload files
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Errore durante l\'upload')
        }

        const uploadResult = await uploadResponse.json()
        const uploadedFiles: UploadResult[] = uploadResult.data.files

        // Update progress to show upload completed
        setUploadProgress(prev => prev.map(p => ({
          ...p,
          progress: 100,
          status: 'analyzing' as const
        })))

        setIsUploading(false)
        setIsAnalyzing(true)

        // Start analysis with retry
        await retryOperation(async () => {
          const fileIds = uploadedFiles.map(f => f.id)
          const analysisResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileIds })
          })

          if (!analysisResponse.ok) {
            const errorData = await analysisResponse.json()
            throw new Error(errorData.error || 'Errore durante l\'analisi')
          }

          const analysisResult = await analysisResponse.json()
          const analysisId = analysisResult.data.analysisId

          // Poll for analysis results
          await pollAnalysisResults(analysisId, uploadedFiles)
        }, 'analysis-operation', { maxRetries: 2 })

      }, 'upload-operation', { maxRetries: 3 })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto'
      handleError(err as Error, { context: 'File upload' })
      setError(errorMessage)
      
      // Update progress to show error
      setUploadProgress(prev => prev.map(p => ({
        ...p,
        status: 'error' as const,
        error: errorMessage
      })))
    } finally {
      setIsUploading(false)
      setIsAnalyzing(false)
    }
  }, [handleError, retryOperation, validateField])

  const pollAnalysisResults = async (analysisId: string, uploadedFiles: UploadResult[]) => {
    const maxAttempts = 60 // 5 minutes with 5-second intervals
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        await retryOperation(async () => {
          const response = await fetch(`/api/analysis/${analysisId}`)
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('Analysis API error:', response.status, errorData)
            throw new Error(errorData.error || `Errore nel recupero risultati analisi (${response.status})`)
          }

          const result = await response.json()
          const analysisData = result.data

          // Update progress based on analysis status
          if (analysisData.status === 'processing') {
            const progress = Math.round((analysisData.processedFiles / analysisData.totalFiles) * 100)
            setUploadProgress(prev => prev.map(p => ({
              ...p,
              progress: Math.max(p.progress, progress)
            })))

            attempts++
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000) // Poll every 5 seconds
            } else {
              throw new Error('Timeout nell\'analisi dei file')
            }
          } else if (analysisData.status === 'completed') {
            // Convert results to AudioFile objects
            const newAudioFiles: AudioFile[] = analysisData.results
              .filter((result: any) => result.success)
              .map((result: any) => {
                const uploadedFile = uploadedFiles.find(f => f.id === result.fileId)
                return {
                  id: result.fileId,
                  name: result.fileName,
                  originalPath: uploadedFile?.tempPath || '',
                  size: uploadedFile?.size || 0,
                  format: result.analysis.format || uploadedFile?.format || 'unknown',
                  analysis: result.analysis,
                  status: 'ready' as const
                }
              })

            setAudioFiles(prev => [...prev, ...newAudioFiles])
            
            // Update progress to completed
            setUploadProgress(prev => prev.map(p => ({
              ...p,
              progress: 100,
              status: 'completed' as const
            })))

            // Clear progress after a delay
            setTimeout(() => {
              setUploadProgress([])
            }, 2000)

          } else if (analysisData.status === 'error') {
            throw new Error(analysisData.error || 'Errore nell\'analisi')
          }
        }, `polling-${analysisId}`, { maxRetries: 2, delay: 1000 })

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Errore nel polling'
        handleError(err as Error, { context: 'Analysis polling' })
        setError(errorMessage)
        
        setUploadProgress(prev => prev.map(p => ({
          ...p,
          status: 'error' as const,
          error: errorMessage
        })))
      }
    }

    // Start polling
    poll()
  }

  const removeFile = useCallback((fileId: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== fileId))
  }, [])

  const clearAll = useCallback(() => {
    setAudioFiles([])
    setUploadProgress([])
    setError(null)
  }, [])

  return {
    audioFiles,
    uploadProgress,
    isUploading,
    isAnalyzing,
    uploadFiles,
    removeFile,
    clearAll,
    error
  }
}