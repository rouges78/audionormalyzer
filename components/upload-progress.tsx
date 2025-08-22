import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Loader2, Upload, BarChart3 } from 'lucide-react'

interface UploadProgressItem {
  fileId: string
  fileName: string
  progress: number
  status: 'uploading' | 'analyzing' | 'completed' | 'error'
  error?: string
}

interface UploadProgressProps {
  items: UploadProgressItem[]
  isUploading: boolean
  isAnalyzing: boolean
}

export function UploadProgress({ items, isUploading, isAnalyzing }: UploadProgressProps) {
  if (items.length === 0) return null

  const getStatusIcon = (status: UploadProgressItem['status']) => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500" />
      case 'analyzing':
        return <BarChart3 className="h-4 w-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: UploadProgressItem['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Caricamento...
          </Badge>
        )
      case 'analyzing':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Analisi...
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Completato
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            Errore
          </Badge>
        )
    }
  }

  const getStatusText = () => {
    if (isUploading) return 'Caricamento file in corso...'
    if (isAnalyzing) return 'Analisi audio in corso...'
    return 'Elaborazione completata'
  }

  const overallProgress = items.length > 0 
    ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length)
    : 0

  return (
    <Card className="audio-card">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{getStatusText()}</span>
              <span className="text-gray-500">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="w-full" />
          </div>

          {/* Individual File Progress */}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.fileId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex-shrink-0">
                  {getStatusIcon(item.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.fileName}
                    </p>
                    {getStatusBadge(item.status)}
                  </div>
                  
                  {item.status !== 'completed' && (
                    <div className="flex items-center gap-2">
                      <Progress value={item.progress} className="flex-1 h-2" />
                      <span className="text-xs text-gray-500 min-w-[3rem]">
                        {item.progress}%
                      </span>
                    </div>
                  )}
                  
                  {item.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {item.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}