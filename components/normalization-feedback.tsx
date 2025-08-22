import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AudioAnalysis } from '@/types/audio'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react'

interface NormalizationFeedbackProps {
  originalAnalysis: AudioAnalysis
  predictedAnalysis: {
    peakLevel: number
    rmsLevel: number
    lufsIntegrated: number
    truePeak: number
    gainApplied: number
  }
  fileName: string
  className?: string
}

export function NormalizationFeedback({
  originalAnalysis,
  predictedAnalysis,
  fileName,
  className
}: NormalizationFeedbackProps) {
  
  const getChangeIcon = (original: number, predicted: number) => {
    const diff = predicted - original
    if (Math.abs(diff) < 0.1) return <Minus className="h-4 w-4 text-gray-500" />
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    return <TrendingDown className="h-4 w-4 text-red-600" />
  }

  const getChangeColor = (original: number, predicted: number) => {
    const diff = predicted - original
    if (Math.abs(diff) < 0.1) return 'text-gray-600 dark:text-gray-400'
    if (diff > 0) return 'text-green-600 dark:text-green-400'
    return 'text-red-600 dark:text-red-400'
  }

  const formatChange = (original: number, predicted: number) => {
    const diff = predicted - original
    if (Math.abs(diff) < 0.1) return '±0.0 dB'
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} dB`
  }

  const getQualityAssessment = () => {
    const issues = []
    const improvements = []

    // Check for clipping
    if (predictedAnalysis.truePeak > -1) {
      issues.push('Possibile clipping (True Peak > -1 dBTP)')
    } else if (originalAnalysis.truePeak > -1 && predictedAnalysis.truePeak <= -1) {
      improvements.push('Clipping risolto')
    }

    // Check streaming compliance
    if (predictedAnalysis.lufsIntegrated > -14) {
      issues.push('Sopra standard streaming (-14 LUFS)')
    } else if (originalAnalysis.lufsIntegrated > -14 && predictedAnalysis.lufsIntegrated <= -14) {
      improvements.push('Conforme agli standard streaming')
    }

    // Check for excessive gain
    if (Math.abs(predictedAnalysis.gainApplied) > 6) {
      issues.push(`Gain elevato (${predictedAnalysis.gainApplied.toFixed(1)} dB)`)
    }

    // Check dynamic range preservation
    const originalDR = Math.abs(originalAnalysis.peakLevel - originalAnalysis.rmsLevel)
    const predictedDR = Math.abs(predictedAnalysis.peakLevel - predictedAnalysis.rmsLevel)
    
    if (Math.abs(originalDR - predictedDR) < 0.5) {
      improvements.push('Dynamic range preservato')
    }

    return { issues, improvements }
  }

  const assessment = getQualityAssessment()

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-purple-800" />
          Feedback Normalizzazione - {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Before/After Comparison */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Confronto Prima/Dopo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Peak Level */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Peak Level</span>
                  {getChangeIcon(originalAnalysis.peakLevel, predictedAnalysis.peakLevel)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.peakLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Dopo:</span>
                    <span className="font-mono text-sm">{predictedAnalysis.peakLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-xs font-medium">Variazione:</span>
                    <span className={`font-mono text-sm ${getChangeColor(originalAnalysis.peakLevel, predictedAnalysis.peakLevel)}`}>
                      {formatChange(originalAnalysis.peakLevel, predictedAnalysis.peakLevel)}
                    </span>
                  </div>
                </div>
              </div>

              {/* RMS Level */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RMS Level</span>
                  {getChangeIcon(originalAnalysis.rmsLevel, predictedAnalysis.rmsLevel)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.rmsLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Dopo:</span>
                    <span className="font-mono text-sm">{predictedAnalysis.rmsLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-xs font-medium">Variazione:</span>
                    <span className={`font-mono text-sm ${getChangeColor(originalAnalysis.rmsLevel, predictedAnalysis.rmsLevel)}`}>
                      {formatChange(originalAnalysis.rmsLevel, predictedAnalysis.rmsLevel)}
                    </span>
                  </div>
                </div>
              </div>

              {/* LUFS */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Loudness (LUFS)</span>
                  {getChangeIcon(originalAnalysis.lufsIntegrated, predictedAnalysis.lufsIntegrated)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.lufsIntegrated.toFixed(1)} LUFS</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Dopo:</span>
                    <span className="font-mono text-sm">{predictedAnalysis.lufsIntegrated.toFixed(1)} LUFS</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-xs font-medium">Variazione:</span>
                    <span className={`font-mono text-sm ${getChangeColor(originalAnalysis.lufsIntegrated, predictedAnalysis.lufsIntegrated)}`}>
                      {formatChange(originalAnalysis.lufsIntegrated, predictedAnalysis.lufsIntegrated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* True Peak */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">True Peak</span>
                  {getChangeIcon(originalAnalysis.truePeak, predictedAnalysis.truePeak)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.truePeak.toFixed(1)} dBTP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Dopo:</span>
                    <span className="font-mono text-sm">{predictedAnalysis.truePeak.toFixed(1)} dBTP</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-xs font-medium">Variazione:</span>
                    <span className={`font-mono text-sm ${getChangeColor(originalAnalysis.truePeak, predictedAnalysis.truePeak)}`}>
                      {formatChange(originalAnalysis.truePeak, predictedAnalysis.truePeak)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gain Applied */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-purple-900 dark:text-purple-100">Gain Applicato</h5>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Modifica del volume applicata al segnale
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-100">
                  {predictedAnalysis.gainApplied > 0 ? '+' : ''}{predictedAnalysis.gainApplied.toFixed(1)} dB
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  {Math.abs(predictedAnalysis.gainApplied) > 6 ? 'Gain elevato' : 'Gain moderato'}
                </div>
              </div>
            </div>
          </div>

          {/* Quality Assessment */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Valutazione Qualità</h4>
            
            {/* Improvements */}
            {assessment.improvements.length > 0 && (
              <div className="space-y-2">
                {assessment.improvements.map((improvement, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-green-800 dark:text-green-200">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{improvement}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Issues */}
            {assessment.issues.length > 0 && (
              <div className="space-y-2">
                {assessment.issues.map((issue, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* All Good */}
            {assessment.issues.length === 0 && assessment.improvements.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Nessun problema rilevato. La normalizzazione sembra appropriata.</span>
              </div>
            )}
          </div>

          {/* Dynamic Range Analysis */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Analisi Dynamic Range</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Originale</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {Math.abs(originalAnalysis.peakLevel - originalAnalysis.rmsLevel).toFixed(1)} dB
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Dopo Normalizzazione</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {Math.abs(predictedAnalysis.peakLevel - predictedAnalysis.rmsLevel).toFixed(1)} dB
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-center">
              <span className="text-sm text-blue-800 dark:text-blue-200">
                La normalizzazione preserva il dynamic range originale
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}