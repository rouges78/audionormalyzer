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
    if (Math.abs(diff) < 0.1) return <Minus className="h-4 w-4 text-muted-foreground" />
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-[color:var(--success)]" />
    return <TrendingDown className="h-4 w-4 text-[color:var(--danger)]" />
  }

  const getChangeColor = (original: number, predicted: number) => {
    const diff = predicted - original
    if (Math.abs(diff) < 0.1) return 'text-muted-foreground'
    if (diff > 0) return 'text-[color:var(--success)]'
    return 'text-[color:var(--danger)]'
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
          <BarChart3 className="h-4 w-4 text-[color:var(--primary-ink)]" />
          Feedback Normalizzazione - {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Before/After Comparison */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Confronto Prima/Dopo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Peak Level */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Peak Level</span>
                  {getChangeIcon(originalAnalysis.peakLevel, predictedAnalysis.peakLevel)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.peakLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Dopo:</span>
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
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">RMS Level</span>
                  {getChangeIcon(originalAnalysis.rmsLevel, predictedAnalysis.rmsLevel)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.rmsLevel.toFixed(1)} dB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Dopo:</span>
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
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Loudness (LUFS)</span>
                  {getChangeIcon(originalAnalysis.lufsIntegrated, predictedAnalysis.lufsIntegrated)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.lufsIntegrated.toFixed(1)} LUFS</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Dopo:</span>
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
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">True Peak</span>
                  {getChangeIcon(originalAnalysis.truePeak, predictedAnalysis.truePeak)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prima:</span>
                    <span className="font-mono text-sm">{originalAnalysis.truePeak.toFixed(1)} dBTP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Dopo:</span>
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
          <div className="p-4 bg-[color:var(--tint-primary)] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-[color:var(--primary-ink)]">Gain Applicato</h5>
                <p className="text-sm text-[color:var(--primary-ink)]">
                  Modifica del volume applicata al segnale
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-[color:var(--primary-ink)]">
                  {predictedAnalysis.gainApplied > 0 ? '+' : ''}{predictedAnalysis.gainApplied.toFixed(1)} dB
                </div>
                <div className="text-sm text-[color:var(--primary-ink)]">
                  {Math.abs(predictedAnalysis.gainApplied) > 6 ? 'Gain elevato' : 'Gain moderato'}
                </div>
              </div>
            </div>
          </div>

          {/* Quality Assessment */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Valutazione Qualità</h4>
            
            {/* Improvements */}
            {assessment.improvements.length > 0 && (
              <div className="space-y-2">
                {assessment.improvements.map((improvement, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-[color:var(--tint-success)] rounded text-[color:var(--success)]">
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
                  <div key={index} className="flex items-center gap-2 p-2 bg-[color:var(--tint-warning)] rounded text-[color:var(--warning)]">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* All Good */}
            {assessment.issues.length === 0 && assessment.improvements.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-[color:var(--tint-info)] rounded text-[color:var(--info)]">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Nessun problema rilevato. La normalizzazione sembra appropriata.</span>
              </div>
            )}
          </div>

          {/* Dynamic Range Analysis */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Analisi Dynamic Range</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Originale</div>
                <div className="text-lg font-bold text-foreground">
                  {Math.abs(originalAnalysis.peakLevel - originalAnalysis.rmsLevel).toFixed(1)} dB
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Dopo Normalizzazione</div>
                <div className="text-lg font-bold text-foreground">
                  {Math.abs(predictedAnalysis.peakLevel - predictedAnalysis.rmsLevel).toFixed(1)} dB
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-[color:var(--tint-info)] rounded text-center">
              <span className="text-sm text-[color:var(--info)]">
                La normalizzazione preserva il dynamic range originale
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}