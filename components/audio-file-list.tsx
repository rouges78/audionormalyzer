import React, { useState } from 'react'
import { AudioFile, NormalizationOptions } from '@/types/audio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudioAnalysisDisplay } from './audio-analysis-display'
import { NormalizationPreview } from './normalization-preview'
import { NormalizationFeedback } from './normalization-feedback'
import { ErrorDisplay } from './error-display'
import { useErrorHandling } from '@/hooks/use-error-handling'
import { 
  Music, 
  Volume2, 
  Play, 
  Download, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Eye
} from 'lucide-react'

interface AudioFileListProps {
  files: AudioFile[]
  onRemoveFile: (fileId: string) => void
  onPlayFile?: (fileId: string) => void
  onDownloadFile?: (fileId: string) => void
  onNormalizationPreview?: (fileId: string, options: NormalizationOptions) => Promise<string>
  className?: string
}

export function AudioFileList({ 
  files, 
  onRemoveFile, 
  onPlayFile, 
  onDownloadFile,
  onNormalizationPreview,
  className 
}: AudioFileListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<Record<string, string>>({})
  const { errors, handleError, clearErrors } = useErrorHandling()

  if (files.length === 0) {
    return null
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: AudioFile['status']) => {
    switch (status) {
      case 'uploaded':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Clock className="h-3 w-3 mr-1" />
            Caricato
          </Badge>
        )
      case 'analyzing':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock className="h-3 w-3 mr-1 animate-spin" />
            Analisi...
          </Badge>
        )
      case 'ready':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Pronto
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            <Clock className="h-3 w-3 mr-1 animate-spin" />
            Elaborazione...
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completato
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Errore
          </Badge>
        )
    }
  }

  const toggleExpanded = (fileId: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId)
    } else {
      newExpanded.add(fileId)
      // Set default tab if not set
      if (!activeTab[fileId]) {
        setActiveTab(prev => ({ ...prev, [fileId]: 'analysis' }))
      }
    }
    setExpandedFiles(newExpanded)
  }

  const setFileTab = (fileId: string, tab: string) => {
    setActiveTab(prev => ({ ...prev, [fileId]: tab }))
  }

  const getVolumeColor = (analysis?: AudioFile['analysis']) => {
    if (!analysis) return 'text-gray-500'
    
    const lufs = analysis.lufsIntegrated
    if (lufs > -14) return 'text-red-600 dark:text-red-400'
    if (lufs > -18) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Music className="h-5 w-5 text-purple-800" />
          Tracce Album ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Error Display */}
        <ErrorDisplay 
          errors={errors}
          onClearAll={clearErrors}
          className="mb-4"
        />
        
        <div className="space-y-4">
          {files.map((file) => {
            const isExpanded = expandedFiles.has(file.id)
            
            return (
              <div key={file.id} className="border rounded-lg overflow-hidden">
                {/* File Header */}
                <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Volume2 className="h-6 w-6 text-purple-800 dark:text-purple-300" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span>{formatFileSize(file.size)}</span>
                      {file.analysis && (
                        <>
                          <span>{formatDuration(file.analysis.duration)}</span>
                          <span className={getVolumeColor(file.analysis)}>
                            {file.analysis.lufsIntegrated.toFixed(1)} LUFS
                          </span>
                        </>
                      )}
                      <span className="capitalize">{file.format}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(file.status)}
                    
                    {file.analysis?.hasClipping && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Clipping
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Expand/Collapse Button */}
                    {file.analysis && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(file.id)}
                        className="p-2"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* Action Buttons */}
                    {onPlayFile && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          try {
                            onPlayFile(file.id)
                          } catch (error) {
                            handleError(error as Error, { context: 'Audio playback' })
                          }
                        }}
                        disabled={file.status !== 'ready' && file.status !== 'completed'}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}

                    {onDownloadFile && file.status === 'completed' && (
                      <Button 
                        size="sm" 
                        className="bg-purple-800 hover:bg-purple-900 text-white"
                        onClick={() => {
                          try {
                            onDownloadFile(file.id)
                          } catch (error) {
                            handleError(error as Error, { context: 'File download' })
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveFile(file.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Error Message */}
                {file.error && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {file.error}
                    </p>
                  </div>
                )}

                {/* Expanded Content */}
                {isExpanded && file.analysis && (
                  <div className="border-t bg-gray-50 dark:bg-gray-800/50">
                    <div className="p-4">
                      <Tabs 
                        value={activeTab[file.id] || 'analysis'} 
                        onValueChange={(tab) => setFileTab(file.id, tab)}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="analysis" className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            Analisi
                          </TabsTrigger>
                          <TabsTrigger value="preview" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Anteprima
                          </TabsTrigger>
                          <TabsTrigger value="feedback" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Feedback
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="analysis">
                          <AudioAnalysisDisplay 
                            analysis={file.analysis}
                            fileName={file.name}
                          />
                        </TabsContent>

                        <TabsContent value="preview">
                          <NormalizationPreview
                            analysis={file.analysis}
                            fileName={file.name}
                            fileId={file.id}
                            onPreviewGenerate={onNormalizationPreview ? (options) => onNormalizationPreview(file.id, options) : undefined}
                          />
                        </TabsContent>

                        <TabsContent value="feedback">
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              Il feedback di normalizzazione sarà disponibile dopo aver generato un'anteprima
                            </p>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bulk Actions */}
        {files.some(f => f.status === 'completed') && (
          <div className="mt-6 pt-4 border-t">
            <Button 
              className="w-full bg-purple-800 hover:bg-purple-900 text-white"
              onClick={() => {
                // TODO: Implement bulk download
                console.log('Bulk download not implemented yet')
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Scarica Tutte le Tracce Elaborate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}