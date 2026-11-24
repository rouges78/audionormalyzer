import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AudioAnalysis } from '@/types/audio'
import { BarChart3, TrendingUp, Volume2, AlertTriangle } from 'lucide-react'

interface LoudnessRangeDisplayProps {
  analysis: AudioAnalysis
  fileName: string
  className?: string
}

export function LoudnessRangeDisplay({ analysis, fileName, className }: LoudnessRangeDisplayProps) {
  const getDynamicRange = () => {
    return Math.abs(analysis.peakLevel - analysis.rmsLevel)
  }

  const getLoudnessCategory = (lufs: number) => {
    if (lufs > -14) return { category: 'Loud', color: 'bg-[color:var(--tint-danger)] text-[color:var(--danger)]' }
    if (lufs > -18) return { category: 'Medium', color: 'bg-[color:var(--tint-warning)] text-[color:var(--warning)]' }
    if (lufs > -23) return { category: 'Quiet', color: 'bg-[color:var(--tint-info)] text-[color:var(--info)]' }
    return { category: 'Very Quiet', color: 'bg-muted text-foreground' }
  }

  const getDynamicRangeCategory = (dr: number) => {
    if (dr < 6) return { category: 'Compressed', color: 'bg-[color:var(--tint-danger)] text-[color:var(--danger)]' }
    if (dr < 12) return { category: 'Moderate', color: 'bg-[color:var(--tint-warning)] text-[color:var(--warning)]' }
    if (dr < 20) return { category: 'Good', color: 'bg-[color:var(--tint-success)] text-[color:var(--success)]' }
    return { category: 'Excellent', color: 'bg-[color:var(--tint-info)] text-[color:var(--info)]' }
  }

  const getStreamingCompliance = (lufs: number, truePeak: number) => {
    const issues = []
    
    if (lufs > -14) issues.push('Troppo forte per streaming')
    if (truePeak > -1) issues.push('True peak troppo alto')
    if (lufs < -23) issues.push('Potrebbe essere troppo silenzioso')
    
    return issues
  }

  const loudnessCategory = getLoudnessCategory(analysis.lufsIntegrated)
  const dynamicRange = getDynamicRange()
  const dynamicRangeCategory = getDynamicRangeCategory(dynamicRange)
  const streamingIssues = getStreamingCompliance(analysis.lufsIntegrated, analysis.truePeak)

  // Create visual loudness meter
  const createLoudnessMeter = () => {
    const minLufs = -30
    const maxLufs = -6
    const currentLufs = Math.max(minLufs, Math.min(maxLufs, analysis.lufsIntegrated))
    const percentage = ((currentLufs - minLufs) / (maxLufs - minLufs)) * 100

    return (
      <div className="w-full">
        <div className="relative w-full h-6 rounded-full overflow-hidden nu-in-sm">
          {/* Background zones */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-[color:var(--tint-success)]"></div>
            <div className="flex-1 bg-[color:var(--tint-warning)]"></div>
            <div className="flex-1 bg-[color:var(--tint-danger)]"></div>
          </div>

          {/* Current level indicator — semi-transparent so it does not hide the zones */}
          <div
            className="absolute top-0 left-0 h-full bg-[color:var(--cta)]/70 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>

          {/* Target line (-14 LUFS) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground"
            style={{ left: `${(((-14) - minLufs) / (maxLufs - minLufs)) * 100}%` }}
          ></div>
        </div>

        {/* Labels below the bar: on top of the fill they were unreadable */}
        <div className="flex items-center justify-between px-1 pt-1 text-xs font-medium text-muted-foreground">
          <span>-30</span>
          <span>-14</span>
          <span>-6</span>
        </div>
      </div>
    )
  }

  // Create dynamic range meter
  const createDynamicRangeMeter = () => {
    const maxDR = 30
    const percentage = Math.min((dynamicRange / maxDR) * 100, 100)

    return (
      <div className="w-full">
        <div className="relative w-full h-6 rounded-full overflow-hidden nu-in-sm">
          {/* Background zones */}
          <div className="absolute inset-0 flex">
            <div className="w-1/5 bg-[color:var(--tint-danger)]"></div>
            <div className="w-1/5 bg-[color:var(--tint-warning)]"></div>
            <div className="w-3/5 bg-[color:var(--tint-success)]"></div>
          </div>

          {/* Current level indicator — semi-transparent so it does not hide the zones */}
          <div
            className="absolute top-0 left-0 h-full bg-[color:var(--info)]/70 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Labels below the bar: on top of the fill they were unreadable */}
        <div className="flex items-center justify-between px-1 pt-1 text-xs font-medium text-muted-foreground">
          <span>0</span>
          <span>15</span>
          <span>30</span>
        </div>
      </div>
    )
  }

  return (
    <Card className={`audio-card ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-[color:var(--primary-ink)]" />
          Analisi Loudness - {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Loudness Meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Loudness (LUFS)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">
                  {analysis.lufsIntegrated.toFixed(1)}
                </span>
                <Badge className={loudnessCategory.color}>
                  {loudnessCategory.category}
                </Badge>
              </div>
            </div>
            {createLoudnessMeter()}
            <div className="text-xs text-muted-foreground text-center">
              Target streaming: -14 LUFS
            </div>
          </div>

          {/* Dynamic Range Meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Dynamic Range</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">
                  {dynamicRange.toFixed(1)} dB
                </span>
                <Badge className={dynamicRangeCategory.color}>
                  {dynamicRangeCategory.category}
                </Badge>
              </div>
            </div>
            {createDynamicRangeMeter()}
            <div className="text-xs text-muted-foreground text-center">
              Range: 0 dB (compressed) - 30+ dB (dynamic)
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">True Peak</div>
              <div className="font-mono text-lg font-bold text-foreground">
                {analysis.truePeak.toFixed(1)} dBTP
              </div>
              <div className="text-xs text-muted-foreground">
                Limite: -1.0 dBTP
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Crest Factor</div>
              <div className="font-mono text-lg font-bold text-foreground">
                {(analysis.peakLevel - analysis.rmsLevel).toFixed(1)} dB
              </div>
              <div className="text-xs text-muted-foreground">
                Peak - RMS
              </div>
            </div>
          </div>

          {/* Streaming Compliance */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Conformità Streaming</h4>
            
            {streamingIssues.length === 0 ? (
              <div className="p-3 bg-[color:var(--tint-success)] border border-[color:var(--success)] rounded-lg">
                <div className="flex items-center gap-2 text-[color:var(--success)]">
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">Conforme agli Standard</span>
                </div>
                <p className="text-sm text-[color:var(--success)] mt-1">
                  Il file rispetta gli standard di loudness per le piattaforme streaming.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[color:var(--tint-warning)] border border-[color:var(--warning)] rounded-lg">
                <div className="flex items-center gap-2 text-[color:var(--warning)] mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Problemi Rilevati</span>
                </div>
                <ul className="text-sm text-[color:var(--warning)] space-y-1">
                  {streamingIssues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-[color:var(--warning)] rounded-full"></div>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Raccomandazioni</h4>
            <div className="space-y-2 text-sm">
              {analysis.lufsIntegrated > -14 && (
                <div className="p-2 bg-[color:var(--tint-info)] rounded text-[color:var(--info)]">
                  • Ridurre il volume di {(analysis.lufsIntegrated - (-14)).toFixed(1)} dB per conformità streaming
                </div>
              )}
              
              {analysis.truePeak > -1 && (
                <div className="p-2 bg-[color:var(--tint-warning-strong)] rounded text-[color:var(--warning-strong)]">
                  • Applicare limiting per ridurre il true peak sotto -1 dBTP
                </div>
              )}
              
              {dynamicRange < 6 && (
                <div className="p-2 bg-[color:var(--tint-danger)] rounded text-[color:var(--danger)]">
                  • Il segnale è molto compresso, considera di preservare più dinamica
                </div>
              )}
              
              {analysis.lufsIntegrated < -23 && (
                <div className="p-2 bg-[color:var(--tint-primary)] rounded text-[color:var(--primary-ink)]">
                  • Il volume potrebbe essere troppo basso per l'ascolto normale
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}