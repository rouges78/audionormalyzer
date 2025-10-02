"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, AudioWaveformIcon as Waveform, Settings, AlertCircle } from "lucide-react"
import { useAudioUpload } from "@/hooks/use-audio-upload"
import { UploadProgress } from "@/components/upload-progress"
import { AudioFileList } from "@/components/audio-file-list"
import { ErrorBoundary, AudioProcessingErrorBoundary, FileUploadErrorBoundary } from "@/components/error-boundary"

export default function AudioNormalizerApp() {
  const {
    audioFiles,
    uploadProgress,
    isUploading,
    isAnalyzing,
    uploadFiles,
    removeFile,
    clearAll,
    error
  } = useAudioUpload()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const fileArray = Array.from(files)
    await uploadFiles(fileArray)
    
    // Reset both inputs
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  const handlePlayFile = (fileId: string) => {
    // TODO: Implement audio playback
    console.log('Play file:', fileId)
  }

  const handleDownloadFile = (fileId: string) => {
    // TODO: Implement file download
    console.log('Download file:', fileId)
  }

  const handleNormalizationPreview = async (fileId: string, options: any) => {
    // TODO: Implement normalization preview
    console.log('Generate preview for file:', fileId, 'with options:', options)
    
    // Simulate preview generation
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('') // Return empty string for now
      }, 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-800 rounded-lg">
              <Waveform className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">AudioNorm Pro</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Elevate Your Sound with Precision</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Upload Section */}
        <FileUploadErrorBoundary>
          <Card className="audio-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-800" />
                Carica il Tuo Album
              </CardTitle>
              <CardDescription>
                Seleziona più file audio per normalizzare i loro livelli di volume per una riproduzione coerente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isAnalyzing}
                    className="h-20 border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 dark:border-purple-600 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 dark:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    variant="outline"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8" />
                      <span className="font-medium">
                        {isUploading ? 'Caricamento...' : isAnalyzing ? 'Analisi...' : 'Scegli File'}
                      </span>
                      <span className="text-sm opacity-70">File singoli</span>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isUploading || isAnalyzing}
                    className="h-20 border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 text-green-800 dark:border-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    variant="outline"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8" />
                      <span className="font-medium">
                        {isUploading ? 'Caricamento...' : isAnalyzing ? 'Analisi...' : 'Scegli Cartella'}
                      </span>
                      <span className="text-sm opacity-70">Album completo</span>
                    </div>
                  </Button>
                </div>
                
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  MP3, WAV, FLAC, AAC, M4A, OGG supportati
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading || isAnalyzing}
                />
                
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading || isAnalyzing}
                />
                
                {audioFiles.length > 0 && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {audioFiles.length} file caricati
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                      className="text-red-600 hover:text-red-700"
                    >
                      Cancella Tutto
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </FileUploadErrorBoundary>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Progress */}
        <UploadProgress 
          items={uploadProgress}
          isUploading={isUploading}
          isAnalyzing={isAnalyzing}
        />

        {/* Global Settings */}
        {audioFiles.length > 0 && audioFiles.some(f => f.status === 'ready') && (
          <Card className="audio-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-800" />
                Impostazioni di Normalizzazione
              </CardTitle>
              <CardDescription>Imposta il livello di volume target per tutto l'album</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Volume Target: -14 dB LUFS (Standard Streaming)
                  </label>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    La normalizzazione sarà implementata nel prossimo task. Per ora puoi vedere l'analisi dettagliata dei tuoi file.
                  </div>
                </div>
                <Button
                  disabled={true}
                  className="w-full bg-gray-400 text-white cursor-not-allowed"
                >
                  Normalizza Tutte le Tracce (Prossimamente)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio Files List */}
        <AudioProcessingErrorBoundary>
          <AudioFileList 
            files={audioFiles}
            onRemoveFile={removeFile}
            onPlayFile={handlePlayFile}
            onDownloadFile={handleDownloadFile}
            onNormalizationPreview={handleNormalizationPreview}
          />
        </AudioProcessingErrorBoundary>

        {/* Empty State */}
        {audioFiles.length === 0 && uploadProgress.length === 0 && (
          <Card className="audio-card">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Waveform className="h-8 w-8 text-purple-800 dark:text-purple-300" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Pronto per Normalizzare il Tuo Album
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Carica i tuoi file audio per iniziare. La nostra normalizzazione di livello professionale garantisce 
                livelli di volume coerenti in tutto il tuo album.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-purple-800 rounded-full"></div>
                  <span>Elaborazione Batch</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-purple-800 rounded-full"></div>
                  <span>Standard LUFS</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-purple-800 rounded-full"></div>
                  <span>Qualità Lossless</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
